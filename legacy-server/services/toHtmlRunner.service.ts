import fs from "fs/promises";
import path from "path";
import { logger } from "../lib/logger";
import { deepseekChat } from "./AI/deepseek.service";
import {
  getToHtmlJob,
  updateToHtmlJobStatus,
  updateToHtmlSection,
  addToHtmlLog,
  ToHtmlJob,
  ToHtmlSectionRecord,
} from "./toHtmlJob.service";
import { sanitizeFolderName } from "./storage.service";

const OUTPUTS_ROOT = path.join(process.cwd(), "outputs");
const CONCURRENCY_LIMIT = 2;

/**
 * Builds deterministic response filename:
 * 0001-CUT-1-chunk-1.txt, 0002-CUT-1-chunk-2.txt, 0003-CUT-2-chunk-1.txt
 */
export function buildToHtmlFilename(
  index: number,
  marker: string,
  chunkNumber: number = 1
): string {
  const prefix = String(index + 1).padStart(4, "0");
  const safeMarker = marker.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9_-]/g, "");
  return `${prefix}-${safeMarker}-chunk-${chunkNumber}.txt`;
}

/**
 * Resolves full path to a job's output file inside outputs/<folderName>/<filename>.
 * Guarantees no path traversal.
 */
export function getJobOutputPath(folderName: string, filename: string): string {
  const safeFolder = sanitizeFolderName(folderName);
  const targetDir = path.resolve(OUTPUTS_ROOT, safeFolder);
  const fullPath = path.resolve(targetDir, filename);

  if (!fullPath.startsWith(OUTPUTS_ROOT + path.sep)) {
    throw new Error("Invalid output file path: path traversal detected");
  }

  return fullPath;
}

/**
 * Processes a single section chunk against DeepSeek and saves the output.
 */
async function processSingleSection(
  job: ToHtmlJob,
  section: ToHtmlSectionRecord
): Promise<void> {
  const startedAt = new Date().toISOString();
  const startMs = performance.now();
  const label = section.label || section.marker;

  updateToHtmlSection(job.id, section.index, {
    status: "processing",
    startedAt,
    error: undefined,
  });

  addToHtmlLog(job.id, {
    level: "INFO",
    message: `Processing ${label} (${section.lineCount} lines, ${section.charCount} characters)...`,
    sectionIndex: section.index,
    marker: section.marker,
  });

  try {
    const userPrompt = `Process the following section (${label}):\n\n${section.content}`;
    const responseText = await deepseekChat(job.prompt, userPrompt);

    if (!responseText || typeof responseText !== "string") {
      throw new Error("DeepSeek returned an empty response.");
    }

    // Save output file to disk
    const filename = buildToHtmlFilename(section.index, section.marker, section.chunkNumber || 1);
    const targetDir = path.join(OUTPUTS_ROOT, sanitizeFolderName(job.folderName));
    await fs.mkdir(targetDir, { recursive: true });

    const fullPath = path.join(targetDir, filename);
    await fs.writeFile(fullPath, responseText, "utf8");

    const durationMs = Math.round(performance.now() - startMs);
    const completedAt = new Date().toISOString();

    updateToHtmlSection(job.id, section.index, {
      status: "completed",
      outputFilename: filename,
      responseText,
      durationMs,
      completedAt,
    });

    addToHtmlLog(job.id, {
      level: "INFO",
      message: `${label} completed in ${durationMs}ms and saved to ${filename}.`,
      sectionIndex: section.index,
      marker: section.marker,
    });
  } catch (err) {
    const durationMs = Math.round(performance.now() - startMs);
    const completedAt = new Date().toISOString();
    const errorMsg = err instanceof Error ? err.message : String(err);

    updateToHtmlSection(job.id, section.index, {
      status: "failed",
      error: errorMsg,
      durationMs,
      completedAt,
    });

    addToHtmlLog(job.id, {
      level: "ERROR",
      message: `${label} failed: ${errorMsg}`,
      sectionIndex: section.index,
      marker: section.marker,
      error: errorMsg,
    });

    logger.error("Error processing section chunk with DeepSeek", {
      jobId: job.id,
      label,
      marker: section.marker,
      error: errorMsg,
    });
  }
}

