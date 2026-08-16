export interface PromptPreset {
  id: string;
  title: string;
  type: "question" | "jozve";
  preview: string;
  template: string;
}

export const PROMPT_PRESETS: PromptPreset[] = [
  {
    id: "question-range",
    title: "Question Analysis (Range Based)",
    type: "question",
    preview: "Analyze specific question ranges with stem, option breakdown, and concept summaries.",
    template: `You are an expert medical examiner specializing in medical education.

Your task is to analyze questions {start} to {end} in the order they appear in the pasted text using ONLY the uploaded source file.

Important:
1. Reproduce the complete question stem exactly as written.
2. If part of the question is unreadable or ambiguous, explicitly mention it.
3. For each question:
   - Write the complete question stem.
   - Determine the single best answer based strictly on the uploaded notes.
   - Do NOT use external knowledge unless explicitly stated in the notes.
   - For every option (A, B, C, D), explain why it is correct or incorrect.
4. Output Format:
   Questions {start}-{end}
   Question Stem: [Exact text]
   Options: A) ... B) ... C) ... D) ...
   Correct Option: ...
   Option Analysis: [Analysis for each option]
   Concept Summary: [3-7 lines educational summary]`
  },
  {
    id: "question-order",
    title: "Question Analysis (Order Based)",
    type: "question",
    preview: "Batch-by-batch question stem verification, option analysis, and distractor checks.",
    template: `You are an expert medical examiner specializing in exam preparation.

Your task is to analyze batch {index} of {batch} questions in exact order using ONLY the uploaded source materials.

Requirements:
- Reproduce stem and all options (A, B, C, D).
- Identify best answer strictly from notes.
- Explain correct and incorrect choices with scientific precision.
- Flag flaws, ambiguity, or unreadable stems as "متن واضح نیست".
- Provide short Concept Summary after each question.`
  },
  {
    id: "jozve-condensed",
    title: "Jozve - High-Yield Condensed Notes",
    type: "jozve",
    preview: "Lossless medical knowledge compression into structured study notes for topic.",
    template: `You are an expert medical education content synthesizer.

Your task is to transform the provided medical materials into HIGH-YIELD CONDENSED NOTES for topic [{topic}] using ONLY:
1. Lecture notes (primary source)
2. Previous exam questions
3. Correct answers & detailed explanations

OBJECTIVE:
Produce a condensed study booklet preserving all exam-relevant knowledge with lossless compression (40-60% target length).

OUTPUT STRUCTURE per topic:
# Topic
## High-Yield Notes (Bullets, Tables, Flowcharts)
### 🔥 Exam Focus
### 📊 Comparison Table
### ⚠️ Confusion Alert (قاطی نشه !)
### 🚨 Exam Traps (تله‌های امتحان)
### 💡 Hidden High-Yield Facts
### 🔮 Likely Future Questions

Formatting: Bullet points, bold keywords, tables, callout boxes. Output in Persian.`
  },
  {
    id: "jozve-detailed",
    title: "Jozve - Topic Based Detailed",
    type: "jozve",
    preview: "In-depth lossless compression organized by topic headings and exam priorities.",
    template: `You are an expert medical content synthesizer.

Create lossless condensed study notes for topic [{topic}].

Rules:
- Use ONLY provided materials.
- No external facts or hallucinations.
- Merge duplicate concepts across lectures and past exams.
- Highlight core ideas (🔥 Core, ⭐ Frequently Tested, ✓ Important).
- Include visual structures, cause-effect relationships, and memory aids where appropriate.

Output in Persian.`
  },
  {
    id: "jozve-night-before",
    title: "Jozve - Night-Before-Exam Summary",
    type: "jozve",
    preview: "Rapid revision summary focusing on core exam points, confusion alerts, and traps.",
    template: `You are an expert medical exam preparation specialist.

Create a HIGH-YIELD NIGHT-BEFORE-EXAM SUMMARY for topic [{topic}].

Objective: Maximize score while minimizing reading time (20-30% original length).

Structure:
# [{topic}]
## High-Yield Summary
## Exam Focus (🔥 نکات اصلی / ⭐ موردعلاقه اساتید)
## Similar Concepts
## Comparison Tables
## ⚠️ قاطی نشه !
## 🚨 تله های امتحان
## 🔮 نکات با اهمیت بالا

Output in Persian.`
  }
];

export function getPromptByTitle(title: string): PromptPreset | undefined {
  return PROMPT_PRESETS.find(p => p.title.toLowerCase() === title.toLowerCase());
}
