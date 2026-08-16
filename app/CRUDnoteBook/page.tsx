"use client";

import { useState } from "react";

export default function Home() {
  const [noteBookUrl, setNoteBookUrl] = useState("");
  const [batch, setBatch] = useState(15);
  const [qLength, setQLength] = useState(100);
  const [result, setResult] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const response = await fetch("http://localhost:4000/api/CRUDnotebook/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        noteBookUrl,
        batch,
        qLength,
      }),
    });

    const data = await response.json();

    setResult(data.jobId);
  }

  return (
    <main className="main">
      <form onSubmit={handleSubmit} className="form">
        <input
          type="text"
          value={noteBookUrl}
          onChange={(e) => setNoteBookUrl(e.target.value)}
          placeholder="آدرس نوت‌بوک را وارد کنید"
          className="input"
        />

        <button type="submit" className="button">
          ارسال
        </button>

        {result && <p className="result">پاسخ بک‌اند: {result}</p>}
      </form>
    </main>
  );
}