/**
 * Executes a list of tasks with bounded concurrency.
 */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  const executing = new Set<Promise<void>>();

  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}

/**
 * Runs all pending section chunks for a job in the background.
 */
export async function runToHtmlJob(jobId: string): Promise<void> {
  const job = getToHtmlJob(jobId);
  if (!job) return;

  updateToHtmlJobStatus(jobId, "processing");
  addToHtmlLog(jobId, {
    level: "INFO",
    message: `Starting execution of ${job.sections.length} chunk(s) with concurrency ${CONCURRENCY_LIMIT}.`,
  });

  const pendingSections = job.sections.filter((s) => s.status === "pending");

  await runWithConcurrency(pendingSections, CONCURRENCY_LIMIT, (sec) =>
    processSingleSection(job, sec)
  );

  const freshJob = getToHtmlJob(jobId);
  if (!freshJob) return;

  const anyFailed = freshJob.sections.some((s) => s.status === "failed");
  const allCompleted = freshJob.sections.every((s) => s.status === "completed");

  if (allCompleted) {
    updateToHtmlJobStatus(jobId, "completed");
    addToHtmlLog(jobId, {
      level: "INFO",
      message: `All ${freshJob.sections.length} chunk(s) completed successfully!`,
    });
  } else if (anyFailed) {
    updateToHtmlJobStatus(jobId, "failed");
    const failedCount = freshJob.sections.filter((s) => s.status === "failed").length;
    addToHtmlLog(jobId, {
      level: "WARN",
      message: `Job finished with ${failedCount} failed chunk(s).`,
    });
  }
}

/**
 * Retries an individual section chunk that failed.
 */
export async function retryToHtmlSection(
  jobId: string,
  sectionIndex: number
): Promise<void> {
  const job = getToHtmlJob(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  const section = job.sections[sectionIndex];
  if (!section) {
    throw new Error(`Section chunk index ${sectionIndex} not found in job ${jobId}`);
  }

  const label = section.label || section.marker;
  updateToHtmlJobStatus(jobId, "processing");
  updateToHtmlSection(jobId, sectionIndex, { status: "pending", error: undefined });

  addToHtmlLog(jobId, {
    level: "INFO",
    message: `Retrying ${label}...`,
    sectionIndex,
    marker: section.marker,
  });

  // Execute in background
  void (async () => {
    await processSingleSection(job, section);
    const freshJob = getToHtmlJob(jobId);
    if (!freshJob) return;

    const anyFailed = freshJob.sections.some((s) => s.status === "failed");
    const allCompleted = freshJob.sections.every((s) => s.status === "completed");

    if (allCompleted) {
      updateToHtmlJobStatus(jobId, "completed");
    } else if (anyFailed) {
      updateToHtmlJobStatus(jobId, "failed");
    }
  })();
}

/**
 * Retries all failed section chunks in a job.
 */
export async function retryAllFailedSections(jobId: string): Promise<void> {
  const job = getToHtmlJob(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  const failedSections = job.sections.filter((s) => s.status === "failed");
  if (failedSections.length === 0) return;

  for (const s of failedSections) {
    updateToHtmlSection(jobId, s.index, { status: "pending", error: undefined });
  }

  updateToHtmlJobStatus(jobId, "processing");
  addToHtmlLog(jobId, {
    level: "INFO",
    message: `Retrying ${failedSections.length} failed chunk(s)...`,
  });

  void (async () => {
    await runWithConcurrency(failedSections, CONCURRENCY_LIMIT, (sec) =>
      processSingleSection(job, sec)
    );

    const freshJob = getToHtmlJob(jobId);
    if (!freshJob) return;

    const anyFailed = freshJob.sections.some((s) => s.status === "failed");
    const allCompleted = freshJob.sections.every((s) => s.status === "completed");

    if (allCompleted) {
      updateToHtmlJobStatus(jobId, "completed");
    } else if (anyFailed) {
      updateToHtmlJobStatus(jobId, "failed");
    }
  })();
}
