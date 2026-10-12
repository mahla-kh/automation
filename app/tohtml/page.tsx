"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { parseCutSections, ParsedSection } from "@/server/lib/cutParser";
import { splitByLines } from "@/server/lib/splitByLines";

export type SectionStatus = "pending" | "processing" | "completed" | "failed";

export interface SectionDetail {
  id: string;
  index: number;
  sectionIndex?: number;
  marker: string;
  markerNumber: number | null;
  chunkIndex?: number;
  chunkNumber?: number;
  totalChunks?: number;
  label?: string;
  content: string;
  charCount: number;
  lineCount?: number;
  status: SectionStatus;
  outputFilename?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export interface JobLog {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  sectionIndex?: number;
  marker?: string;
  error?: string;
}

export interface JobSummaryStats {
  total: number;
  completed: number;
  processing: number;
  failed: number;
  pending: number;
  avgDurationMs: number;
}

export interface ToHtmlJobResponse {
  id: string;
  fileName: string;
  folderName: string;
  prompt: string;
  status: "queued" | "processing" | "completed" | "failed";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  sections: SectionDetail[];
  logs: JobLog[];
  summary: JobSummaryStats;
}

export interface JobListItem {
  id: string;
  fileName: string;
  status: string;
  createdAt: string;
  totalSections: number;
  completedSections: number;
  failedSections: number;
}

const DEFAULT_PROMPT = `You are an expert HTML document designer specializing in professional medical study booklets.

Your task is to convert the provided medical study text into a modern, highly readable, print-ready HTML document optimized for A4 PDF export.

The objective is NOT to create a website.

The objective is to create a premium printable medical study booklet that uses the EXACT HTML STRUCTURE and VISUAL TEMPLATE defined below, while intelligently inserting and organizing the provided text inside that structure.

IMPORTANT:
The provided "SOURCE TEXT" is the content that must be inserted into the HTML template.
The provided "HTML TEMPLATE" is the required structural and visual pattern.

Do NOT treat the example content inside the template as real source content.
Do NOT copy the medical content from the template.
Replace all example/template text with the corresponding information from the SOURCE TEXT.

GENERAL RULES

• Preserve 100% of the SOURCE TEXT.
• Do NOT add external medical knowledge.
• Do NOT remove information.
• Do NOT change scientific meaning.
• Do NOT invent facts, examples, questions, cases, or explanations.
• Only reorganize, structure, and visually improve the presentation.
• Preserve all medical terminology, abbreviations, numbers, classifications, examples, questions, answers, warnings, and distinctions.
• If the SOURCE TEXT contains information that does not perfectly match one of the template components, place it in the most semantically appropriate component.
• Do not force unrelated content into an inappropriate component.
• The order of information may be changed when necessary for better educational organization, but no information may be lost.
• The SOURCE TEXT may contain Persian, English, medical terminology, abbreviations, and Unicode symbols. Preserve them correctly.

OUTPUT RULE

Return ONLY HTML .

Do not return Markdown.
Do not use code fences.
Do not provide explanations before or after the HTML.

The final HTML must be immediately usable for PDF generation with Puppeteer, Playwright, or wkhtmltopdf.

The following structure is the REQUIRED visual and semantic template.

You MUST use this structure as the foundation of the generated document.

You may repeat, extend, or nest the provided content components when necessary to accommodate the SOURCE TEXT.

You MUST NOT replace this template with a generic article layout.

You MUST NOT invent a different visual design.

The final document should preserve the same overall hierarchy:

.page-sheet
→ .brand-bar
→ .topic-header
→ .chapter-heading
→ content components
→ optional repeated sections/components as needed

Use the following component types whenever applicable:

• .entry-block.type-case
• .entry-block.type-example
• .entry-block.type-supplement
• .entry-block.type-ext-mcq
• .trap-subsection
• .chip-exam-inline
• .chip-case
• .chip-example
• .chip-supplement
• .chip-ext-mcq
• .chip-trap

The example text below is ONLY a structural example.

Replace ALL example medical content with the SOURCE TEXT.

TEMPLATE:

<div class="page-sheet">

  <header class="brand-bar">     <div class="brand-group">       <div class="logo-mark">         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">           <path d="M22 10 12 5 2 10l10 5 10-5Z"/>           <path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>         </svg>       </div>


  <div>
    <span class="logo-title en">We Pass</span>
    <span class="logo-subtitle">[موضوع / عنوان جلسه از SOURCE TEXT]</span>
  </div>
</div>

<span class="meta-tag">[برچسب مناسب از SOURCE TEXT]</span>


  </header>

  <div class="topic-header">     <h1 class="topic-title">[عنوان اصلی مبحث از SOURCE TEXT]</h1>     <div class="topic-sub">[توضیح کوتاه درباره موضوع، فقط بر اساس SOURCE TEXT]</div>   </div>

  <h2 class="chapter-heading">     <span>[عنوان بخش اصلی]</span>   </h2>

  <!-- Main content from SOURCE TEXT -->

  <p>     <strong>[عنوان یا برچسب مناسب]</strong>     [متن مربوطه از SOURCE TEXT]   </p>

  <!-- Exam questions / exam points -->

<span class="chip chip-exam-inline">📝 سوال امتحان</span>

  <p>     <strong>[سوال یا نکته امتحانی]</strong>     [محتوای مربوطه از SOURCE TEXT]   </p>

  <!-- Clinical scenarios -->

  <div class="entry-block type-case">     <span class="chip chip-case">🩺 سناریوی بالینی</span>     <strong>[عنوان کیس]</strong>     [متن سناریو و مفهوم آن از SOURCE TEXT]   </div>

  <!-- Teacher examples -->

  <div class="entry-block type-example">     <span class="chip chip-example">💬 مثال استاد</span>     <strong>[عنوان مثال]</strong>     [متن مثال استاد از SOURCE TEXT]   </div>

  <!-- Additional explanatory information -->

  <div class="entry-block type-supplement">     <span class="chip chip-supplement">💡 نکته تکمیلی (درک مطلب)</span>     [مطالب تکمیلی موجود در SOURCE TEXT]   </div>

  <!-- Information outside the original notes but present in SOURCE TEXT -->

  <div class="entry-block type-ext-mcq">     <span class="chip chip-ext-mcq">📌 خارج از جزوه</span>     [مطالبی که در SOURCE TEXT به عنوان خارج از جزوه مشخص شده‌اند]   </div>

  <!-- Exam traps -->

  <div class="trap-subsection">     <div class="trap-subsection-header">       <span class="chip chip-trap">⚠️ تله امتحانی / الگوی پرتکرار طراح</span>       <span>[عنوان تله]</span>     </div>


<p>
  [محتوای تله امتحانی از SOURCE TEXT]
</p>


  </div>

  <!-- Additional sections -->

[Repeat the appropriate template components as many times as necessary.]

</div>

Map the SOURCE TEXT into the template according to its semantic meaning.

1. MAIN SUMMARY

Content such as:

• خلاصه مبحث
• definitions
• mechanisms
• classifications
• explanations
• disease descriptions
• pathophysiology

should be presented as normal structured content using:

<p> <h2> <h3> <ul> <ol> <section> <article>

Do not put the entire SOURCE TEXT into one huge paragraph.

Break long sections into readable subsections while preserving every sentence and concept.

---

2. EXAM QUESTIONS

For content explicitly identified as:

• نکات امتحانی
• سوال امتحان
• سؤال امتحان
• پاسخ تشریحی مرتبط با سوال
• نکته آزمونی

use the exam styling.

Use:

<span class="chip chip-exam-inline">📝 سوال امتحان</span>

Place the question and its corresponding answer/explanation together.

Do NOT remove the question.

Do NOT convert the question into a generic statement.

---

3. CLINICAL SCENARIOS

Content explicitly identified as:

• سناریو بالینی
• کیس
• کیس بالینی
• بیمار ...
• سناریوی ...

must use:

<div class="entry-block type-case">

and:

<span class="chip chip-case">🩺 سناریوی بالینی</span>

Preserve the complete clinical scenario and its interpretation.

---

4. TEACHER EXAMPLES

Content explicitly identified as:

• مثال استاد
• تمثیل استاد
• مثال مطرح‌شده توسط استاد

must use:

<div class="entry-block type-example">

and:

<span class="chip chip-example">💬 مثال استاد</span>

---

5. SUPPLEMENTARY INFORMATION

Content explicitly identified as:

• نکته تکمیلی
• نکات تکمیلی ضروری
• درک مطلب
• مطالب تکمیلی
• توضیح تکمیلی

must use:

<div class="entry-block type-supplement">

and:

<span class="chip chip-supplement">💡 نکته تکمیلی (درک مطلب)</span>

---

6. OUTSIDE-SOURCE / EXTRA QUESTIONS

If the SOURCE TEXT explicitly identifies something as:

• خارج از جزوه
• خارج از منبع
• خارج از متن اصلی

use:

<div class="entry-block type-ext-mcq">

and:

<span class="chip chip-ext-mcq">📌 خارج از جزوه</span>

Do not invent this classification.

---

7. EXAM TRAPS

Content identified as:

• تله امتحانی
• تله‌های امتحانی
• الگوهای تکرارشونده سوالات
• تله مشاهده‌شده
• قاطی نشه
• اشتباهات رایج در سوالات

should use:

<div class="trap-subsection">

with:

<span class="chip chip-trap">⚠️ تله امتحانی / الگوی پرتکرار طراح</span>

If there are multiple traps, create multiple clearly separated trap blocks when appropriate.

---

8. COMPARISONS

When SOURCE TEXT contains explicit comparisons such as:

• X vs Y
• مقایسه X و Y
• تفاوت X و Y
• جدول مقایسه‌ای
• classification comparison

use a semantic HTML table.

Do not remove the original information.

Tables should be compact and optimized for printing.

---

9. IMAGES / VISUAL REFERENCES

If SOURCE TEXT contains a section describing important images, figures, diagrams, microscopy findings, radiology images, or visual references:

Do NOT invent actual images.

Represent the information as a visually distinct textual block or figure description.

Preserve the description completely.

---

10. IMPORTANT CONTENT NOT FITTING A COMPONENT

Some SOURCE TEXT may not belong to a case, example, exam trap, supplement, or external question.

Do NOT delete it.

Place it into normal semantic content sections using:

<section> <article> <h2> <h3> <p> <ul> <ol> <table>

The template is a visual system, not a restriction that allows content to be lost.

Automatically identify the hierarchy of the SOURCE TEXT.

For example:

Main topic
→ major section
→ subsection
→ explanation
→ examples
→ exam points
→ traps
→ clinical scenarios
→ comparisons

Use:

<h1> for the main topic.

<h2> for major sections.

<h3> for subsections.

<p> for explanations.

<ul>/<ol> for lists.

<table> for genuine comparisons.

Do NOT flatten the entire document into paragraphs.

Preserve:

• English medical terms
• Latin terminology
• abbreviations
• gene names
• cytokines
• receptors
• drug names
• numerical values
• percentages
• formulas
• arrows
• classifications
• disease names
• mechanisms
• examples
• exam questions
• answers
• warnings

Do not translate medical terminology unless the SOURCE TEXT already provides the translation.

English medical terminology should be visually distinguishable when useful by using:

<span class="en">...</span>

Do not overuse this class.

Create embedded CSS that faithfully implements the provided template.

The visual style should resemble a premium medical study booklet.

Use:

• A4 portrait
• professional typography
• compact spacing
• strong hierarchy
• subtle academic colors
• clean borders
• readable cards
• restrained visual emphasis
• print-safe backgrounds

Use modern system fonts:

Inter,
Segoe UI,
Roboto,
Arial,
sans-serif

For Persian text, ensure the font stack provides good Persian/Arabic glyph support.

The design must work correctly for RTL Persian content.

Use:

direction: rtl;

where appropriate.

English medical terminology may use:

direction: ltr;

and:

<span class="en">...</span>

The document must be optimized for A4 PDF generation.

Include:

@page {
size: A4 portrait;
margin: appropriate printable margins;
}

Use:

print-color-adjust: exact;
-webkit-print-color-adjust: exact;

Use appropriate:

break-inside: avoid;
page-break-inside: avoid;

for:

• cards
• callouts
• tables
• important lists
• headings
• clinical cases
• exam traps

Avoid unnecessary page breaks.

Allow normal content to flow naturally across multiple pages.

Do not create one fixed-height page for each section.

Tables must:

• fit within A4 width
• use compact padding
• have clear headers
• use alternating row backgrounds
• prevent text overflow
• use readable font sizes
• avoid breaking rows across pages where possible

Use:

table {
width: 100%;
border-collapse: collapse;
}

Do not create tables unless the SOURCE TEXT genuinely contains information suitable for tabular comparison.

Use visual emphasis for:

• important medical terminology
• key mechanisms
• classifications
• numerical thresholds
• exceptions
• exam-critical facts

Use:

<strong>

and the template chips/components.

Do NOT highlight every sentence.

The purpose of highlighting is to create a visual hierarchy for rapid medical review.

Keep the document information-dense.

Avoid:

• excessive whitespace
• oversized headings
• giant cards
• unnecessary margins
• excessive line height
• decorative elements that waste print space

However, do not make the text so compact that it becomes difficult to read.

Use semantic HTML where appropriate:

<header> <main> <section> <article> <aside> <table> <thead> <tbody> <footer>

Avoid unnecessary div nesting.

The template-specific classes may use divs when required by the visual design.

The document should also remain readable in desktop browsers.

Use:

.page-sheet {
max-width: 1100px;
margin: 0 auto;
}

The print layout must remain optimized for A4.

Use ONLY:

• HTML
• embedded CSS
• inline SVG already included in the template

Do NOT use:

• JavaScript
• external libraries
• external CSS
• Bootstrap
• Tailwind
• external fonts
• external images
• external resources

Everything must be completely self-contained.

The following distinction is critical:

HTML TEMPLATE = STRUCTURE + VISUAL DESIGN

SOURCE TEXT = ACTUAL CONTENT

The SOURCE TEXT must be inserted into the HTML TEMPLATE.

Never output the example medical content from the template unless that same information also exists in the SOURCE TEXT.

Never lose SOURCE TEXT merely because it does not have an exact equivalent in the template.

When necessary, repeat template components to accommodate all SOURCE TEXT.

Before returning the HTML, internally verify:

1. All SOURCE TEXT has been preserved.
2. No medical information was invented.
3. No scientific meaning was changed.
4. All exam questions are preserved.
5. All exam traps are preserved.
6. All clinical scenarios are preserved.
7. All teacher examples are preserved.
8. All supplementary information is preserved.
9. All comparison tables are preserved.
10. All important visual/image descriptions are preserved.
11. The template structure is used.
12. The document is valid HTML.
13. CSS is embedded.
14. No JavaScript is used.
15. No external resources are required.
16. The document is suitable for A4 PDF generation.
17. The result is readable in RTL Persian.
18. No Markdown or explanation is included outside the HTML.

FINAL OUTPUT:

Return ONLY the complete HTML document.

Do not wrap it in Markdown.

Do not explain anything.

The HTML must be immediately ready for conversion to PDF using Puppeteer, Playwright, or wkhtmltopdf.`;

export default function ToHtmlDashboard() {
  // Theme State: "dark" | "light"
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem("wepass_pipeline_theme") as "dark" | "light" | null;
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("wepass_pipeline_theme", nextTheme);
  };

