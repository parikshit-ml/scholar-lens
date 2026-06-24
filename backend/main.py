# main.py — ScholarLens Backend
# Upgrades: Hybrid Search + Cross-Encoder Reranking + Semantic Chunking + Query Cache + Multi-page Eval + Reranker Scores + Timing Metrics + Dynamic Suggestions

# ── Hugging Face Spaces: redirect all caches to /tmp BEFORE importing ML libs ──
import os
os.environ.setdefault("HF_HOME", "/tmp/hf_cache")
os.environ.setdefault("TRANSFORMERS_CACHE", "/tmp/hf_cache")
os.environ.setdefault("SENTENCE_TRANSFORMERS_HOME", "/tmp/hf_cache")
os.environ.setdefault("HF_HUB_CACHE", "/tmp/hf_cache")
os.environ.setdefault("XDG_CACHE_HOME", "/tmp/.cache")

from fastapi import FastAPI, UploadFile, File, Form
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from sentence_transformers import SentenceTransformer, CrossEncoder
from rank_bm25 import BM25Okapi
import faiss
import numpy as np
from PyPDF2 import PdfReader
from openai import AsyncOpenAI
import re, hashlib, time, json
from dotenv import load_dotenv
from typing import Optional

load_dotenv()
app = FastAPI()

print("Loading models…")
model = SentenceTransformer("all-MiniLM-L6-v2")
reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
print("Models ready.")

indexes: dict = {}
stores: dict = {}
bm25s: dict = {}
chunks_store = []
index = None

query_cache: dict = {}
CACHE_TTL = 3600

def make_cache_key(doc_id: str, question: str, k: int, style: str, temp: float) -> str:
    raw = f"{doc_id}|{question.strip().lower()}|{k}|{style}|{temp:.1f}"
    return hashlib.md5(raw.encode()).hexdigest()

def cache_get(key: str) -> dict | None:
    entry = query_cache.get(key)
    if entry and (time.time() - entry["ts"]) < CACHE_TTL:
        return entry
    if entry:
        del query_cache[key]
    return None

def cache_set(key: str, answer: str, sources: list, confidence: str, confidence_reason: str):
    query_cache[key] = {"answer": answer, "sources": sources, "confidence": confidence, "confidence_reason": confidence_reason, "ts": time.time()}
    print(f"CACHE SET: {len(query_cache)} entries in cache")

# CORS — allow the deployed Vercel frontend + local dev. Add your custom domain here later if you set one.
ALLOWED_ORIGINS = [
    "https://scholar-lens-eta.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",  # also allow Vercel preview deployments
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"status": "ok", "service": "ScholarLens backend", "models": "MiniLM + ms-marco cross-encoder"}


def clean_page_text(text: str) -> str:
    text = re.sub(r'Page \d+ of \d+\s*[-–]\s*AI Writing Submission', '', text)
    text = re.sub(r'Submission ID\s+trn:oid:::[^\s]+', '', text)
    text = re.sub(r'AI Writing Submission\s*Submission ID[^\n]*', '', text)
    lines = [l for l in text.split('\n') if len(l.strip()) > 15]
    return '\n'.join(lines).strip()


def semantic_chunk_pages(pages: list) -> list:
    chunks = []
    chunk_id = 0
    heading_pattern = re.compile(
        r'^(\d+[\.\d]*\s+[A-Z]|Chapter\s+\d+|CHAPTER\s+\d+|[A-Z][A-Z\s]{4,}$|'
        r'Abstract|Introduction|Conclusion|References|Methodology|Results|Discussion)',
        re.MULTILINE
    )
    for page_num, page_text in enumerate(pages, start=1):
        page_text = page_text.strip()
        if not page_text:
            continue
        paragraphs = [p.strip() for p in re.split(r'\n{2,}', page_text) if p.strip()]
        if not paragraphs:
            continue
        current_chunk, current_len = [], 0
        MAX_CHUNK, MIN_CHUNK = 1000, 150
        for para in paragraphs:
            is_heading = bool(heading_pattern.match(para)) and len(para) < 120
            if (is_heading and current_len > MIN_CHUNK) or current_len > MAX_CHUNK:
                if current_chunk:
                    text = '\n\n'.join(current_chunk).strip()
                    if len(text) > 50:
                        chunks.append({"text": text, "chunk_id": chunk_id, "page": page_num, "is_heading": is_heading})
                        chunk_id += 1
                current_chunk = [para]; current_len = len(para)
            else:
                current_chunk.append(para); current_len += len(para)
        if current_chunk:
            text = '\n\n'.join(current_chunk).strip()
            if len(text) > 50:
                chunks.append({"text": text, "chunk_id": chunk_id, "page": page_num, "is_heading": False})
                chunk_id += 1
    if len(chunks) < 3:
        print("Semantic chunking produced too few chunks, falling back to fixed chunking")
        return fixed_chunk_pages(pages)
    return chunks


