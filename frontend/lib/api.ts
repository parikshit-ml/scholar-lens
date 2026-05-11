const BASE_URL = "http://127.0.0.1:8005";

// Upload PDF
export const uploadPDF = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE_URL}/upload`, {
    method: "POST",
    body: formData,
  });

  return res.json();
};

// Ask question
export const askQuestion = async (question: string) => {
  const res = await fetch(`${BASE_URL}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question }),
  });

  return res.json();
};