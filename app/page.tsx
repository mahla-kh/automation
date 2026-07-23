"use client";

import { useState } from "react";

export default function Home() {
  const [text, setText] = useState("");
  const [result, setResult] = useState("");

  async function handleSubmit(e : React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const response = await fetch("http://localhost:4000/api/pipelines/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        folderUrl: text,
      }),
    });

    const data = await response.json();

    setResult(data.jobId);
  }

  return (
  <main className="container">
  <form onSubmit={handleSubmit} className="form">
    <input
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder="آدرس درایو را وارد کنید"
      className="input"
    />

    <button
      type="submit"
      className="button"
    >
      ارسال
    </button>

    {result && (
      <p>
        پاسخ بک‌اند: {result}
      </p>
    )}
  </form>
</main>
  );
}