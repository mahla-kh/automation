import fs from "fs/promises";
import path from "path";
import { splitByLines } from "../server/lib/splitByLines";
import { parseCutSections } from "../server/lib/cutParser";
import {
  createToHtmlJob,
  getToHtmlJob,
  getToHtmlJobDetails,
  updateToHtmlSection,
  updateToHtmlJobStatus,
  getAllToHtmlJobs,
} from "../server/services/toHtmlJob.service";
import {
  buildToHtmlFilename,
  getJobOutputPath,
} from "../server/services/toHtmlRunner.service";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runFlowTest() {
  console.log("Starting Line-Based Chunking & /tohtml Comprehensive Verification...\n");

  // =========================================================================
  // Requirement 1 & 2: Chunking utility line-count tests
  // =========================================================================
  console.log("--- 1. Testing splitByLines Core Invariants ---");

  // 1.1: 100 lines -> 1 chunk
  const lines100 = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join("\n");
  const chunks100 = splitByLines(lines100, 600);
  assert(chunks100.length === 1, `Expected 1 chunk for 100 lines, got ${chunks100.length}`);
  assert(chunks100[0].split("\n").length === 100, "Chunk 1 should have 100 lines");
  console.log("✔ Test 1: Section with 100 lines produces 1 chunk.");

  // 1.2: Exactly 600 lines -> 1 chunk
  const lines600 = Array.from({ length: 600 }, (_, i) => `Line ${i + 1}`).join("\n");
  const chunks600 = splitByLines(lines600, 600);
  assert(chunks600.length === 1, `Expected 1 chunk for 600 lines, got ${chunks600.length}`);
  assert(chunks600[0].split("\n").length === 600, "Chunk 1 should have 600 lines");
  console.log("✔ Test 2: Section with exactly 600 lines produces 1 chunk.");

  // 1.3: 601 lines -> 2 chunks (600 and 1)
  const lines601 = Array.from({ length: 601 }, (_, i) => `Line ${i + 1}`).join("\n");
  const chunks601 = splitByLines(lines601, 600);
  assert(chunks601.length === 2, `Expected 2 chunks for 601 lines, got ${chunks601.length}`);
  assert(chunks601[0].split("\n").length === 600, `Expected 600 lines in chunk 1, got ${chunks601[0].split("\n").length}`);
  assert(chunks601[1].split("\n").length === 1, `Expected 1 line in chunk 2, got ${chunks601[1].split("\n").length}`);
  assert(chunks601[1] === "Line 601", "Chunk 2 content matches 601st line");
  console.log("✔ Test 3: Section with 601 lines produces 2 chunks (600 and 1 lines).");

  // 1.4: 1,350 lines -> 3 chunks (600, 600, 150)
  const lines1350 = Array.from({ length: 1350 }, (_, i) => `Line ${i + 1}`).join("\n");
  const chunks1350 = splitByLines(lines1350, 600);
  assert(chunks1350.length === 3, `Expected 3 chunks for 1350 lines, got ${chunks1350.length}`);
  assert(chunks1350[0].split("\n").length === 600, "Chunk 1 has 600 lines");
  assert(chunks1350[1].split("\n").length === 600, "Chunk 2 has 600 lines");
  assert(chunks1350[2].split("\n").length === 150, "Chunk 3 has 150 lines");
  assert(chunks1350[0].startsWith("Line 1\n"), "Chunk 1 starts with Line 1");
  assert(chunks1350[1].startsWith("Line 601\n"), "Chunk 2 starts with Line 601");
  assert(chunks1350[2].startsWith("Line 1201\n") && chunks1350[2].endsWith("Line 1350"), "Chunk 3 ends with Line 1350");
  console.log("✔ Test 4: Section with 1,350 lines produces 3 chunks (600, 600, and 150 lines).");

  // 1.5: CRLF handling & empty string
  const crlfText = "Line A\r\nLine B\r\nLine C\r\nLine D";
  const crlfChunks = splitByLines(crlfText, 2);
  assert(crlfChunks.length === 2, "CRLF split correctly into 2 chunks");
  assert(crlfChunks[0] === "Line A\nLine B", "Chunk 0 normalized without stray \\r");
  assert(crlfChunks[1] === "Line C\nLine D", "Chunk 1 normalized without stray \\r");

  const emptyChunks = splitByLines("", 600);
  assert(emptyChunks.length === 0, "Empty string returns empty array");
  console.log("✔ Test 5: LF/CRLF and empty inputs handled properly.");

  // =========================================================================
  // Requirement 3: Multiple CUT sections chunked independently
  // =========================================================================
  console.log("\n--- 2. Testing Multiple Independent CUT Sections ---");

  const sampleRawText = `
Preamble text before any questions.

========================================
CUT 1
========================================
${Array.from({ length: 1350 }, (_, i) => `CUT 1 Medical Line ${i + 1}`).join("\n")}

========================================
CUT 2
========================================
${Array.from({ length: 500 }, (_, i) => `CUT 2 Medical Line ${i + 1}`).join("\n")}

========================================
CUT 3
========================================
${Array.from({ length: 50 }, (_, i) => `CUT 3 Medical Line ${i + 1}`).join("\n")}
`;

  const parseResult = parseCutSections(sampleRawText);
  assert(parseResult.sections.length === 4, `Expected 4 parsed sections (1 Preamble + 3 CUTs), got ${parseResult.sections.length}`);
  assert(parseResult.sections[0].marker === "Preamble", "Section 0 is Preamble");
  assert(parseResult.sections[1].marker === "CUT 1", "Section 1 is CUT 1");
  assert(parseResult.sections[2].marker === "CUT 2", "Section 2 is CUT 2");
  assert(parseResult.sections[3].marker === "CUT 3", "Section 3 is CUT 3");

  const job = createToHtmlJob({
    fileName: "medical-study-guide.txt",
    prompt: "You are an expert medical document designer.",
    sections: parseResult.sections,
  });

  // Preamble: 1 line -> 1 chunk
  // CUT 1: 1350 lines -> 3 chunks
  // CUT 2: 500 lines -> 1 chunk
  // CUT 3: 50 lines -> 1 chunk
  // Total: 1 + 3 + 1 + 1 = 6 chunk records
  assert(job.sections.length === 6, `Expected 6 chunk records in job, got ${job.sections.length}`);
  
  // Verify labels and chunk indices
  assert(job.sections[0].label === "Preamble — Chunk 1/1", `Preamble label mismatch: ${job.sections[0].label}`);
  assert(job.sections[1].label === "CUT 1 — Chunk 1/3", `CUT 1 chunk 1 label mismatch: ${job.sections[1].label}`);
  assert(job.sections[2].label === "CUT 1 — Chunk 2/3", `CUT 1 chunk 2 label mismatch: ${job.sections[2].label}`);
  assert(job.sections[3].label === "CUT 1 — Chunk 3/3", `CUT 1 chunk 3 label mismatch: ${job.sections[3].label}`);
  assert(job.sections[4].label === "CUT 2 — Chunk 1/1", `CUT 2 chunk 1 label mismatch: ${job.sections[4].label}`);
  assert(job.sections[5].label === "CUT 3 — Chunk 1/1", `CUT 3 chunk 1 label mismatch: ${job.sections[5].label}`);

  assert(job.sections[1].lineCount === 600, "CUT 1 chunk 1 has 600 lines");
  assert(job.sections[2].lineCount === 600, "CUT 1 chunk 2 has 600 lines");
  assert(job.sections[3].lineCount === 150, "CUT 1 chunk 3 has 150 lines");
  assert(job.sections[4].lineCount === 500, "CUT 2 chunk 1 has 500 lines");
  assert(job.sections[5].lineCount === 50, "CUT 3 chunk 1 has 50 lines");

  console.log("✔ Test 6: Multiple CUT sections chunked independently and labeled (CUT 1: 3 chunks, CUT 2: 1 chunk, CUT 3: 1 chunk).");

  // =========================================================================
  // Requirement 4 & 6: Filename generation and isolated chunk downloads
  // =========================================================================
  console.log("\n--- 3. Testing Filename Generation & Storage Isolation ---");

  const f0 = buildToHtmlFilename(job.sections[0].index, job.sections[0].marker, job.sections[0].chunkNumber);
  const f1 = buildToHtmlFilename(job.sections[1].index, job.sections[1].marker, job.sections[1].chunkNumber);
  const f2 = buildToHtmlFilename(job.sections[2].index, job.sections[2].marker, job.sections[2].chunkNumber);
  const f3 = buildToHtmlFilename(job.sections[3].index, job.sections[3].marker, job.sections[3].chunkNumber);
  const f4 = buildToHtmlFilename(job.sections[4].index, job.sections[4].marker, job.sections[4].chunkNumber);
  const f5 = buildToHtmlFilename(job.sections[5].index, job.sections[5].marker, job.sections[5].chunkNumber);

  assert(f0 === "0001-Preamble-chunk-1.txt", `Got ${f0}`);
  assert(f1 === "0002-CUT-1-chunk-1.txt", `Got ${f1}`);
  assert(f2 === "0003-CUT-1-chunk-2.txt", `Got ${f2}`);
  assert(f3 === "0004-CUT-1-chunk-3.txt", `Got ${f3}`);
  assert(f4 === "0005-CUT-2-chunk-1.txt", `Got ${f4}`);
  assert(f5 === "0006-CUT-3-chunk-1.txt", `Got ${f5}`);

  console.log("✔ Test 7: Filename formatting generated collision-safe names with CUT number and chunk index.");

  // Test output path isolation & path traversal protection
  const outputPath = getJobOutputPath(job.folderName, f1);
  assert(outputPath.includes(path.join("outputs", job.folderName, f1)), "Output path matches job isolated directory");

  let traversalBlocked = false;
  try {
    getJobOutputPath(job.folderName, "../../evil.txt");
  } catch {
    traversalBlocked = true;
  }
  assert(traversalBlocked, "Path traversal was prevented");
  console.log("✔ Test 8: Folder isolation and path traversal prevention verified.");

  // =========================================================================
  // Requirement 5 & 7: Chunk-level status tracking, failure isolation & summary
  // =========================================================================
  console.log("\n--- 4. Testing Chunk Status Tracking & Failure Isolation ---");

  updateToHtmlJobStatus(job.id, "processing");

  // Complete chunk 0 and 1
  updateToHtmlSection(job.id, 0, {
    status: "completed",
    outputFilename: f0,
    durationMs: 350,
  });
  updateToHtmlSection(job.id, 1, {
    status: "completed",
    outputFilename: f1,
    durationMs: 400,
  });
  // Fail chunk 2
  updateToHtmlSection(job.id, 2, {
    status: "failed",
    error: "Simulated DeepSeek network timeout",
    durationMs: 150,
  });
  // Keep chunk 3 processing
  updateToHtmlSection(job.id, 3, {
    status: "processing",
  });
  // Chunks 4 and 5 remain pending

  const details = getToHtmlJobDetails(job.id);
  assert(details !== null, "Job details retrieved");
  assert(details?.summary.total === 6, `Expected total 6, got ${details?.summary.total}`);
  assert(details?.summary.completed === 2, `Expected completed 2, got ${details?.summary.completed}`);
  assert(details?.summary.failed === 1, `Expected failed 1, got ${details?.summary.failed}`);
  assert(details?.summary.processing === 1, `Expected processing 1, got ${details?.summary.processing}`);
  assert(details?.summary.pending === 2, `Expected pending 2, got ${details?.summary.pending}`);

  // Test failure isolation: completed chunks 0 and 1 have output files retained
  assert(job.sections[0].status === "completed" && job.sections[0].outputFilename === f0, "Chunk 0 output intact");
  assert(job.sections[1].status === "completed" && job.sections[1].outputFilename === f1, "Chunk 1 output intact");
  assert(job.sections[2].status === "failed" && job.sections[2].error !== undefined, "Chunk 2 failure recorded");

  console.log("✔ Test 9: Chunk-level state updates and summary calculations passed.");
  console.log("✔ Test 10: Failed chunk does not erase or block successful chunks.");

  // =========================================================================
  // Requirement 8 & 9: Individual file write/read verification
  // =========================================================================
  console.log("\n--- 5. Testing Response UTF-8 Storage ---");

  const targetDir = path.dirname(outputPath);
  await fs.mkdir(targetDir, { recursive: true });

  const chunk1Content = "<html><body><h1>بخش اول: فیزیولوژی ریه</h1><p>متن کامل بخش ۱...</p></body></html>";
  await fs.writeFile(outputPath, chunk1Content, "utf8");
  const readBack = await fs.readFile(outputPath, "utf8");
  assert(readBack === chunk1Content, "UTF-8 content matches exactly");

  // Clean up test folder
  await fs.rm(targetDir, { recursive: true, force: true });
  console.log("✔ Test 11: Chunk responses saved and read as UTF-8 without corruption.");

  console.log("\n============================================================");
  console.log("All 11 Line-Based Chunking Requirements Verified Successfully! 🚀");
  console.log("============================================================");
}

runFlowTest().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