  const isDark = theme === "dark";

  // Dynamic Theme Styles
  const styles = useMemo(() => {
    return {
      bgMain: isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900",
      bgHeader: isDark ? "bg-slate-900/80 border-slate-800" : "bg-white/80 border-slate-200 shadow-sm",
      bgCard: isDark ? "bg-slate-900 border-slate-800 shadow-xl" : "bg-white border-slate-200 shadow-md",
      bgSubCard: isDark ? "bg-slate-950 border-slate-800" : "bg-slate-100 border-slate-200",
      bgInput: isDark
        ? "bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-600 focus:border-indigo-500"
        : "bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500",
      textTitle: isDark ? "text-white" : "text-slate-900",
      textMuted: isDark ? "text-slate-400" : "text-slate-500",
      borderLine: isDark ? "border-slate-800" : "border-slate-200",
    };
  }, [isDark]);

  // Upload & Config State
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [parsedSections, setParsedSections] = useState<ParsedSection[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [hasPreamble, setHasPreamble] = useState(false);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalParsedChunksCount = useMemo(() => {
    return parsedSections.reduce((acc, sec) => {
      const chunks = splitByLines(sec.content, 600);
      return acc + (chunks.length > 0 ? chunks.length : 1);
    }, 0);
  }, [parsedSections]);

  // Inspection Modal State
  const [inspectedSection, setInspectedSection] = useState<{
    marker: string;
    label?: string;
    content: string;
    charCount: number;
    lineCount?: number;
    isInput?: boolean;
    outputFilename?: string;
  } | null>(null);

  // Jobs State
  const [jobsList, setJobsList] = useState<JobListItem[]>([]);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobData, setJobData] = useState<ToHtmlJobResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Filters & Tabs
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "processing" | "failed" | "pending">("all");
  const [activeTab, setActiveTab] = useState<"sections" | "logs" | "preview">("sections");
  const [logLevelFilter, setLogLevelFilter] = useState<"ALL" | "INFO" | "WARN" | "ERROR">("ALL");
  const [logSearchQuery, setLogSearchQuery] = useState("");