def fixed_chunk_pages(pages: list, chunk_size: int = 1200, overlap: int = 150) -> list:
    chunks = []
    chunk_id = 0
    for page_num, page_text in enumerate(pages, start=1):
        page_text = page_text.strip()
        if not page_text:
            continue
        start = 0
        while start < len(page_text):
            chunk = page_text[start:start + chunk_size].strip()
            if chunk:
                chunks.append({"text": chunk, "chunk_id": chunk_id, "page": page_num, "is_heading": False})
                chunk_id += 1
            start += chunk_size - overlap
    return chunks


def hybrid_retrieve(question: str, idx, store: list, bm25: BM25Okapi, k: int = 8) -> tuple:
    k_each = min(k * 2, len(store))
    query_embedding = np.array(model.encode([question]))
    D, I = idx.search(query_embedding, k=k_each)
    faiss_indices = set(int(i) for i in I[0] if i >= 0)
    faiss_distances = {int(I[0][j]): float(D[0][j]) for j in range(len(I[0])) if I[0][j] >= 0}
    query_tokens = question.lower().split()
    bm25_scores = bm25.get_scores(query_tokens)
    bm25_top = np.argsort(bm25_scores)[::-1][:k_each]
    bm25_indices = set(int(i) for i in bm25_top if bm25_scores[i] > 0)
    all_indices = list(faiss_indices | bm25_indices)
    faiss_rank = {int(I[0][j]): j for j in range(len(I[0])) if I[0][j] >= 0}
    bm25_rank = {int(bm25_top[j]): j for j in range(len(bm25_top))}
    def rrf_score(idx_val, k_rrf=60):
        return 1 / (k_rrf + faiss_rank.get(idx_val, k_each)) + 1 / (k_rrf + bm25_rank.get(idx_val, k_each))
    all_indices.sort(key=lambda x: rrf_score(x), reverse=True)
    merged = all_indices[:k]
    faiss_dists = [faiss_distances[i] for i in merged if i in faiss_distances]
    avg_dist = float(np.mean(faiss_dists)) if faiss_dists else 999.0
    return merged, avg_dist


def rerank_chunks(question: str, candidate_indices: list, store: list, top_n: int = 5) -> tuple[list, list]:
    if not candidate_indices:
        return [], []
    pairs = [(question, store[i]["text"]) for i in candidate_indices if 0 <= i < len(store)]
    if not pairs:
        return candidate_indices[:top_n], [0.0] * min(top_n, len(candidate_indices))
    raw_scores = reranker.predict(pairs)
    scored = sorted(zip(candidate_indices, raw_scores), key=lambda x: x[1], reverse=True)
    top = scored[:top_n]
    return [idx for idx, _ in top], [float(s) for _, s in top]


class Query(BaseModel):
    question: str
    doc_id: Optional[str] = None
    k: Optional[int] = 8
    answer_style: Optional[str] = "detailed"
    temperature: Optional[float] = 0.3


class CompareQuery(BaseModel):
    question: str
    doc_id_a: str
    doc_id_b: str
    k: Optional[int] = 6
    answer_style: Optional[str] = "detailed"
    temperature: Optional[float] = 0.3


