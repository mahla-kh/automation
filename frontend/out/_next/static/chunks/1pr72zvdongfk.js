(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,65010,e=>{"use strict";var t=e.i(43476),s=e.i(71645),a=e.i(22016);function r(e,t=600){if(!e)return[];let s=e.split(/\r?\n/),a=[];for(let e=0;e<s.length;e+=t)a.push(s.slice(e,e+t).join("\n"));return a}var n=e.i(36605),o=e.i(3608),i=e.i(86388),l=e.i(12117);let c=`You are an expert HTML document designer specializing in professional medical study booklets.

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

The HTML must be immediately ready for conversion to PDF using Puppeteer, Playwright, or wkhtmltopdf.`;e.s(["default",0,function(){let{language:e,t:d,isRtl:m,dir:p}=(0,n.useLanguage)(),[h,x]=(0,s.useState)("dark");(0,s.useEffect)(()=>{let e=localStorage.getItem("wepass_pipeline_theme");("light"===e||"dark"===e)&&x(e)},[]);let u="dark"===h,b=(0,s.useMemo)(()=>({bgMain:u?"bg-[#1A2634] text-[#F5F5F5]":"bg-[#F5F5F5] text-[#364F6B]",bgHeader:u?"bg-[#243447]/90 border-[#364F6B]":"bg-white/90 border-[#364F6B]/15 shadow-sm",bgCard:u?"bg-[#243447] border-[#364F6B] shadow-xl":"bg-white border-[#364F6B]/15 shadow-md",bgSubCard:u?"bg-[#1A2634] border-[#364F6B]":"bg-[#F5F5F5] border-[#364F6B]/20",bgInput:u?"bg-[#1A2634] border-[#364F6B] text-[#F5F5F5] placeholder-slate-400 focus:border-[#FC5185] focus:ring-1 focus:ring-[#FC5185]":"bg-white border-[#364F6B]/30 text-[#364F6B] placeholder-slate-400 focus:border-[#FC5185] focus:ring-1 focus:ring-[#FC5185]",textTitle:u?"text-[#F5F5F5]":"text-[#364F6B]",textMuted:u?"text-[#F5F5F5]/70":"text-[#364F6B]/75",borderLine:u?"border-[#364F6B]":"border-[#364F6B]/20"}),[u]),[g,f]=(0,s.useState)(null),[v,j]=(0,s.useState)(""),[y,w]=(0,s.useState)(""),[N,T]=(0,s.useState)([]),[F,C]=(0,s.useState)([]),[k,E]=(0,s.useState)(!1),[S,L]=(0,s.useState)(c),[A,U]=(0,s.useState)(!1),M=(0,s.useMemo)(()=>N.reduce((e,t)=>{let s=r(t.content,600);return e+(s.length>0?s.length:1)},0),[N]),[R,O]=(0,s.useState)(null),[$,B]=(0,s.useState)([]),[P,I]=(0,s.useState)(null),[D,X]=(0,s.useState)(null),[H,W]=(0,s.useState)(!1),[z,q]=(0,s.useState)(null),[Y,V]=(0,s.useState)(""),[G,J]=(0,s.useState)("all"),[_,K]=(0,s.useState)("sections"),[Q,Z]=(0,s.useState)("ALL"),[ee,et]=(0,s.useState)(""),es=(0,s.useCallback)(async()=>{try{let e=await fetch("/api/tohtml/status");if(e.ok){let t=await e.json();Array.isArray(t.jobs)&&(B(t.jobs),!P&&t.jobs.length>0&&I(t.jobs[0].id))}}catch{}},[P]),ea=(0,s.useCallback)(async(e,t=!1)=>{t&&W(!0),q(null);try{let t=await fetch(`/api/tohtml/status?id=${encodeURIComponent(e)}`);if(!t.ok){let e=await t.json();throw Error(e.error||"Failed to fetch job status")}let s=await t.json();X(s)}catch(e){q(e instanceof Error?e.message:"Error connecting to tohtml backend API")}finally{t&&W(!1)}},[]);(0,s.useEffect)(()=>{es()},[es]),(0,s.useEffect)(()=>{P&&ea(P,!0)},[P,ea]),(0,s.useEffect)(()=>{if(P&&D&&("processing"===D.status||"queued"===D.status)){let e=setInterval(()=>{ea(P,!1)},2e3);return()=>clearInterval(e)}},[P,D,ea]);let er=async e=>{let t=e.target.files?.[0];if(t){if(!t.name.toLowerCase().endsWith(".txt"))return void q("Please select a valid .txt file.");q(null),f(t),j(t.name);try{let e=await t.text();if(!e||!e.trim()){q("The uploaded file is empty."),T([]),w("");return}w(e);let s=function(e){let t;if(!e||"string"!=typeof e)return{sections:[],totalChars:0,hasPreamble:!1,warnings:["File content is empty or invalid."]};let s=[],a=e.length,r=/(?:^|\r?\n)(?:[ \t]*={3,}[ \t]*\r?\n)?[ \t]*CUT[ \t]+(\d+)[ \t]*(?:\r?\n[ \t]*={3,}[ \t]*)?(?=\r?\n|$)/gi,n=[];for(;null!==(t=r.exec(e));){let e=t[0],s=parseInt(t[1],10),a=t.index;e.startsWith("\r\n")?a+=2:(e.startsWith("\n")||e.startsWith("\r"))&&(a+=1);let r=t.index+e.length;n.push({start:a,end:r,markerNumber:s,markerText:`CUT ${s}`})}if(0===n.length)return s.push("No valid 'CUT n' markers found in the file."),{sections:[],totalChars:a,hasPreamble:!1,warnings:s};let o=[],i=0,l=n[0],c=e.slice(0,l.start).trim(),d=!1;c.length>0&&(d=!0,o.push({index:i++,marker:"Preamble",markerNumber:null,content:c,charCount:c.length,isPreamble:!0}),s.push("Non-empty content detected before the first CUT marker and preserved as 'Preamble'."));for(let t=0;t<n.length;t++){let s=n[t],a=n[t+1],r=s.end,l=a?a.start:e.length,c=e.slice(r,l).trim();o.push({index:i++,marker:s.markerText,markerNumber:s.markerNumber,content:c,charCount:c.length,isPreamble:!1})}return{sections:o,totalChars:a,hasPreamble:d,warnings:s}}(e);T(s.sections),C(s.warnings),E(s.hasPreamble),0===s.sections.length&&q("No valid 'CUT n' sections were detected in this file.")}catch(e){q(e instanceof Error?e.message:"Failed to read the file content."),T([])}}},en=async e=>{if(e.preventDefault(),!v||0===N.length)return void q("Please upload a .txt file containing valid CUT sections before starting.");if(!S.trim())return void q("Please provide a valid DeepSeek prompt.");U(!0),q(null);try{let e=await fetch("/api/tohtml/start",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fileName:v,prompt:S.trim(),sections:N})}),t=await e.json();if(!e.ok)throw Error(t.error||"Failed to start processing job");I(t.jobId),K("sections"),await es(),await ea(t.jobId,!0)}catch(e){q(e instanceof Error?e.message:"Could not start processing execution")}finally{U(!1)}},eo=async e=>{if(P)try{let t=await fetch("/api/tohtml/retry",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jobId:P,sectionIndex:e})});if(!t.ok){let e=await t.json();throw Error(e.error||"Failed to retry section")}await ea(P,!1)}catch(e){q(e instanceof Error?e.message:"Retry failed")}},ei=async()=>{if(P)try{let e=await fetch("/api/tohtml/retry",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jobId:P})});if(!e.ok){let t=await e.json();throw Error(t.error||"Failed to retry all failed sections")}await ea(P,!1)}catch(e){q(e instanceof Error?e.message:"Retry all failed")}},el=(D?.sections||[]).filter(e=>{if(Y.trim()){let t=Y.toLowerCase().trim(),s=e.marker.toLowerCase().includes(t),a=!!e.label&&e.label.toLowerCase().includes(t),r=e.content.toLowerCase().includes(t);if(!s&&!a&&!r)return!1}return"all"===G||e.status===G}),ec=(D?.logs||[]).filter(e=>!("ALL"!==Q&&e.level!==Q||ee.trim()&&!e.message.toLowerCase().includes(ee.toLowerCase().trim())&&!(e.marker&&e.marker.toLowerCase().includes(ee.toLowerCase().trim())))),ed=e=>null==e?"—":e<1e3?`${e}ms`:`${(e/1e3).toFixed(1)}s`;return(0,t.jsx)(i.AuthGuard,{children:(0,t.jsxs)("div",{dir:p,className:`min-h-screen font-sans antialiased pb-16 transition-colors duration-200 ${b.bgMain}`,children:[(0,t.jsx)("header",{className:`border-b backdrop-blur sticky top-0 z-40 px-6 py-4 ${b.bgHeader}`,children:(0,t.jsxs)("div",{className:"max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4",children:[(0,t.jsxs)("div",{className:"flex items-center gap-3",children:[(0,t.jsx)("div",{className:"h-9 w-9 rounded-lg bg-gradient-to-tr from-[#FC5185] to-[#3FC1C9] flex items-center justify-center font-bold text-white shadow-lg shadow-[#FC5185]/20 shrink-0",children:(0,t.jsx)("svg",{className:"w-5 h-5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:(0,t.jsx)("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:"2",d:"M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"})})}),(0,t.jsxs)("div",{children:[(0,t.jsx)("h1",{className:`text-lg font-bold tracking-tight flex items-center gap-2 ${b.textTitle}`,children:d.tohtml.pageTitle}),(0,t.jsx)("p",{className:`text-xs ${b.textMuted}`,children:d.tohtml.pageDescription})]})]}),(0,t.jsxs)("div",{className:"flex flex-wrap items-center gap-3",children:[(0,t.jsxs)(a.default,{href:"/",className:`px-3 py-2 rounded-lg border font-semibold text-xs transition-all flex items-center gap-1.5 shadow-sm ${u?"bg-[#1A2634] border-[#364F6B] text-[#F5F5F5] hover:bg-[#243447]":"bg-white border-[#364F6B]/20 text-[#364F6B] hover:bg-[#F5F5F5]"}`,children:[(0,t.jsx)("span",{children:m?"→":"←"}),(0,t.jsx)("span",{className:"hidden sm:inline",children:d.auth.backToDashboard})]}),(0,t.jsx)(a.default,{href:"/pipeline",className:`px-3 py-2 rounded-lg border font-semibold text-xs transition-all flex items-center gap-1.5 shadow-sm ${u?"bg-[#1A2634] border-[#364F6B] text-[#F5F5F5] hover:bg-[#243447]":"bg-white border-[#364F6B]/20 text-[#364F6B] hover:bg-[#F5F5F5]"}`,children:(0,t.jsx)("span",{children:d.workflow.pipelineTool})}),(0,t.jsx)(o.default,{isDark:u}),(0,t.jsx)(l.UserNav,{}),(0,t.jsx)("button",{type:"button",onClick:()=>{let e="dark"===h?"light":"dark";x(e),localStorage.setItem("wepass_pipeline_theme",e)},className:`px-3 py-2 rounded-lg border font-semibold text-xs transition-all flex items-center gap-2 shadow-sm ${u?"bg-[#1A2634] border-[#364F6B] text-amber-300 hover:bg-[#243447]":"bg-white border-[#364F6B]/20 text-[#364F6B] hover:bg-[#F5F5F5]"}`,title:d.common.toggleTheme,children:(0,t.jsx)("span",{children:u?d.common.darkMode:d.common.lightMode})}),$.length>0&&(0,t.jsx)("select",{value:P||"",onChange:e=>I(e.target.value),className:`text-xs rounded-lg px-3 py-2 border focus:ring-2 focus:ring-[#FC5185] focus:outline-none ${u?"bg-[#1A2634] border-[#364F6B] text-[#F5F5F5]":"bg-white border-[#364F6B]/30 text-[#364F6B]"}`,children:$.map(e=>(0,t.jsxs)("option",{value:e.id,children:[e.fileName," (",e.completedSections,"/",e.totalSections,", ",e.status,")"]},e.id))}),(0,t.jsx)("button",{onClick:()=>P&&ea(P,!0),disabled:H||!P,className:`p-2 rounded-lg border transition-colors disabled:opacity-50 ${u?"bg-[#1A2634] hover:bg-[#243447] border-[#364F6B] text-[#F5F5F5]":"bg-white hover:bg-[#F5F5F5] border-[#364F6B]/30 text-[#364F6B] shadow-sm"}`,title:"Refresh Data",children:(0,t.jsx)("svg",{className:`w-4 h-4 ${H?"animate-spin":""}`,fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:(0,t.jsx)("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:"2",d:"M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"})})})]})]})}),(0,t.jsxs)("main",{className:"max-w-7xl mx-auto px-6 pt-6 space-y-6",children:[(0,t.jsx)("section",{className:`border rounded-xl p-5 ${b.bgCard}`,children:(0,t.jsxs)("form",{onSubmit:en,className:"space-y-4",children:[(0,t.jsxs)("div",{className:"grid grid-cols-1 lg:grid-cols-2 gap-5",children:[(0,t.jsxs)("div",{className:"space-y-3",children:[(0,t.jsxs)("label",{className:`text-xs font-semibold uppercase tracking-wider block ${b.textMuted}`,children:["1. ",d.tohtml.uploadTitle]}),(0,t.jsxs)("div",{className:`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${u?"border-[#364F6B] bg-[#1A2634]/60 hover:border-[#3FC1C9]":"border-[#364F6B]/20 bg-[#F5F5F5] hover:border-[#3FC1C9]"}`,children:[(0,t.jsx)("input",{type:"file",id:"txtFileInput",accept:".txt",onChange:er,className:"hidden"}),(0,t.jsxs)("label",{htmlFor:"txtFileInput",className:"cursor-pointer flex flex-col items-center justify-center gap-2 py-2",children:[(0,t.jsx)("svg",{className:"w-8 h-8 text-[#3FC1C9]",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:(0,t.jsx)("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:"2",d:"M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"})}),(0,t.jsx)("span",{className:`text-xs font-semibold ${b.textTitle}`,children:v||d.tohtml.dropzoneText}),(0,t.jsx)("span",{className:`text-[11px] ${b.textMuted}`,dir:"ltr",children:"Files formatted with `CUT 1`, `CUT 2`, etc."})]})]}),v&&(0,t.jsxs)("div",{className:`p-3 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 ${b.bgSubCard}`,children:[(0,t.jsxs)("div",{className:"flex items-center gap-2",children:[(0,t.jsx)("span",{className:"font-semibold",children:v}),(0,t.jsxs)("span",{className:`px-2 py-0.5 rounded font-mono text-[10px] ${u?"bg-[#1A2634] text-[#F5F5F5]/80":"bg-[#F5F5F5] text-[#364F6B]"}`,dir:"ltr",children:[y.length.toLocaleString()," chars"]})]}),(0,t.jsxs)("div",{className:"flex items-center gap-2",children:[(0,t.jsxs)("span",{className:"text-emerald-400 font-bold",children:[N.length," ",d.tohtml.sectionsFound," · ",M," ",d.tohtml.chunksEstimated]}),N.length>0&&(0,t.jsx)("button",{type:"button",onClick:()=>K("preview"),className:"text-[#FC5185] hover:underline font-semibold text-[11px]",children:d.tohtml.tabPreview})]})]}),k&&(0,t.jsxs)("div",{className:"bg-amber-950/40 border border-amber-800 rounded-lg p-2.5 text-amber-200 text-xs flex items-center gap-2",children:[(0,t.jsx)("svg",{className:"w-4 h-4 text-amber-400 shrink-0",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:(0,t.jsx)("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:"2",d:"M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"})}),(0,t.jsxs)("span",{children:["Non-empty text before the first CUT marker was preserved as ",(0,t.jsx)("strong",{children:"Preamble"}),"."]})]})]}),(0,t.jsxs)("div",{className:"space-y-3",children:[(0,t.jsxs)("div",{className:"flex items-center justify-between",children:[(0,t.jsxs)("label",{className:`text-xs font-semibold uppercase tracking-wider ${b.textMuted}`,children:["2. ",d.tohtml.deepseekPromptTitle]}),(0,t.jsx)("button",{type:"button",onClick:()=>L(c),className:"text-[11px] text-[#FC5185] hover:underline",children:d.tohtml.resetPrompt})]}),(0,t.jsx)("textarea",{rows:6,dir:"ltr",value:S,onChange:e=>L(e.target.value),placeholder:"Enter system prompt for processing each chunk...",className:`w-full rounded-lg p-3 text-xs font-mono text-left focus:ring-2 focus:ring-[#FC5185] focus:outline-none transition ${b.bgInput}`,required:!0})]})]}),(0,t.jsxs)("div",{className:`pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3 ${b.borderLine}`,children:[(0,t.jsx)("div",{className:"text-xs text-slate-500",children:d.tohtml.deepseekPromptDesc}),(0,t.jsx)("button",{type:"submit",disabled:A||0===N.length||!S.trim(),className:"w-full sm:w-auto bg-[#FC5185] hover:bg-[#e04373] text-white font-semibold text-xs px-6 py-2.5 rounded-lg shadow-lg shadow-[#FC5185]/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",children:A?(0,t.jsxs)(t.Fragment,{children:[(0,t.jsxs)("svg",{className:"animate-spin h-4 w-4 text-white",viewBox:"0 0 24 24",fill:"none",children:[(0,t.jsx)("circle",{className:"opacity-25",cx:"12",cy:"12",r:"10",stroke:"currentColor",strokeWidth:"4"}),(0,t.jsx)("path",{className:"opacity-75",fill:"currentColor",d:"M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"})]}),(0,t.jsx)("span",{children:d.tohtml.submitting})]}):(0,t.jsxs)(t.Fragment,{children:[(0,t.jsxs)("svg",{className:"w-4 h-4",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:[(0,t.jsx)("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:"2",d:"M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"}),(0,t.jsx)("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:"2",d:"M21 12a9 9 0 11-18 0 9 9 0 0118 0z"})]}),(0,t.jsxs)("span",{children:[d.tohtml.startProcessing," (",M," / ",N.length,")"]})]})})]})]})}),z&&(0,t.jsxs)("div",{className:"bg-rose-950/80 border border-rose-800 rounded-xl p-4 text-rose-200 text-xs flex items-center justify-between shadow-lg",children:[(0,t.jsxs)("div",{className:"flex items-center gap-2",children:[(0,t.jsx)("svg",{className:"w-5 h-5 text-rose-400 shrink-0",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:(0,t.jsx)("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:"2",d:"M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"})}),(0,t.jsx)("span",{children:z})]}),(0,t.jsx)("button",{onClick:()=>q(null),className:"text-rose-400 hover:text-white font-bold text-sm",children:"×"})]}),D&&(0,t.jsxs)("div",{className:"grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3",children:[(0,t.jsxs)("div",{className:`p-4 rounded-xl border ${b.bgCard}`,children:[(0,t.jsx)("span",{className:`text-[11px] font-semibold uppercase tracking-wider block mb-1 ${b.textMuted}`,children:d.tohtml.totalSections}),(0,t.jsx)("span",{className:`text-2xl font-extrabold ${b.textTitle}`,children:D.summary.total})]}),(0,t.jsxs)("div",{className:`p-4 rounded-xl border ${b.bgCard}`,children:[(0,t.jsx)("span",{className:"text-[11px] font-semibold uppercase tracking-wider text-emerald-400 block mb-1",children:d.tohtml.completedSections}),(0,t.jsx)("span",{className:"text-2xl font-extrabold text-emerald-400",children:D.summary.completed})]}),(0,t.jsxs)("div",{className:`p-4 rounded-xl border ${b.bgCard}`,children:[(0,t.jsx)("span",{className:"text-[11px] font-semibold uppercase tracking-wider text-amber-400 block mb-1",children:d.tohtml.processingSections}),(0,t.jsx)("span",{className:"text-2xl font-extrabold text-amber-400",children:D.summary.processing})]}),(0,t.jsxs)("div",{className:`p-4 rounded-xl border ${b.bgCard}`,children:[(0,t.jsx)("span",{className:"text-[11px] font-semibold uppercase tracking-wider text-rose-400 block mb-1",children:d.tohtml.failedSections}),(0,t.jsx)("span",{className:"text-2xl font-extrabold text-rose-400",children:D.summary.failed})]}),(0,t.jsxs)("div",{className:`p-4 rounded-xl border ${b.bgCard}`,children:[(0,t.jsx)("span",{className:`text-[11px] font-semibold uppercase tracking-wider block mb-1 ${b.textMuted}`,children:d.common.pending}),(0,t.jsx)("span",{className:`text-2xl font-extrabold ${b.textTitle}`,children:D.summary.pending})]}),(0,t.jsxs)("div",{className:`p-4 rounded-xl border ${b.bgCard}`,children:[(0,t.jsx)("span",{className:`text-[11px] font-semibold uppercase tracking-wider block mb-1 ${b.textMuted}`,children:d.tohtml.avgDuration}),(0,t.jsx)("span",{className:`text-2xl font-extrabold ${b.textTitle}`,children:ed(D.summary.avgDurationMs)})]})]}),(0,t.jsxs)("div",{className:`border-b flex items-center justify-between ${b.borderLine}`,children:[(0,t.jsxs)("div",{className:"flex gap-4",children:[(0,t.jsxs)("button",{onClick:()=>K("sections"),className:`pb-3 text-xs font-bold transition-all border-b-2 ${"sections"===_?"border-[#FC5185] text-[#FC5185]":`border-transparent ${b.textMuted} hover:${b.textTitle}`}`,children:[d.tohtml.tabSections," ",D?`(${D.sections.length})`:""]}),N.length>0&&(0,t.jsxs)("button",{onClick:()=>K("preview"),className:`pb-3 text-xs font-bold transition-all border-b-2 ${"preview"===_?"border-[#FC5185] text-[#FC5185]":`border-transparent ${b.textMuted} hover:${b.textTitle}`}`,children:[d.tohtml.tabPreview," (",N.length,")"]}),(0,t.jsxs)("button",{onClick:()=>K("logs"),className:`pb-3 text-xs font-bold transition-all border-b-2 ${"logs"===_?"border-[#FC5185] text-[#FC5185]":`border-transparent ${b.textMuted} hover:${b.textTitle}`}`,children:[d.tohtml.tabLogs," (",D?.logs.length||0,")"]})]}),D&&(0,t.jsxs)("div",{className:"flex items-center gap-2 pb-2",children:[D.summary.failed>0&&(0,t.jsxs)("button",{type:"button",onClick:ei,className:"px-3 py-1.5 rounded-lg border border-rose-800 bg-rose-950/60 hover:bg-rose-900 text-rose-200 text-xs font-semibold transition flex items-center gap-1.5",children:[(0,t.jsx)("svg",{className:"w-3.5 h-3.5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:(0,t.jsx)("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:"2",d:"M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"})}),(0,t.jsxs)("span",{children:[d.tohtml.retryFailed," (",D.summary.failed,")"]})]}),D.summary.completed>0&&(0,t.jsxs)("button",{type:"button",onClick:()=>{if(!P)return;let e=`/api/tohtml/download?jobId=${encodeURIComponent(P)}&merged=true`,t=document.createElement("a");t.href=e,t.download=`${D?.fileName.replace(/\.[^/.]+$/,"")||"job"}-merged.txt`,document.body.appendChild(t),t.click(),document.body.removeChild(t)},className:"px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm",children:[(0,t.jsx)("svg",{className:"w-3.5 h-3.5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:(0,t.jsx)("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:"2",d:"M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"})}),(0,t.jsx)("span",{children:d.tohtml.downloadMergedHtml})]})]})]}),"sections"===_&&(0,t.jsxs)("div",{className:"space-y-4",children:[(0,t.jsxs)("div",{className:"flex flex-col sm:flex-row items-center justify-between gap-3",children:[(0,t.jsx)("input",{type:"text",value:Y,onChange:e=>V(e.target.value),placeholder:"Search sections by content or marker...",className:`rounded-lg px-3 py-1.5 text-xs w-full sm:w-72 focus:outline-none focus:ring-1 focus:ring-[#FC5185] ${b.bgInput}`}),(0,t.jsx)("div",{className:"flex items-center gap-2 w-full sm:w-auto",children:(0,t.jsxs)("select",{value:G,onChange:e=>J(e.target.value),className:`text-xs rounded-lg px-3 py-1.5 focus:outline-none ${b.bgInput}`,children:[(0,t.jsx)("option",{value:"all",children:d.pipeline.filterAllStatuses}),(0,t.jsx)("option",{value:"completed",children:d.common.completed}),(0,t.jsx)("option",{value:"processing",children:d.common.processing}),(0,t.jsx)("option",{value:"failed",children:d.common.failed}),(0,t.jsx)("option",{value:"pending",children:d.common.pending})]})})]}),(0,t.jsx)("div",{className:`overflow-x-auto rounded-xl border ${b.borderLine}`,children:(0,t.jsxs)("table",{className:`w-full text-xs ${m?"text-right":"text-left"}`,children:[(0,t.jsx)("thead",{className:`uppercase font-semibold border-b ${u?"bg-[#1A2634] text-[#F5F5F5]/70 border-[#364F6B]":"bg-[#F5F5F5] text-[#364F6B]/75 border-[#364F6B]/20"}`,children:(0,t.jsxs)("tr",{children:[(0,t.jsx)("th",{className:"p-3",children:"#"}),(0,t.jsx)("th",{className:"p-3",children:d.tohtml.thMarker}),(0,t.jsx)("th",{className:"p-3",children:d.tohtml.thLength}),(0,t.jsx)("th",{className:"p-3",children:d.tohtml.thContentPreview}),(0,t.jsx)("th",{className:"p-3",children:d.tohtml.thStatus}),(0,t.jsx)("th",{className:"p-3",children:d.tohtml.avgDuration}),(0,t.jsx)("th",{className:`p-3 ${m?"text-left":"text-right"}`,children:d.tohtml.thActions})]})}),(0,t.jsx)("tbody",{className:`divide-y ${b.borderLine}`,children:D&&0!==el.length?el.map(e=>(0,t.jsxs)("tr",{className:`transition-colors ${u?"hover:bg-[#1A2634]/50":"hover:bg-[#F5F5F5]"}`,children:[(0,t.jsx)("td",{className:"p-3 font-mono text-slate-500",children:e.index+1}),(0,t.jsx)("td",{className:"p-3",children:(0,t.jsx)("span",{className:`px-2.5 py-1 rounded-md font-mono font-bold text-[11px] ${"Preamble"===e.marker?"bg-amber-950 text-amber-300 border border-amber-800":"bg-[#FC5185]/15 text-[#FC5185] border border-[#FC5185]/30"}`,children:e.label||e.marker})}),(0,t.jsxs)("td",{className:"p-3 font-mono text-slate-400",children:[void 0!==e.lineCount?`${e.lineCount} lines \xb7 `:"",e.charCount.toLocaleString()," chars"]}),(0,t.jsxs)("td",{className:"p-3 max-w-xs truncate font-mono text-slate-400",children:[e.content.slice(0,70),"..."]}),(0,t.jsxs)("td",{className:"p-3",children:[(0,t.jsxs)("span",{className:`px-2.5 py-1 rounded font-bold uppercase text-[10px] inline-flex items-center gap-1.5 ${"completed"===e.status?"bg-emerald-950 text-emerald-300 border border-emerald-800":"failed"===e.status?"bg-rose-950 text-rose-300 border border-rose-800":"processing"===e.status?"bg-amber-950 text-amber-300 border border-amber-800 animate-pulse":"bg-slate-800 text-slate-400"}`,children:["processing"===e.status&&(0,t.jsxs)("svg",{className:"animate-spin h-3 w-3 text-amber-300",viewBox:"0 0 24 24",fill:"none",children:[(0,t.jsx)("circle",{className:"opacity-25",cx:"12",cy:"12",r:"10",stroke:"currentColor",strokeWidth:"4"}),(0,t.jsx)("path",{className:"opacity-75",fill:"currentColor",d:"M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"})]}),e.status]}),e.error&&(0,t.jsx)("p",{className:"text-rose-400 text-[10px] mt-1 line-clamp-1",title:e.error,children:e.error})]}),(0,t.jsx)("td",{className:"p-3 font-mono text-slate-400",children:ed(e.durationMs)}),(0,t.jsx)("td",{className:"p-3 text-right",children:(0,t.jsxs)("div",{className:"flex items-center justify-end gap-2",children:[(0,t.jsx)("button",{type:"button",onClick:()=>O({marker:e.marker,label:e.label||e.marker,content:e.content,charCount:e.charCount,lineCount:e.lineCount,isInput:!0,outputFilename:e.outputFilename}),className:"p-1.5 rounded hover:bg-[#364F6B]/30 text-[#3FC1C9] text-xs font-semibold",title:"Inspect Section Content",children:(0,t.jsxs)("svg",{className:"w-4 h-4",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:[(0,t.jsx)("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:"2",d:"M15 12a3 3 0 11-6 0 3 3 0 016 0z"}),(0,t.jsx)("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:"2",d:"M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"})]})}),"completed"===e.status&&(0,t.jsxs)("button",{type:"button",onClick:()=>((e,t)=>{if(!P)return;let s=`/api/tohtml/download?jobId=${encodeURIComponent(P)}&sectionIndex=${e}${t?`&filename=${encodeURIComponent(t)}`:""}`,a=document.createElement("a");a.href=s,a.download=t||`section-${e+1}.txt`,document.body.appendChild(a),a.click(),document.body.removeChild(a)})(e.index,e.outputFilename),className:"px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] flex items-center gap-1 shadow-sm",children:[(0,t.jsx)("svg",{className:"w-3.5 h-3.5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:(0,t.jsx)("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:"2",d:"M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"})}),(0,t.jsx)("span",{children:"Download TXT"})]}),"failed"===e.status&&(0,t.jsxs)("button",{type:"button",onClick:()=>eo(e.index),className:"px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold text-[11px] flex items-center gap-1 shadow-sm",children:[(0,t.jsx)("svg",{className:"w-3.5 h-3.5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:(0,t.jsx)("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:"2",d:"M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"})}),(0,t.jsx)("span",{children:"Retry"})]})]})})]},e.id)):(0,t.jsx)("tr",{children:(0,t.jsx)("td",{colSpan:7,className:`text-center py-12 italic ${b.textMuted}`,children:D?d.tohtml.noSectionsMatch:d.common.noData})})})]})})]}),"preview"===_&&(0,t.jsxs)("div",{className:"space-y-4",children:[(0,t.jsxs)("div",{className:"flex items-center justify-between",children:[(0,t.jsxs)("span",{className:`text-xs font-semibold ${b.textTitle}`,children:["Detected ",N.length," sections (",M," chunk",1!==M?"s":"",') from "',v,'"']}),(0,t.jsxs)("span",{className:`text-xs ${b.textMuted}`,children:["Total ",y.length.toLocaleString()," characters"]})]}),(0,t.jsx)("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-4",children:N.map(e=>{let s=r(e.content,600),a=s.length>0?s:[e.content||""],n=e.content?e.content.split(/\r?\n/).length:0;return(0,t.jsxs)("div",{className:`p-4 rounded-xl border flex flex-col justify-between gap-3 ${b.bgCard}`,children:[(0,t.jsxs)("div",{children:[(0,t.jsxs)("div",{className:"flex items-center justify-between gap-2 mb-2",children:[(0,t.jsx)("span",{className:`px-2.5 py-0.5 rounded font-mono font-bold text-xs ${e.isPreamble?"bg-amber-950 text-amber-300 border border-amber-800":"bg-[#FC5185]/15 text-[#FC5185] border border-[#FC5185]/30"}`,children:e.marker}),(0,t.jsxs)("span",{className:"text-slate-400 font-mono text-xs",children:[a.length," chunk",a.length>1?"s":""," · ",n," lines · ",e.charCount.toLocaleString()," chars"]})]}),a.length>1&&(0,t.jsx)("div",{className:"mb-2 flex flex-wrap gap-1",children:a.map((e,s)=>(0,t.jsxs)("span",{className:`px-2 py-0.5 rounded text-[10px] font-mono border ${u?"bg-[#1A2634] border-[#364F6B] text-[#F5F5F5]/80":"bg-[#F5F5F5] border-[#364F6B]/20 text-[#364F6B]"}`,children:["Chunk ",s+1,": ",e?e.split(/\r?\n/).length:0," lines"]},s))}),(0,t.jsxs)("pre",{className:`text-xs font-mono p-3 rounded-lg max-h-40 overflow-y-auto whitespace-pre-wrap ${u?"bg-[#1A2634] text-[#F5F5F5]":"bg-[#F5F5F5] text-[#364F6B]"}`,children:[e.content.slice(0,300),e.content.length>300?"...":""]})]}),(0,t.jsx)("button",{type:"button",onClick:()=>O({marker:e.marker,label:e.marker,content:e.content,charCount:e.charCount,lineCount:n,isInput:!0}),className:`w-full py-1.5 rounded-lg border text-xs font-semibold transition ${u?"border-[#364F6B] bg-[#1A2634] hover:bg-[#243447] text-[#F5F5F5]":"border-[#364F6B]/20 bg-white hover:bg-[#F5F5F5] text-[#364F6B]"}`,children:"View Full Section"})]},e.index)})})]}),"logs"===_&&(0,t.jsxs)("div",{className:"space-y-4",children:[(0,t.jsxs)("div",{className:"flex flex-col sm:flex-row items-center justify-between gap-3",children:[(0,t.jsx)("input",{type:"text",value:ee,onChange:e=>et(e.target.value),placeholder:"Search log messages...",className:`rounded-lg px-3 py-1.5 text-xs w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-[#FC5185] ${b.bgInput}`}),(0,t.jsxs)("select",{value:Q,onChange:e=>Z(e.target.value),className:`text-xs rounded-lg px-3 py-1.5 focus:outline-none ${b.bgInput}`,children:[(0,t.jsx)("option",{value:"ALL",children:"All Levels"}),(0,t.jsx)("option",{value:"INFO",children:"INFO"}),(0,t.jsx)("option",{value:"WARN",children:"WARN"}),(0,t.jsx)("option",{value:"ERROR",children:"ERROR"})]})]}),(0,t.jsx)("div",{className:`p-4 rounded-xl border font-mono text-xs max-h-[500px] overflow-y-auto space-y-1 ${u?"bg-[#1A2634] border-[#364F6B]":"bg-[#243447] border-[#364F6B] text-[#F5F5F5]"}`,children:0===ec.length?(0,t.jsx)("p",{className:"text-slate-500 italic",children:"No logs recorded."}):ec.map(e=>{var s;return(0,t.jsxs)("div",{className:"flex gap-3 leading-relaxed",children:[(0,t.jsx)("span",{className:"text-slate-500 shrink-0",children:(s=e.timestamp)?new Date(s).toLocaleTimeString():"—"}),(0,t.jsxs)("span",{className:`font-bold shrink-0 ${"ERROR"===e.level?"text-rose-400":"WARN"===e.level?"text-amber-400":"text-emerald-400"}`,children:["[",e.level,"]"]}),e.marker&&(0,t.jsxs)("span",{className:"text-[#3FC1C9] shrink-0",children:["[",e.marker,"]"]}),(0,t.jsx)("span",{className:"text-slate-300",children:e.message})]},e.id)})})]})]}),R&&(0,t.jsx)("div",{className:"fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4",children:(0,t.jsxs)("div",{className:`w-full max-w-4xl max-h-[85vh] rounded-2xl border flex flex-col shadow-2xl ${b.bgCard}`,children:[(0,t.jsxs)("div",{className:`p-4 border-b flex items-center justify-between ${b.borderLine}`,children:[(0,t.jsxs)("div",{className:"flex items-center gap-3",children:[(0,t.jsx)("span",{className:"px-2.5 py-1 rounded bg-[#FC5185]/15 text-[#FC5185] border border-[#FC5185]/30 font-mono font-bold text-xs",children:R.label||R.marker}),(0,t.jsxs)("span",{className:`text-xs ${b.textMuted}`,children:[void 0!==R.lineCount?`${R.lineCount} lines \xb7 `:"",R.charCount.toLocaleString()," characters"]})]}),(0,t.jsx)("button",{type:"button",onClick:()=>O(null),className:"text-slate-400 hover:text-white font-bold text-lg px-2",children:"✕"})]}),(0,t.jsx)("div",{className:"p-4 overflow-y-auto flex-1",children:(0,t.jsx)("pre",{className:`p-4 rounded-xl font-mono text-xs whitespace-pre-wrap select-text leading-relaxed ${u?"bg-[#1A2634] text-[#F5F5F5]":"bg-[#F5F5F5] text-[#364F6B]"}`,children:R.content})}),(0,t.jsx)("div",{className:`p-4 border-t flex justify-end gap-3 ${b.borderLine}`,children:(0,t.jsx)("button",{type:"button",onClick:()=>O(null),className:`px-4 py-2 rounded-lg border text-xs font-semibold ${u?"border-[#364F6B] hover:bg-[#1A2634] text-[#F5F5F5]":"border-[#364F6B]/30 hover:bg-[#F5F5F5] text-[#364F6B]"}`,children:"Close"})})]})})]})})}],65010)}]);