  // Fetch jobs list
  const fetchJobsList = useCallback(async () => {
    try {
      const res = await fetch("/api/tohtml/status");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.jobs)) {
          setJobsList(data.jobs);
          if (!currentJobId && data.jobs.length > 0) {
            setCurrentJobId(data.jobs[0].id);
          }
        }
      }
    } catch {
      // silent background catch
    }
  }, [currentJobId]);

  // Fetch job details
  const fetchJobStatus = useCallback(async (id: string, showLoading = false) => {
    if (showLoading) setIsLoading(true);
    setApiError(null);
    try {
      const res = await fetch(`/api/tohtml/status?id=${encodeURIComponent(id)}`);
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to fetch job status");
      }
      const data: ToHtmlJobResponse = await res.json();
      setJobData(data);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Error connecting to tohtml backend API");
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchJobsList();
  }, [fetchJobsList]);

  useEffect(() => {
    if (currentJobId) {
      fetchJobStatus(currentJobId, true);
    }
  }, [currentJobId, fetchJobStatus]);

  // Polling while active job is processing or queued
  useEffect(() => {
    if (!currentJobId || !jobData) return;
    if (jobData.status === "processing" || jobData.status === "queued") {
      const interval = setInterval(() => {
        fetchJobStatus(currentJobId, false);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [currentJobId, jobData, fetchJobStatus]);

  // Handle File Selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.name.toLowerCase().endsWith(".txt")) {
      setApiError("Please select a valid .txt file.");
      return;
    }

    setApiError(null);
    setFile(selected);
    setFileName(selected.name);

    try {
      const text = await selected.text();
      if (!text || !text.trim()) {
        setApiError("The uploaded file is empty.");
        setParsedSections([]);
        setFileContent("");
        return;
      }

      setFileContent(text);
      const result = parseCutSections(text);
      setParsedSections(result.sections);
      setParseWarnings(result.warnings);
      setHasPreamble(result.hasPreamble);

      if (result.sections.length === 0) {
        setApiError("No valid 'CUT n' sections were detected in this file.");
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to read the file content.");
      setParsedSections([]);
    }
  };

  // Start processing job
  const handleStartProcessing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName || parsedSections.length === 0) {
      setApiError("Please upload a .txt file containing valid CUT sections before starting.");
      return;
    }
    if (!prompt.trim()) {
      setApiError("Please provide a valid DeepSeek prompt.");
      return;
    }

    setIsSubmitting(true);
    setApiError(null);

    try {
      const res = await fetch("/api/tohtml/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          prompt: prompt.trim(),
          sections: parsedSections,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start processing job");
      }

      setCurrentJobId(data.jobId);
      setActiveTab("sections");
      await fetchJobsList();
      await fetchJobStatus(data.jobId, true);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Could not start processing execution");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Retry individual section
  const handleRetrySection = async (sectionIndex: number) => {
    if (!currentJobId) return;
    try {
      const res = await fetch("/api/tohtml/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: currentJobId,
          sectionIndex,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to retry section");
      }
      await fetchJobStatus(currentJobId, false);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Retry failed");
    }
  };

  // Retry all failed sections
  const handleRetryAllFailed = async () => {
    if (!currentJobId) return;
    try {
      const res = await fetch("/api/tohtml/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: currentJobId,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to retry all failed sections");
      }
      await fetchJobStatus(currentJobId, false);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Retry all failed");
    }
  };

  // Download section TXT file
  const handleDownloadSection = (sectionIndex: number, filename?: string) => {
    if (!currentJobId) return;
    const url = `/api/tohtml/download?jobId=${encodeURIComponent(currentJobId)}&sectionIndex=${sectionIndex}${filename ? `&filename=${encodeURIComponent(filename)}` : ""}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `section-${sectionIndex + 1}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Download merged TXT file
  const handleDownloadMerged = () => {
    if (!currentJobId) return;
    const url = `/api/tohtml/download?jobId=${encodeURIComponent(currentJobId)}&merged=true`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${jobData?.fileName.replace(/\.[^/.]+$/, "") || "job"}-merged.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Filtered sections
  const filteredSections = (jobData?.sections || []).filter((s) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchesMarker = s.marker.toLowerCase().includes(q);
      const matchesLabel = s.label ? s.label.toLowerCase().includes(q) : false;
      const matchesContent = s.content.toLowerCase().includes(q);
      if (!matchesMarker && !matchesLabel && !matchesContent) {
        return false;
      }
    }
    if (statusFilter !== "all" && s.status !== statusFilter) {
      return false;
    }
    return true;
  });

  // Filtered logs
  const filteredLogs = (jobData?.logs || []).filter((log) => {
    if (logLevelFilter !== "ALL" && log.level !== logLevelFilter) {
      return false;
    }
    if (
      logSearchQuery.trim() &&
      !log.message.toLowerCase().includes(logSearchQuery.toLowerCase().trim()) &&
      !(log.marker && log.marker.toLowerCase().includes(logSearchQuery.toLowerCase().trim()))
    ) {
      return false;
    }
    return true;
  });

  const formatMs = (ms?: number) => {
    if (ms === undefined || ms === null) return "—";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleTimeString();
  };

  return (
    <div className={`min-h-screen font-sans antialiased pb-16 transition-colors duration-200 ${styles.bgMain}`}>
      {/* Top Navigation Bar */}
      <header className={`border-b backdrop-blur sticky top-0 z-40 px-6 py-4 ${styles.bgHeader}`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className={`text-lg font-bold tracking-tight flex items-center gap-2 ${styles.textTitle}`}>
                WePass
                <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium border ${isDark ? "bg-indigo-950 text-indigo-400 border-indigo-800" : "bg-indigo-50 text-indigo-700 border-indigo-200"}`}>
                  CUT Splitter & DeepSeek
                </span>
              </h1>
              <p className={`text-xs ${styles.textMuted}`}>Chunk-by-Chunk TXT Processing & Individual Downloads</p>
            </div>
          </div>

          {/* Job Selection, Refresh & Theme Toggle */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className={`px-3 py-2 rounded-lg border font-semibold text-xs transition-all flex items-center gap-2 shadow-sm ${isDark
                ? "bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700"
                : "bg-white border-slate-300 text-slate-800 hover:bg-slate-100"
                }`}
              title="Toggle Light/Dark Theme"
            >
              <span>{isDark ? "🌙 Dark Mode" : "☀️ Light Mode"}</span>
            </button>

            {jobsList.length > 0 && (
              <select
                value={currentJobId || ""}
                onChange={(e) => setCurrentJobId(e.target.value)}
                className={`text-xs rounded-lg px-3 py-2 border focus:ring-2 focus:ring-indigo-500 focus:outline-none ${isDark ? "bg-slate-900 border-slate-700 text-slate-200" : "bg-white border-slate-300 text-slate-800"
                  }`}
              >
                {jobsList.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.fileName} ({j.completedSections}/{j.totalSections}, {j.status})
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => currentJobId && fetchJobStatus(currentJobId, true)}
              disabled={isLoading || !currentJobId}
              className={`p-2 rounded-lg border transition-colors disabled:opacity-50 ${isDark
                ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300"
                : "bg-white hover:bg-slate-100 border-slate-300 text-slate-700 shadow-sm"
                }`}
              title="Refresh Data"
            >
              <svg className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-6 space-y-6">
        {/* Upload & Configuration Panel */}
        <section className={`border rounded-xl p-5 ${styles.bgCard}`}>
          <form onSubmit={handleStartProcessing} className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* File Upload & Parse Summary */}
              <div className="space-y-3">
                <label className={`text-xs font-semibold uppercase tracking-wider block ${styles.textMuted}`}>
                  1. Select TXT File with CUT Markers
                </label>
                <div className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${isDark ? "border-slate-800 bg-slate-950/60 hover:border-indigo-500/50" : "border-slate-300 bg-slate-50 hover:border-indigo-500/50"}`}>
                  <input
                    type="file"
                    id="txtFileInput"
                    accept=".txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="txtFileInput"
                    className="cursor-pointer flex flex-col items-center justify-center gap-2 py-2"
                  >
                    <svg className="w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className={`text-xs font-semibold ${styles.textTitle}`}>
                      {fileName ? fileName : "Click to browse or drop a .txt file"}
                    </span>
                    <span className={`text-[11px] ${styles.textMuted}`}>
                      Files formatted with `CUT 1`, `CUT 2`, etc.
                    </span>
                  </label>
                </div>

                {/* Upload Stats */}
                {fileName && (
                  <div className={`p-3 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 ${styles.bgSubCard}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{fileName}</span>
                      <span className={`px-2 py-0.5 rounded font-mono text-[10px] ${isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-700"}`}>
                        {fileContent.length.toLocaleString()} chars
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">
                        {parsedSections.length} section(s) · {totalParsedChunksCount} chunk(s)
                      </span>
                      {parsedSections.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setActiveTab("preview")}
                          className="text-indigo-400 hover:text-indigo-300 underline font-semibold text-[11px]"
                        >
                          Preview Sections & Chunks
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Warning banners */}
                {hasPreamble && (
                  <div className="bg-amber-950/40 border border-amber-800 rounded-lg p-2.5 text-amber-200 text-xs flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Non-empty text before the first CUT marker was preserved as <strong>Preamble</strong>.</span>
                  </div>
                )}
              </div>

              {/* Prompt Configuration */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className={`text-xs font-semibold uppercase tracking-wider ${styles.textMuted}`}>
                    2. DeepSeek Prompt Configuration
                  </label>
                  <button
                    type="button"
                    onClick={() => setPrompt(DEFAULT_PROMPT)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 underline"
                  >
                    Reset Default
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter system prompt for processing each chunk..."
                  className={`w-full rounded-lg p-3 text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none transition ${styles.bgInput}`}
                  required
                />
              </div>
            </div>

            {/* Action Bar */}
            <div className={`pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3 ${styles.borderLine}`}>
              <div className="text-xs text-slate-500">
                Each CUT section is split into ≤ 600-line chunks, processed independently through DeepSeek API, and saved as a separate .txt response.
              </div>
              <button
                type="submit"
                disabled={isSubmitting || parsedSections.length === 0 || !prompt.trim()}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-6 py-2.5 rounded-lg shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    <span>Starting Job...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>
                      Start Processing ({totalParsedChunksCount} chunk{totalParsedChunksCount !== 1 ? "s" : ""} from {parsedSections.length} section{parsedSections.length !== 1 ? "s" : ""})
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* API Error Alert */}
        {apiError && (
          <div className="bg-rose-950/80 border border-rose-800 rounded-xl p-4 text-rose-200 text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{apiError}</span>
            </div>
            <button onClick={() => setApiError(null)} className="text-rose-400 hover:text-white font-bold text-sm">
              ×
            </button>
          </div>
        )}

        {/* Metrics & Overview Cards */}
        {jobData && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className={`p-4 rounded-xl border ${styles.bgCard}`}>
              <span className={`text-[11px] font-semibold uppercase tracking-wider block mb-1 ${styles.textMuted}`}>Total Sections</span>
              <span className={`text-2xl font-extrabold ${styles.textTitle}`}>{jobData.summary.total}</span>
            </div>
            <div className={`p-4 rounded-xl border ${styles.bgCard}`}>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 block mb-1">Completed</span>
              <span className="text-2xl font-extrabold text-emerald-400">{jobData.summary.completed}</span>
            </div>
            <div className={`p-4 rounded-xl border ${styles.bgCard}`}>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 block mb-1">Processing</span>
              <span className="text-2xl font-extrabold text-amber-400">{jobData.summary.processing}</span>
            </div>
            <div className={`p-4 rounded-xl border ${styles.bgCard}`}>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-400 block mb-1">Failed</span>
              <span className="text-2xl font-extrabold text-rose-400">{jobData.summary.failed}</span>
            </div>
            <div className={`p-4 rounded-xl border ${styles.bgCard}`}>
              <span className={`text-[11px] font-semibold uppercase tracking-wider block mb-1 ${styles.textMuted}`}>Pending</span>
              <span className={`text-2xl font-extrabold ${styles.textTitle}`}>{jobData.summary.pending}</span>
            </div>
            <div className={`p-4 rounded-xl border ${styles.bgCard}`}>
              <span className={`text-[11px] font-semibold uppercase tracking-wider block mb-1 ${styles.textMuted}`}>Avg Time / Sec</span>
              <span className={`text-2xl font-extrabold ${styles.textTitle}`}>{formatMs(jobData.summary.avgDurationMs)}</span>
            </div>
          </div>
        )}

        {/* Tabs: Dashboard View vs Parsed Preview vs Logs */}
        <div className={`border-b flex items-center justify-between ${styles.borderLine}`}>
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("sections")}
              className={`pb-3 text-xs font-bold transition-all border-b-2 ${activeTab === "sections"
                ? "border-indigo-500 text-indigo-500"
                : `border-transparent ${styles.textMuted} hover:${styles.textTitle}`
                }`}
            >
              Sections Dashboard {jobData ? `(${jobData.sections.length})` : ""}
            </button>
            {parsedSections.length > 0 && (
              <button
                onClick={() => setActiveTab("preview")}
                className={`pb-3 text-xs font-bold transition-all border-b-2 ${activeTab === "preview"
                  ? "border-indigo-500 text-indigo-500"
                  : `border-transparent ${styles.textMuted} hover:${styles.textTitle}`
                  }`}
              >
                Uploaded Preview ({parsedSections.length})
              </button>
            )}
            <button
              onClick={() => setActiveTab("logs")}
              className={`pb-3 text-xs font-bold transition-all border-b-2 ${activeTab === "logs"
                ? "border-indigo-500 text-indigo-500"
                : `border-transparent ${styles.textMuted} hover:${styles.textTitle}`
                }`}
            >
              Job System Logs ({jobData?.logs.length || 0})
            </button>
          </div>

          {/* Bulk Action Buttons */}
          {jobData && (
            <div className="flex items-center gap-2 pb-2">
              {jobData.summary.failed > 0 && (
                <button
                  type="button"
                  onClick={handleRetryAllFailed}
                  className="px-3 py-1.5 rounded-lg border border-rose-800 bg-rose-950/60 hover:bg-rose-900 text-rose-200 text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Retry All Failed ({jobData.summary.failed})</span>
                </button>
              )}
              {jobData.summary.completed > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadMerged}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download Merged TXT</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tab 1: Sections Dashboard */}
        {activeTab === "sections" && (
          <div className="space-y-4">
            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search sections by content or marker..."
                className={`rounded-lg px-3 py-1.5 text-xs w-full sm:w-72 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${styles.bgInput}`}
              />

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className={`text-xs rounded-lg px-3 py-1.5 focus:outline-none ${styles.bgInput}`}
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="processing">Processing</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            {/* Sections List Table */}
            <div className={`overflow-x-auto rounded-xl border ${styles.borderLine}`}>
              <table className="w-full text-left text-xs">
                <thead className={`uppercase font-semibold border-b ${isDark ? "bg-slate-900 text-slate-400 border-slate-800" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Section / Chunk</th>
                    <th className="p-3">Size</th>
                    <th className="p-3">Content Preview</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Duration</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${styles.borderLine}`}>
                  {!jobData || filteredSections.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={`text-center py-12 italic ${styles.textMuted}`}>
                        {!jobData ? "No active processing job selected. Upload a file and start processing." : "No sections match the filter criteria."}
                      </td>
                    </tr>
                  ) : (
                    filteredSections.map((sec) => (
                      <tr
                        key={sec.id}
                        className={`transition-colors ${isDark ? "hover:bg-slate-800/40" : "hover:bg-slate-100/80"}`}
                      >
                        <td className="p-3 font-mono text-slate-500">{sec.index + 1}</td>
                        <td className="p-3">
                          <span className={`px-2.5 py-1 rounded-md font-mono font-bold text-[11px] ${sec.marker === "Preamble"
                            ? "bg-amber-950 text-amber-300 border border-amber-800"
                            : "bg-indigo-950 text-indigo-300 border border-indigo-800"
                            }`}>
                            {sec.label || sec.marker}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-400">
                          {sec.lineCount !== undefined ? `${sec.lineCount} lines · ` : ""}
                          {sec.charCount.toLocaleString()} chars
                        </td>
                        <td className="p-3 max-w-xs truncate font-mono text-slate-400">
                          {sec.content.slice(0, 70)}...
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-1 rounded font-bold uppercase text-[10px] inline-flex items-center gap-1.5 ${sec.status === "completed"
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : sec.status === "failed"
                                ? "bg-rose-950 text-rose-300 border border-rose-800"
                                : sec.status === "processing"
                                  ? "bg-amber-950 text-amber-300 border border-amber-800 animate-pulse"
                                  : "bg-slate-800 text-slate-400"
                              }`}
                          >
                            {sec.status === "processing" && (
                              <svg className="animate-spin h-3 w-3 text-amber-300" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                              </svg>
                            )}
                            {sec.status}
                          </span>
                          {sec.error && (
                            <p className="text-rose-400 text-[10px] mt-1 line-clamp-1" title={sec.error}>
                              {sec.error}
                            </p>
                          )}
                        </td>
                        <td className="p-3 font-mono text-slate-400">{formatMs(sec.durationMs)}</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setInspectedSection({
                                  marker: sec.marker,
                                  label: sec.label || sec.marker,
                                  content: sec.content,
                                  charCount: sec.charCount,
                                  lineCount: sec.lineCount,
                                  isInput: true,
                                  outputFilename: sec.outputFilename,
                                })
                              }
                              className={`p-1.5 rounded hover:bg-slate-700/50 text-slate-300 text-xs font-semibold`}
                              title="Inspect Section Content"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>

                            {sec.status === "completed" && (
                              <button
                                type="button"
                                onClick={() => handleDownloadSection(sec.index, sec.outputFilename)}
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] flex items-center gap-1 shadow-sm"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                <span>Download TXT</span>
                              </button>
                            )}

                            {sec.status === "failed" && (
                              <button
                                type="button"
                                onClick={() => handleRetrySection(sec.index)}
                                className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold text-[11px] flex items-center gap-1 shadow-sm"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>Retry</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Uploaded Preview */}
        {activeTab === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${styles.textTitle}`}>
                Detected {parsedSections.length} sections ({totalParsedChunksCount} chunk{totalParsedChunksCount !== 1 ? "s" : ""}) from "{fileName}"
              </span>
              <span className={`text-xs ${styles.textMuted}`}>
                Total {fileContent.length.toLocaleString()} characters
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {parsedSections.map((sec) => {
                const chunks = splitByLines(sec.content, 600);
                const effectiveChunks = chunks.length > 0 ? chunks : [sec.content || ""];
                const lineCount = sec.content ? sec.content.split(/\r?\n/).length : 0;

                return (
                  <div
                    key={sec.index}
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${styles.bgCard}`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`px-2.5 py-0.5 rounded font-mono font-bold text-xs ${sec.isPreamble
                          ? "bg-amber-950 text-amber-300 border border-amber-800"
                          : "bg-indigo-950 text-indigo-300 border border-indigo-800"
                          }`}>
                          {sec.marker}
                        </span>
                        <span className="text-slate-400 font-mono text-xs">
                          {effectiveChunks.length} chunk{effectiveChunks.length > 1 ? "s" : ""} · {lineCount} lines · {sec.charCount.toLocaleString()} chars
                        </span>
                      </div>

                      {effectiveChunks.length > 1 && (
                        <div className="mb-2 flex flex-wrap gap-1">
                          {effectiveChunks.map((c, cIdx) => (
                            <span
                              key={cIdx}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono border ${isDark ? "bg-slate-900 border-slate-700 text-slate-300" : "bg-slate-200 border-slate-300 text-slate-700"}`}
                            >
                              Chunk {cIdx + 1}: {c ? c.split(/\r?\n/).length : 0} lines
                            </span>
                          ))}
                        </div>
                      )}

                      <pre className={`text-xs font-mono p-3 rounded-lg max-h-40 overflow-y-auto whitespace-pre-wrap ${isDark ? "bg-slate-950 text-slate-300" : "bg-slate-100 text-slate-800"}`}>
                        {sec.content.slice(0, 300)}{sec.content.length > 300 ? "..." : ""}
                      </pre>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setInspectedSection({
                          marker: sec.marker,
                          label: sec.marker,
                          content: sec.content,
                          charCount: sec.charCount,
                          lineCount,
                          isInput: true,
                        })
                      }
                      className={`w-full py-1.5 rounded-lg border text-xs font-semibold transition ${isDark ? "border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200" : "border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800"}`}
                    >
                      View Full Section
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: System Logs */}
        {activeTab === "logs" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <input
                type="text"
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                placeholder="Search log messages..."
                className={`rounded-lg px-3 py-1.5 text-xs w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${styles.bgInput}`}
              />

              <select
                value={logLevelFilter}
                onChange={(e) => setLogLevelFilter(e.target.value as any)}
                className={`text-xs rounded-lg px-3 py-1.5 focus:outline-none ${styles.bgInput}`}
              >
                <option value="ALL">All Levels</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
              </select>
            </div>

            <div className={`p-4 rounded-xl border font-mono text-xs max-h-[500px] overflow-y-auto space-y-1 ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-900 border-slate-800 text-slate-200"}`}>
              {filteredLogs.length === 0 ? (
                <p className="text-slate-500 italic">No logs recorded.</p>
              ) : (
                filteredLogs.map((log) => (
                  <div key={log.id} className="flex gap-3 leading-relaxed">
                    <span className="text-slate-500 shrink-0">{formatDate(log.timestamp)}</span>
                    <span className={`font-bold shrink-0 ${log.level === "ERROR" ? "text-rose-400" : log.level === "WARN" ? "text-amber-400" : "text-emerald-400"}`}>
                      [{log.level}]
                    </span>
                    {log.marker && (
                      <span className="text-indigo-400 shrink-0">[{log.marker}]</span>
                    )}
                    <span className="text-slate-300">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Content Inspection Modal */}
      {inspectedSection && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-4xl max-h-[85vh] rounded-2xl border flex flex-col shadow-2xl ${styles.bgCard}`}>
            <div className={`p-4 border-b flex items-center justify-between ${styles.borderLine}`}>
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono font-bold text-xs">
                  {inspectedSection.label || inspectedSection.marker}
                </span>
                <span className={`text-xs ${styles.textMuted}`}>
                  {inspectedSection.lineCount !== undefined ? `${inspectedSection.lineCount} lines · ` : ""}
                  {inspectedSection.charCount.toLocaleString()} characters
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInspectedSection(null)}
                className="text-slate-400 hover:text-white font-bold text-lg px-2"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <pre className={`p-4 rounded-xl font-mono text-xs whitespace-pre-wrap select-text leading-relaxed ${isDark ? "bg-slate-950 text-slate-200" : "bg-slate-100 text-slate-800"}`}>
                {inspectedSection.content}
              </pre>
            </div>
            <div className={`p-4 border-t flex justify-end gap-3 ${styles.borderLine}`}>
              <button
                type="button"
                onClick={() => setInspectedSection(null)}
                className={`px-4 py-2 rounded-lg border text-xs font-semibold ${isDark ? "border-slate-700 hover:bg-slate-800 text-slate-300" : "border-slate-300 hover:bg-slate-100 text-slate-700"}`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