class SuggestQuery(BaseModel):
    question: str
    confidence_reason: str


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...), doc_id: str = Form(default="default")):
    global index, chunks_store
    reader = PdfReader(file.file)
    pages_text = [clean_page_text(page.extract_text() or "") for page in reader.pages]
    total_pages = len(pages_text)
    print(f"UPLOAD [{doc_id}]: {total_pages} pages")
    chunks = semantic_chunk_pages(pages_text)
    if not chunks:
        return {"status": "error", "chunks": 0}
    print(f"UPLOAD [{doc_id}]: {len(chunks)} semantic chunks created")
    texts = [c["text"] for c in chunks]
    embeddings = np.array(model.encode(texts, show_progress_bar=False))
    dimension = embeddings.shape[1]
    idx = faiss.IndexFlatL2(dimension)
    idx.add(embeddings)
    tokenized = [t.lower().split() for t in texts]
    bm25_index = BM25Okapi(tokenized)
    indexes[doc_id] = idx
    stores[doc_id] = chunks
    bm25s[doc_id] = bm25_index
    index = idx
    chunks_store = chunks
    keys_to_delete = [k for k in query_cache if k.startswith(doc_id[:8])]
    for k in keys_to_delete:
        del query_cache[k]
    print(f"UPLOAD [{doc_id}]: FAISS + BM25 indexed {len(chunks)} chunks across {total_pages} pages")
    return {"status": "indexed", "chunks": len(chunks), "pages": total_pages, "doc_id": doc_id}


@app.post("/ask")
async def ask(q: Query):
    doc_id = q.doc_id or "default"
    if doc_id in indexes:
        idx = indexes[doc_id]; store = stores[doc_id]; bm25 = bm25s.get(doc_id)
    elif index is not None:
        idx = index; store = chunks_store; bm25 = bm25s.get("default")
    else:
        return {"answer": "Please upload a PDF first.", "sources": [], "confidence": "low", "confidence_reason": "No document loaded"}

    cache_key = make_cache_key(doc_id, q.question, q.k or 8, q.answer_style or "detailed", q.temperature or 0.3)
    cached = cache_get(cache_key)
    if cached:
        print(f"CACHE HIT: '{q.question[:50]}…'")
        return {
            "answer": cached["answer"],
            "sources": cached["sources"],
            "confidence": cached["confidence"],
            "confidence_reason": cached.get("confidence_reason", ""),
            "cached": True,
            "retrieval_ms": 0,
            "rerank_ms": 0,
            "chunks_used": len(cached["sources"]),
        }

    print(f"QUESTION [{doc_id}]: {q.question} | k={q.k} | style={q.answer_style}")
    k = min(q.k or 8, len(store))

    t_retrieval_start = time.time()
    if bm25:
        candidate_indices, avg_distance = hybrid_retrieve(q.question, idx, store, bm25, k=k * 2)
    else:
        query_embedding = np.array(model.encode([q.question]))
        D, I = idx.search(query_embedding, k=k)
        candidate_indices = [int(i) for i in I[0] if i >= 0]
        valid_dists = [float(D[0][j]) for j in range(len(I[0])) if I[0][j] >= 0]
        avg_distance = float(np.mean(valid_dists)) if valid_dists else 999.0
    t_retrieval_ms = round((time.time() - t_retrieval_start) * 1000)

    if not candidate_indices:
        return {"answer": "I couldn't find relevant information.", "sources": [], "confidence": "low", "confidence_reason": "No candidates retrieved", "retrieval_ms": t_retrieval_ms, "rerank_ms": 0, "chunks_used": 0}

    t_rerank_start = time.time()
    top_indices, reranker_scores = rerank_chunks(q.question, candidate_indices, store, top_n=min(k, 5))
    t_rerank_ms = round((time.time() - t_rerank_start) * 1000)

    real_confidence = "high" if avg_distance < 0.8 else "medium" if avg_distance < 1.5 else "low"
    confidence_reason = (
        f"Strong match (distance {avg_distance:.2f})" if real_confidence == "high"
        else f"Partial match (distance {avg_distance:.2f}) — top passages have moderate relevance"
        if real_confidence == "medium"
        else f"Weak retrieval (distance {avg_distance:.2f}) — top scores below threshold"
    )

    print(f"HYBRID: {len(candidate_indices)} candidates | avg_distance={avg_distance:.3f} | retrieval={t_retrieval_ms}ms")
    print(f"RERANKER: Top {len(top_indices)} chunks | rerank={t_rerank_ms}ms | CONFIDENCE: {real_confidence}")
    active_store = stores.get(doc_id, chunks_store)
    print(f"PAGES: {[active_store[i]['page'] for i in top_indices if 0 <= i < len(active_store)]}")

    context_parts = []
    for i in top_indices:
        if 0 <= i < len(store):
            context_parts.append(f"[Page {store[i]['page']}]\n{store[i]['text']}")
    context = "\n\n".join(context_parts)

    style_instructions = {
        "concise": "Give a SHORT answer in 2-3 sentences maximum. Be direct.",
        "detailed": "Give a DETAILED structured answer with sections and citations.",
        "bullet": "Give your answer as BULLET POINTS only. Each point should cite a page number.",
    }.get(q.answer_style or "detailed", "Give a detailed structured answer.")

    prompt = f"""You are ScholarLens, an intelligent document analysis assistant.

RULES:
1. Use the provided context passages as your PRIMARY source
2. If the context contains relevant information, answer from it and cite page numbers like (Page 3)
3. If the context passages are insufficient but the question is clearly about the document, say what you can infer and note what's missing
4. Only say "not present" if the topic is genuinely unrelated to the document
5. {style_instructions}

Context:
{context}

Question: {q.question}"""

    try:
        response = await client.responses.create(model="gpt-4o-mini", input=prompt, temperature=q.temperature or 0.3)
        answer = response.output[0].content[0].text
    except Exception as e:
        print("LLM ERROR:", e)
        return {"answer": "Something went wrong. Please try again.", "sources": [], "confidence": "low", "confidence_reason": "LLM error", "retrieval_ms": t_retrieval_ms, "rerank_ms": t_rerank_ms, "chunks_used": 0}

    def sigmoid(x): return 1 / (1 + np.exp(-x))
    norm_scores = [float(sigmoid(s)) for s in reranker_scores]
    if len(norm_scores) > 1:
        min_s = min(norm_scores)
        max_s = max(norm_scores)
        if max_s > min_s:
            norm_scores = [(s - min_s) / (max_s - min_s) for s in norm_scores]

    sources = []
    for rank, i in enumerate(top_indices[:5]):
        if 0 <= i < len(store):
            score = norm_scores[rank] if rank < len(norm_scores) else 0.5
            tier = "most_relevant" if rank == 0 else "supporting" if score >= 0.45 else "low_confidence"
            sources.append({
                "text": store[i]["text"],
                "chunk_id": store[i]["chunk_id"],
                "page": store[i]["page"],
                "reranker_score": round(score, 3),
                "tier": tier,
            })

    cache_set(cache_key, answer, sources, real_confidence, confidence_reason)

    return {
        "answer": answer,
        "sources": sources,
        "confidence": real_confidence,
        "confidence_reason": confidence_reason,
        "retrieval_ms": t_retrieval_ms,
        "rerank_ms": t_rerank_ms,
        "chunks_used": len(top_indices),
    }


