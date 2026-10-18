"use client";

import { useState } from "react";
import { useLanguage } from "@/app/context/LanguageContext";
import LanguageSelector from "@/app/components/LanguageSelector";

export default function Home() {
  const { t, dir } = useLanguage();
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
    <main dir={dir} className="main">
      <div className="absolute top-4 right-4">
        <LanguageSelector isDark={false} />
      </div>
      <form onSubmit={handleSubmit} className="form">
        <input
          type="text"
          dir="ltr"
          value={noteBookUrl}
          onChange={(e) => setNoteBookUrl(e.target.value)}
          placeholder={t.crud.notebookUrlPlaceholder}
          className="input"
        />

        <button type="submit" className="button">
          {t.crud.submit}
        </button>

        {result && <p className="result">{t.crud.responsePrefix}{result}</p>}
      </form>
    </main>
  );
}