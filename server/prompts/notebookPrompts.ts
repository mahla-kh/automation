export interface PromptPreset {
  id: string;
  title: string;
  type: "question" | "jozve";
  preview: string;
  template: string;
}
let start = 1;
let end = 20;
let index = 20;
let batch = 20;
let Topics = [] as string[]

const PROMPT_TEMPLATE_START_END = `You are an expert medical [anatomy] examiner specializing.

Your task is to analyze questions ${start} to ${end} in the order they appear in the pasted text [Questions.txt] using ONLY the uploaded source files.
Important:

Before analyzing the options, ALWAYS reproduce the complete question stem exactly as written in the question file.

If part of the question is unreadable, incomplete, or ambiguous, explicitly mention it.
For each question:
Write the complete question stem.
Determine the single best answer based strictly on the uploaded notes.
try not  to use external knowledge unless explicitly stated in the notes.
If none of the options is fully correct, state this clearly.

If multiple options appear correct according to the notes, state this clearly.
For every option (A, B, C, D):
Explain why the option is correct or incorrect.

Keep explanations concise but scientifically precise.

If the stem or options contain a flaw, explicitly describe the flaw.

If the question cannot be resolved confidently from the uploaded notes:

Do NOT invent an answer.
Mark:

متن واضح نیست

Do NOT delete questions.

Even if a question is flawed, incomplete, or ambiguous, analyze it and explain the problem.

For each question, identify the most relevant source topic from the notes.
Requirements:
Use the terminology and headings found in the notes whenever possible.

Output format:

Questions 1
Question Stem

[Write the complete question text here exactly as it appears in the file]
Options
A) ..
B) .
C) ...
D) ...
Correct Option
C) ...
Option Analysis
A) ...
Correct / Incorrect
Explanation:
B) ...
Correct / Incorrect
Explanation:
C) ...
Correct / Incorrect
Explanation:
D) ...
Correct / Incorrect

Explanation:
Repeat the same format for questions ${start}-${end} only.
Ensure all conclusions are fully aligned with the uploaded  [parasitology ]notes and preserve the original terminology whenever possible.

Concept Summary

After completing the option analysis for each question, write a short educational summary based ONLY on the uploaded notes.

Requirements:
Length: approximately 3–7 lines.

Stay strictly within the scope of the uploaded notes.

Do not introduce external knowledge.

Focus on helping the student review the tested concept rather than repeating the explanation of the correct option.

The summary should preferably include one of the following:

A concise collection of the most important facts related to the tested concept.

A comparison between closely related anatomical structures.

Key distinguishing features.

Commonly confused structures.

Functional relationships.

High-yield exam points mentioned in the notes.

Avoid simply repeating the option analysis.

Avoid repetition

Maintain awareness of previous summaries.

If an earlier question has already explained the same concept in sufficient detail:
Do NOT repeat the same explanation.

Instead, introduce another important aspect of that topic from the notes.

If no additional information exists in the notes, write:
"این مبحث در سوالات قبل به طور کامل جمع‌بندی شده است."
Output position
Insert the summary immediately after the Option Analysis section.
Example:
Concept Summary

OPTION COMPLETION RULE (VERY IMPORTANT)

If a question does NOT have exactly 4 options:

Keep all existing options exactly as they are.

Do NOT rewrite or modify them.

Complete missing options (A, B, C, D) ONLY if fewer than 4 options exist.

The missing options must be:

Strictly based on the uploaded source files

Consistent with the same topic and difficulty level of the question

Plausible exam-style distractors (not random text)

You MUST NOT introduce external knowledge beyond the provided notes.
answer in persion `
const PROMPT_TEMPLATE_QUESTION_ORDER = `You are an expert medical [anatomy] examiner specializing.

Your task is to analyze ${index + 1}th ${batch} questions in the order they appear in the pasted text [Questions.txt] using ONLY the uploaded source file [کلیات پاتولوژی اکبری مهر99].
Important:

Before analyzing the options, ALWAYS reproduce the complete question stem exactly as written in the question file.

If part of the question is unreadable, incomplete, or ambiguous, explicitly mention it.
For each question:
Write the complete question stem.
Determine the single best answer based strictly on the uploaded notes.
try not  to use external knowledge unless explicitly stated in the notes.
If none of the options is fully correct, state this clearly.

If multiple options appear correct according to the notes, state this clearly.
For every option (A, B, C, D):
Explain why the option is correct or incorrect.

Keep explanations concise but scientifically precise.

If the stem or options contain a flaw, explicitly describe the flaw.

If the question cannot be resolved confidently from the uploaded notes:

Do NOT invent an answer.
Mark:

متن واضح نیست

Do NOT delete questions.

Even if a question is flawed, incomplete, or ambiguous, analyze it and explain the problem.

For each question, identify the most relevant source topic from the notes.
Requirements:
Use the terminology and headings found in the notes whenever possible.

Output format:

Questions 1
Question Stem

[Write the complete question text here exactly as it appears in the file]
Options
A) ..
B) .
C) ...
D) ...
Correct Option
C) ...
Option Analysis
A) ...
Correct / Incorrect
Explanation:
B) ...
Correct / Incorrect
Explanation:
C) ...
Correct / Incorrect
Explanation:
D) ...
Correct / Incorrect

Explanation:
Repeat the same format for ${index + 1}th questions only.
Ensure all conclusions are fully aligned with the uploaded  [parasitology ]notes and preserve the original terminology whenever possible.

Concept Summary

After completing the option analysis for each question, write a short educational summary based ONLY on the uploaded notes.

Requirements:
Length: approximately 3–7 lines.

Stay strictly within the scope of the uploaded notes.

Do not introduce external knowledge.

Focus on helping the student review the tested concept rather than repeating the explanation of the correct option.

The summary should preferably include one of the following:

A concise collection of the most important facts related to the tested concept.

A comparison between closely related anatomical structures.

Key distinguishing features.

Commonly confused structures.

Functional relationships.

High-yield exam points mentioned in the notes.

Avoid simply repeating the option analysis.

Avoid repetition

Maintain awareness of previous summaries.

If an earlier question has already explained the same concept in sufficient detail:
Do NOT repeat the same explanation.

Instead, introduce another important aspect of that topic from the notes.

If no additional information exists in the notes, write:
"این مبحث در سوالات قبل به طور کامل جمع‌بندی شده است."
Output position
Insert the summary immediately after the Option Analysis section.
Example:
Concept Summary

OPTION COMPLETION RULE (VERY IMPORTANT)

If a question does NOT have exactly 4 options:

Keep all existing options exactly as they are.

Do NOT rewrite or modify them.

Complete missing options (A, B, C, D) ONLY if fewer than 4 options exist.

The missing options must be:

Strictly based on the uploaded source file [ "کلیات پاتولوژی اکبری مهر99"]

Consistent with the same topic and difficulty level of the question

Plausible exam-style distractors (not random text)

You MUST NOT introduce external knowledge beyond the provided notes.
answer in persion `
const PROMPT_TEMPLATE_JOZVEv2 = `You are an expert medical education content synthesizer and exam preparation specialist.

Your task is to transform the provided medical materials into HIGH-YIELD CONDENSED NOTES for topic [TOPIC_HERE] using ONLY:

1. Lecture notes (primary source)
2. Previous exam questions
3. Correct answers
4. Detailed explanations

EXAMIN ONLY the ${index + 1}th ${batch} pages

OBJECTIVE

Produce a condensed study booklet that preserves nearly all exam-relevant knowledge while reducing the original content as much as possible without losing any scientific fact or exam-relevant concept. Target approximately 40–60% of the original length.

The goal is NOT summarization.
The goal is lossless compression of medical knowledge.

1. GENERAL RULES

• Use ONLY the provided materials.
• Never use external knowledge.
• Never invent facts.
• Preserve every scientific fact.
• Remove redundancy, not information.
• Merge duplicated content across sources.
• Avoid repeating information between chapters; cross-reference instead when appropriate.
• Remove introductory, conversational and textbook-style wording.
• Remove obvious facts already expected from a medical student.
• Remove examples used only for explanation.
• Preserve clinically important cases and high-yield examples.
• Compress wording without reducing conceptual clarity.

2. ANALYSIS (Silent)

Before writing, silently determine:

• Frequently tested concepts
• Commonly confused concepts
• Highly emphasized topics
• Important facts hidden inside explanations
• Cause-effect relationships
• Natural comparisons and classifications

Do NOT output this analysis.

3. OUTPUT

Organize notes according to the provided main topics.

For each topic:

# Topic

## High-Yield Notes

• One core idea per paragraph.
• Prefer bullet points over prose.
• Convert suitable information into tables, lists or flowcharts instead of paragraphs.
• Convert cause→effect relationships, classifications and diagnostic pathways into visual structures whenever possible.

Include when appropriate:

### 🔥 Exam Focus
Frequently tested or emphasized concepts.

### 📊 Comparison Table
Whenever concepts are easily confused or naturally compared.

### ⚠️ Confusion Alert
Frequently confused concepts, opposite facts, similar terminology and common MCQ traps.

### 🚨 Exam Traps
Distractors appearing in previous exams or strongly implied by the notes.

### 💡 Hidden High-Yield Facts
Important information found inside explanations but not directly asked.

### 🔮 Likely Future Questions
Highly testable concepts inferred from emphasized sections.

### 🧠 Memory Aid
Very short associations only when they genuinely improve recall.

4. FORMATTING

Prefer:

• Bullet lists
• Tables
• Flowcharts
• Small callout boxes

Avoid long paragraphs.

Highlight keywords only.

Tag important information with:

🔥 Core
⭐ Frequently Tested
✓ Important
ℹ️ Supplementary

5. QUALITY CHECK (Silent)

Verify that:

✓ Nearly all concepts from the lecture notes are preserved.
✓ Information density is significantly improved.
✓ No scientific facts were removed.
✓ Redundant explanations were eliminated.
✓ Similar concepts are compared.
✓ Confusing concepts are explicitly distinguished.
✓ Cause-effect relationships are visualized when possible.
✓ Final length is approximately 50% of the original while maintaining near-complete conceptual coverage.

Output only the final condensed notes in persion .`
const PROMPT_TEMPLATE_JOZVE_topicBased_long = `You are an expert medical education content synthesizer and exam preparation specialist.

Your task is to transform the provided medical materials into HIGH-YIELD CONDENSED NOTES for topic ${Topics[index]} using ONLY:

1. Lecture notes (primary source)
2. Previous exam questions
3. Correct answers
4. Detailed explanations

OBJECTIVE

Produce a condensed study booklet that preserves nearly all exam-relevant knowledge while reducing the original content as much as possible without losing any scientific fact or exam-relevant concept. Target approximately 40–60% of the original length.

The goal is NOT summarization.
The goal is lossless compression of medical knowledge.

1. GENERAL RULES

• Use ONLY the provided materials.
• Never use external knowledge.
• Never invent facts.
• Preserve every scientific fact.
• Remove redundancy, not information.
• Merge duplicated content across sources.
• Avoid repeating information between chapters; cross-reference instead when appropriate.
• Remove introductory, conversational and textbook-style wording.
• Remove obvious facts already expected from a medical student.
• Remove examples used only for explanation.
• Preserve clinically important cases and high-yield examples.
• Compress wording without reducing conceptual clarity.

2. ANALYSIS (Silent)

Before writing, silently determine:

• Frequently tested concepts
• Commonly confused concepts
• Highly emphasized topics
• Important facts hidden inside explanations
• Cause-effect relationships
• Natural comparisons and classifications

Do NOT output this analysis.

3. OUTPUT

Organize notes according to the provided main topics.

For each topic:

# Topic

## High-Yield Notes

• One core idea per paragraph.
• Prefer bullet points over prose.
• Convert suitable information into tables, lists or flowcharts instead of paragraphs.
• Convert cause→effect relationships, classifications and diagnostic pathways into visual structures whenever possible.

Include when appropriate:

### 🔥 Exam Focus
Frequently tested or emphasized concepts.

### 📊 Comparison Table
Whenever concepts are easily confused or naturally compared.

### ⚠️ Confusion Alert
Frequently confused concepts, opposite facts, similar terminology and common MCQ traps.

### 🚨 Exam Traps
Distractors appearing in previous exams or strongly implied by the notes.

### 💡 Hidden High-Yield Facts
Important information found inside explanations but not directly asked.

### 🔮 Likely Future Questions
Highly testable concepts inferred from emphasized sections.

### 🧠 Memory Aid
Very short associations only when they genuinely improve recall.

4. FORMATTING

Prefer:

• Bullet lists
• Tables
• Flowcharts
• Small callout boxes

Avoid long paragraphs.

Highlight keywords only.

Tag important information with:

🔥 Core
⭐ Frequently Tested
✓ Important
ℹ️ Supplementary

5. QUALITY CHECK (Silent)

Verify that:

✓ Nearly all concepts from the lecture notes are preserved.
✓ Information density is significantly improved.
✓ No scientific facts were removed.
✓ Redundant explanations were eliminated.
✓ Similar concepts are compared.
✓ Confusing concepts are explicitly distinguished.
✓ Cause-effect relationships are visualized when possible.
✓ Final length is approximately 50% of the original while maintaining near-complete conceptual coverage.

Output only the final condensed notes in persion .`
const PROMPT_TEMPLATE_JOZVE_topicBased_shabEmtehan = `You are an expert medical education content synthesizer and exam preparation specialist.

Your task is to create a HIGH-YIELD NIGHT-BEFORE-EXAM SUMMARY for topic ${Topics[index]} using ONLY the following sources:

1. Lecture notes (primary source)
2. Previous exam questions
3. Correct answers
4. Detailed explanations for each question

Your objective is to maximize the student's exam score while minimizing reading time.

1.GENERAL RULES


• Use ONLY the provided materials.
• Never use external medical knowledge.
• Never invent facts.
• Merge duplicate information from different sources.
• Rewrite everything into concise exam-focused language.

2.ANALYSIS PHASE

Before writing the summary, silently analyze all provided materials.

For every concept determine:

- How often it appears in previous exams
- Whether it is commonly confused with another concept
- Which surrounding concepts are likely to become future questions

Use this analysis to determine importance.

Do NOT output this analysis.

3.OUTPUT STRUCTURE

Organize the booklet according to the provided main topics.

For each topic generate:

# Topic Name

## High-Yield Summary

Write only the essential concepts needed for the exam.

Avoid unnecessary textbook explanations.


## Exam Focus

Include concepts that:

• appeared multiple times

• were strongly emphasized

• were explained in detail

• represent favorite examiner topics

Mark them using:

🔥 نکات اصلی

⭐ موردعلاقه اساتید


## Similar Concepts

Identify concepts in the same chapter that were NOT directly asked but are highly related and likely to become exam questions.


## Comparison Tables

Whenever two or more concepts are similar, create concise comparison tables.

Examples:

Structure vs Structure

Disease vs Disease

Enzyme vs Enzyme

Embryological derivatives

Histology differences

Never create unnecessary tables.


## Common Confusions

Generate a section called

⚠️ قاطی نشه !

Include:

Frequently confused facts

Very similar terms

Opposite concepts

Common MCQ traps

Mnemonic-level distinctions


## Exam Traps

Generate a section called

🚨 تله های امتحان

Include distractors that appeared in previous exams.

Also infer new likely distractors from the lecture notes.

Examples:

Often confused with...

## Extra Facts Hidden in Explanations

Many explanations contain valuable information that was not directly asked.

Extract those facts.

Include only high-yield information.


## Possible Future Questions

Infer concepts that were not directly tested but belong to highly tested sections.

Mark them as

🔮نکات با اهمیت بالا 

Briefly explain why.


## Memory Aids

Whenever appropriate generate:

One-sentence associations

Only if they improve recall.
Do NOT overdo it

FORMATTING RULES

Use:

• Bullet points

• Bold keywords

• Tables

• Small callout boxes

Avoid long paragraphs.

Keep every explanation concise.

Optimize for fast revision.


4.IMPORTANCE TAGS

Tag every important fact using one of:

🔥 نکات اصلی

⭐  موردعلاقه اساتید

✓ مهم

ℹ️ تکمیلی


5.COVERAGE REQUIREMENT

The final summary must cover nearly every important concept contained in the lecture notes while remaining approximately 20–30% of the original content length.

compress information while preserving all exam-relevant knowledge.


6.QUALITY CHECK (Perform silently)

Before finishing verify that:

✓ Every major topic and frequently tested concept is covered.

✓ Similar concepts are compared.

✓ Exam traps are listed.

✓ Likely future questions are inferred.

Output only the final exam summary.`
export const PROMPT_PRESETS: PromptPreset[] = [
  {
    id: "question-range",
    title: "Question Analysis (Range Based)",
    type: "question",
    preview: "Analyze specific question ranges with stem, option breakdown, and concept summaries.",
    template: PROMPT_TEMPLATE_START_END
  },
  {
    id: "question-order",
    title: "Question Analysis (Order Based)",
    type: "question",
    preview: "Batch-by-batch question stem verification, option analysis, and distractor checks.",
    template: PROMPT_TEMPLATE_QUESTION_ORDER
  },
  {
    id: "jozve-condensed",
    title: "Jozve - (V2)",
    type: "jozve",
    preview: "Lossless medical knowledge compression into structured study notes for topic.",
    template: PROMPT_TEMPLATE_JOZVEv2
  },
  {
    id: "jozve-detailed",
    title: "Jozve - Topic Based Detailed",
    type: "jozve",
    preview: "In-depth lossless compression organized by topic headings and exam priorities.",
    template: PROMPT_TEMPLATE_JOZVE_topicBased_long
  },
  {
    id: "jozve-night-before",
    title: "Jozve - Night-Before-Exam Summary",
    type: "jozve",
    preview: "Rapid revision summary focusing on core exam points, confusion alerts, and traps.",
    template: PROMPT_TEMPLATE_JOZVE_topicBased_shabEmtehan
  }
];

export function getPromptByTitle(title: string): PromptPreset | undefined {
  return PROMPT_PRESETS.find(p => p.title.toLowerCase() === title.toLowerCase());
}