@app.post("/suggest")
async def suggest_queries(q: SuggestQuery):
    prompt = f"""A user asked this question to a RAG system for an academic paper:
"{q.question}"

The system returned low confidence because: {q.confidence_reason}

Generate exactly 3 alternative phrasings that would retrieve better results. Make them:
- More specific and academic
- Target different sections (methodology, contributions, results, limitations)
- Reframe the original intent in a way more likely to match document content

Return ONLY a JSON array of exactly 3 strings. No explanation, no markdown, no extra text.
Example: ["question 1", "question 2", "question 3"]"""

    try:
        response = await client.responses.create(model="gpt-4o-mini", input=prompt, temperature=0.4)
        text = response.output[0].content[0].text.strip()
        text = re.sub(r'^```[a-z]*\n?', '', text)
        text = re.sub(r'\n?```$', '', text)
        suggestions = json.loads(text.strip())
        if isinstance(suggestions, list) and len(suggestions) >= 3:
            return {"suggestions": suggestions[:3]}
        raise ValueError("Invalid format")
    except Exception as e:
        print(f"SUGGEST ERROR: {e}")
        fallbacks = [
            f"What methodology is used to address: {q.question}",
            f"What are the main contributions related to: {q.question}",
            f"What does the paper conclude about: {q.question}",
        ]
        return {"suggestions": fallbacks}


