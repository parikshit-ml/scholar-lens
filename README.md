# ScholarLens 🔍📄

**A hybrid-retrieval RAG system for grounded Q&A over academic papers — with built-in evaluation, provenance tracking, and hallucination guardrails.**

[![Live Demo](https://img.shields.io/badge/Live_Demo-try--scholarlens.vercel.app-blue?style=flat-square)](https://try-scholarlens.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-Hugging_Face_Spaces-yellow?style=flat-square)](https://LordMorata-scholarlens-backend.hf.space)
[![Python](https://img.shields.io/badge/Python-FastAPI-009688?style=flat-square)]()
[![Frontend](https://img.shields.io/badge/Frontend-Next.js_15-black?style=flat-square)]()
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

> Upload a research paper. Ask questions. Get answers that are **grounded in the source**, with full retrieval provenance showing *why* each chunk was selected.

**[🚀 Try it live](https://try-scholarlens.vercel.app)** — *Note: the backend runs on Hugging Face Spaces free tier, so the first request after inactivity takes ~1–2 minutes to cold-start.*

---

## Why ScholarLens?

Most RAG demos stop at "chunk → embed → retrieve → generate." ScholarLens is built around the questions that actually matter in production:

- **Did retrieval find the right passage?** → Hybrid dense + sparse retrieval with rank fusion
- **Which candidates actually matter?** → Cross-encoder reranking on top of first-stage retrieval
- **Is the answer actually supported by the paper?** → LLM-based grounding verification
- **Can we prove it?** → Per-chunk retrieval provenance (FAISS rank, BM25 rank, reranker delta, selection reason)
- **Does it know what it doesn't know?** → Confidence gating that refuses out-of-scope questions instead of hallucinating

---

## Architecture

```
                          ┌──────────────────────────────────────┐
                          │            INGESTION                 │
   PDF Upload ──► PyPDF2 parse ──► text cleaning ──► heading-aware
                                                     semantic chunking
                                                          │
                                          ┌───────────────┴───────────────┐
                                          ▼                               ▼
                                  ┌───────────────┐               ┌───────────────┐
                                  │  FAISS Index   │               │  BM25 Index   │
                                  │ (IndexFlatL2,  │               │  (BM25Okapi)  │
                                  │ all-MiniLM-L6) │               │               │
                                  └───────┬───────┘               └───────┬───────┘
                                          │                               │
                          ┌───────────────┴───────────────────────────────┘
                          │            RETRIEVAL
   User Query ──► dense search + sparse search ──► Reciprocal Rank Fusion (RRF)
                                                          │
                                                          ▼
                                          Cross-Encoder Reranking
                                          (ms-marco-MiniLM-L-6-v2)
                                                          │
                                                          ▼
                                  Confidence gate (avg distance threshold)
                                   │ low confidence → scoped refusal
                                   ▼
                          ┌──────────────────────────────────────┐
                          │            GENERATION                │
                          │  gpt-4o-mini + assembled context     │
                          │  → answer + source citations         │
                          │  → grounding verification pass       │
                          └──────────────────────────────────────┘
```

**Pipeline in one sentence:** heading-aware chunks are indexed in parallel by FAISS (semantic) and BM25 (lexical), fused via Reciprocal Rank Fusion, reranked by a cross-encoder, gated by retrieval confidence, and only then passed to the LLM — whose answer is verified against the source before being shown.

---

## Key Features

### 🔀 Hybrid Retrieval with Rank Fusion
Dense semantic search (`all-MiniLM-L6-v2` embeddings + FAISS) runs in parallel with sparse keyword search (`BM25Okapi`). Results are merged with **Reciprocal Rank Fusion**, so the system catches both paraphrased concepts *and* exact terminology (equations, acronyms, author names) that pure vector search misses.

### 🎯 Cross-Encoder Reranking
First-stage candidates are re-scored by `ms-marco-MiniLM-L-6-v2`, which reads the query and chunk *together* — far more precise than bi-encoder similarity alone.

### 🧾 Retrieval Provenance
Every retrieved chunk carries its full audit trail: FAISS rank, BM25 rank, reranker score delta, and a human-readable **selection reason**. You can see exactly why the system chose each passage.

### ✅ Grounding Verification
A dedicated verification pass checks whether the generated answer is actually supported by the retrieved context (paraphrase-aware, evaluated against up to 6,000 characters of source context) — flagging answers that drift from the paper.

### 🚧 Scope Guardrails
Two-tier defense against off-topic hallucination: a prompt-level refusal instruction, plus a **retrieval confidence gate** — if average retrieval distance exceeds threshold, the system declines to answer rather than guessing.

### 📊 Built-in Evaluation Harness
An `/evaluate` endpoint and dedicated eval panel run benchmark question sets against uploaded papers, measuring retrieval accuracy, answer similarity, and grounding rate.

---

## Evaluation Results

Benchmarked on **60 questions across 5 papers** (Attention Is All You Need, DPR, RAG, DistilBERT, and a RAG-assisted LLM distillation paper):

| Metric | Result |
|---|---|
| Retrieval accuracy | **93%** |
| Average answer similarity | **0.74** |
| Grounding rate | **82%** |

*All metrics from the built-in evaluation harness — reproducible via the eval panel.*

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python, FastAPI |
| **Embeddings** | `all-MiniLM-L6-v2` (SentenceTransformers) |
| **Dense index** | FAISS (`IndexFlatL2`) |
| **Sparse index** | BM25 (`BM25Okapi`) |
| **Fusion** | Reciprocal Rank Fusion |
| **Reranker** | `ms-marco-MiniLM-L-6-v2` (cross-encoder) |
| **LLM** | `gpt-4o-mini` (OpenAI API) |
| **PDF parsing** | PyPDF2 + custom text cleaning |
| **Frontend** | Next.js 15, React 19, TypeScript, shadcn/ui |
| **Deployment** | Hugging Face Spaces (backend) · Vercel (frontend) |

---

## Running Locally

### Backend

```bash
# clone
git clone https://github.com/parikshit-ml/scholar-lens.git
cd scholar-lens/backend

# environment
conda create -n rag_env python=3.11 -y
conda activate rag_env
pip install -r requirements.txt

# secrets — create backend/.env
echo "OPENAI_API_KEY=sk-..." > .env

# run
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd scholar-lens/frontend
npm install
npm run dev
# open http://localhost:3000
```

> Set the backend URL in the frontend env config if running against a non-default port.

---

## Project Structure

```
scholar-lens/
├── backend/
│   ├── main.py            # FastAPI app: ingestion, retrieval, generation, /evaluate
│   ├── requirements.txt
│   └── .env               # OPENAI_API_KEY (never committed)
├── frontend/
│   ├── app/               # Next.js app router, three-panel interface
│   ├── components/        # left / middle / right / eval panels (shadcn/ui)
│   └── ...
└── README.md
```

---

## Roadmap

- [ ] Automatic query reformulation on low-confidence retrieval
- [ ] Multi-paper cross-document Q&A
- [ ] Swappable vector store backends (ChromaDB, pgvector)
- [ ] Streaming responses

---

## Author

**Parikshit Bhardwaj** — M.Tech, Signal Processing & Machine Learning, NIT Jalandhar

- GitHub: [@parikshit-ml](https://github.com/parikshit-ml)
- LinkedIn: [parikshit-bhardwaj-ml](https://linkedin.com/in/parikshit-bhardwaj-ml)
- Email: parikshitbhardwaj3917@gmail.com

Related research: *RAG-Assisted LLM Compression and Knowledge Distillation for On-Device Deployment* (first-author publication).