@app.post("/compare")
async def compare(q: CompareQuery):
    if q.doc_id_a not in indexes or q.doc_id_b not in indexes:
        missing = []
        if q.doc_id_a not in indexes: missing.append("Document A")
        if q.doc_id_b not in indexes: missing.append("Document B")
        return {"answer": f"{', '.join(missing)} not indexed yet.", "sources_a": [], "sources_b": [], "confidence": "low"}

    k = min(q.k or 6, min(len(stores[q.doc_id_a]), len(stores[q.doc_id_b])))
    bm25_a = bm25s.get(q.doc_id_a); bm25_b = bm25s.get(q.doc_id_b)

    if bm25_a:
        cands_a, dist_a = hybrid_retrieve(q.question, indexes[q.doc_id_a], stores[q.doc_id_a], bm25_a, k=k * 2)
    else:
        query_emb = np.array(model.encode([q.question]))
        D_a, I_a = indexes[q.doc_id_a].search(query_emb, k=k)
        cands_a = [int(i) for i in I_a[0] if i >= 0]
        dist_a = float(np.mean([float(D_a[0][j]) for j in range(len(I_a[0])) if I_a[0][j] >= 0]) or 999)

    if bm25_b:
        cands_b, dist_b = hybrid_retrieve(q.question, indexes[q.doc_id_b], stores[q.doc_id_b], bm25_b, k=k * 2)
    else:
        query_emb = np.array(model.encode([q.question]))
        D_b, I_b = indexes[q.doc_id_b].search(query_emb, k=k)
        cands_b = [int(i) for i in I_b[0] if i >= 0]
        dist_b = float(np.mean([float(D_b[0][j]) for j in range(len(I_b[0])) if I_b[0][j] >= 0]) or 999)

    top_a, _ = rerank_chunks(q.question, cands_a, stores[q.doc_id_a], top_n=k)
    top_b, _ = rerank_chunks(q.question, cands_b, stores[q.doc_id_b], top_n=k)

    avg_dist = (dist_a + dist_b) / 2
    real_confidence = "high" if avg_dist < 0.8 else "medium" if avg_dist < 1.5 else "low"

    def build_context(store, indices):
        return "\n\n".join([f"[Page {store[i]['page']}]\n{store[i]['text']}" for i in indices if 0 <= i < len(store)])

    context_a = build_context(stores[q.doc_id_a], top_a)
    context_b = build_context(stores[q.doc_id_b], top_b)
    style_instructions = {"concise": "Be brief.", "detailed": "Be detailed.", "bullet": "Use bullet points."}.get(q.answer_style or "detailed", "Be detailed.")

    prompt = f"""You are ScholarLens, comparing two documents side by side.
RULES:
1. Answer strictly from the context provided for each document
2. Cite page numbers like (Page 3) when referencing content
3. {style_instructions}
4. Structure your response EXACTLY as shown below

Document A Context:
{context_a}

Document B Context:
{context_b}

Question: {q.question}

Respond in this exact format:

**Document A:**
[Answer based only on Document A context]

**Document B:**
[Answer based only on Document B context]

**Key Differences:**
[Direct comparison highlighting what's different between the two documents]

**Similarity:**
[What both documents agree on or share]"""

    try:
        response = await client.responses.create(model="gpt-4o-mini", input=prompt, temperature=q.temperature or 0.3)
        answer = response.output[0].content[0].text
    except Exception as e:
        print("COMPARE LLM ERROR:", e)
        return {"answer": "Something went wrong during comparison.", "sources_a": [], "sources_b": [], "confidence": "low"}

    sources_a = [{"text": stores[q.doc_id_a][i]["text"], "page": stores[q.doc_id_a][i]["page"]} for i in top_a[:2] if 0 <= i < len(stores[q.doc_id_a])]
    sources_b = [{"text": stores[q.doc_id_b][i]["text"], "page": stores[q.doc_id_b][i]["page"]} for i in top_b[:2] if 0 <= i < len(stores[q.doc_id_b])]

    return {"answer": answer, "sources_a": sources_a, "sources_b": sources_b, "confidence": real_confidence}


@app.get("/cache/stats")
async def cache_stats():
    now = time.time()
    active = sum(1 for e in query_cache.values() if (now - e["ts"]) < CACHE_TTL)
    return {"total_entries": len(query_cache), "active_entries": active, "ttl_seconds": CACHE_TTL}

@app.delete("/cache/clear")
async def cache_clear():
    count = len(query_cache); query_cache.clear()
    return {"cleared": count}


class EvalItem(BaseModel):
    question: str
    expected_answer: str
    expected_pages: list[int]

class EvalRequest(BaseModel):
    doc_id: str
    dataset: list[EvalItem]
    k: Optional[int] = 8

@app.post("/evaluate")
async def evaluate(req: EvalRequest):
    doc_id = req.doc_id
    if doc_id not in indexes:
        return {"error": f"Document {doc_id} not indexed. Upload it first."}
    idx = indexes[doc_id]; store = stores[doc_id]; bm25 = bm25s.get(doc_id)
    results = []; total_retrieval = 0; total_similarity = 0.0; total_grounded = 0

    for item in req.dataset:
        print(f"EVAL: {item.question[:60]}…")
        k = min(req.k or 8, len(store))
        if bm25:
            candidate_indices, avg_distance = hybrid_retrieve(item.question, idx, store, bm25, k=k * 2)
        else:
            qe = np.array(model.encode([item.question]))
            D, I = idx.search(qe, k=k)
            candidate_indices = [int(i) for i in I[0] if i >= 0]
            avg_distance = float(np.mean([float(D[0][j]) for j in range(len(I[0])) if I[0][j] >= 0]) or 999)

        top_indices, _ = rerank_chunks(item.question, candidate_indices, store, top_n=min(k, 5))
        retrieved_pages = [store[i]["page"] for i in top_indices if 0 <= i < len(store)]
        retrieval_hit = any(p in retrieved_pages for p in item.expected_pages)
        if retrieval_hit: total_retrieval += 1

        context_parts = [f"[Page {store[i]['page']}]\n{store[i]['text']}" for i in top_indices if 0 <= i < len(store)]
        context = "\n\n".join(context_parts)
        prompt = f"""You are ScholarLens. Answer using ONLY the provided context.\n\nContext:\n{context}\n\nQuestion: {item.question}\n\nAnswer:"""

        actual_answer = ""
        try:
            response = await client.responses.create(model="gpt-4o-mini", input=prompt, temperature=0.1)
            actual_answer = response.output[0].content[0].text.strip()
        except Exception as e:
            print(f"EVAL LLM ERROR: {e}"); actual_answer = "ERROR"

        if actual_answer and actual_answer != "ERROR":
            expected_emb = model.encode([item.expected_answer]); actual_emb = model.encode([actual_answer])
            sim = float(np.dot(expected_emb[0], actual_emb[0]) / (np.linalg.norm(expected_emb[0]) * np.linalg.norm(actual_emb[0]) + 1e-9))
        else:
            sim = 0.0
        total_similarity += sim

        grounding_prompt = f"Does this answer use ONLY information from the context?\n\nContext:\n{context[:1500]}\n\nAnswer:\n{actual_answer[:500]}\n\nReply with exactly: GROUNDED or HALLUCINATED"
        grounded = False
        try:
            g_response = await client.responses.create(model="gpt-4o-mini", input=grounding_prompt, temperature=0.0)
            grounded = "GROUNDED" in g_response.output[0].content[0].text.strip().upper()
            if grounded: total_grounded += 1
        except: pass

        sim_label = "correct" if sim >= 0.75 else "partial" if sim >= 0.50 else "wrong"
        results.append({"question": item.question, "expected_answer": item.expected_answer, "actual_answer": actual_answer, "expected_pages": item.expected_pages, "retrieved_pages": retrieved_pages, "retrieval_hit": retrieval_hit, "similarity": round(sim, 3), "similarity_label": sim_label, "grounded": grounded})
        print(f"  → retrieval={'✓' if retrieval_hit else '✗'} | sim={sim:.3f} ({sim_label}) | grounded={grounded}")

    n = len(req.dataset)
    summary = {"total_questions": n, "retrieval_accuracy": round(total_retrieval/n, 3), "retrieval_accuracy_pct": round(total_retrieval/n*100, 1), "avg_answer_similarity": round(total_similarity/n, 3), "grounding_rate": round(total_grounded/n, 3), "grounding_rate_pct": round(total_grounded/n*100, 1), "correct_answers": sum(1 for r in results if r["similarity_label"] == "correct"), "partial_answers": sum(1 for r in results if r["similarity_label"] == "partial"), "wrong_answers": sum(1 for r in results if r["similarity_label"] == "wrong")}
    print(f"\nEVAL COMPLETE: retrieval={summary['retrieval_accuracy_pct']}% | sim={summary['avg_answer_similarity']} | grounding={summary['grounding_rate_pct']}%")
    return {"results": results, "summary": summary}