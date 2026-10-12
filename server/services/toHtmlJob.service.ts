import { resolveUniqueFolderName } from "./storage.service";
import { splitByLines } from "../lib/splitByLines";

export type ToHtmlSectionStatus = "pending" | "processing" | "completed" | "failed";

export interface ToHtmlSectionRecord {
  id: string;
  index: number;
  sectionIndex: number;
  marker: string;
  markerNumber: number | null;
  chunkIndex: number;
  chunkNumber: number;
  totalChunks: number;
  label: string;
  content: string;
  charCount: number;
  lineCount: number;
  status: ToHtmlSectionStatus;
  outputFilename?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export interface ToHtmlLog {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  sectionIndex?: number;
  marker?: string;
  error?: string;
}

export interface ToHtmlSummary {
  total: number;
  completed: number;
  processing: number;
  failed: number;
  pending: number;
  avgDurationMs: number;
}

export interface ToHtmlJob {
  id: string;
  fileName: string;
  folderName: string;
  prompt: string;
  status: "queued" | "processing" | "completed" | "failed";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  sections: ToHtmlSectionRecord[];
  logs: ToHtmlLog[];
}

export interface CreateToHtmlJobInput {
  fileName: string;
  prompt: string;
  maxLinesPerChunk?: number;
  sections: Array<{
    marker: string;
    markerNumber: number | null;
    content: string;
    charCount: number;
  }>;
}

const jobs = new Map<string, ToHtmlJob>();

export function createToHtmlJob(input: CreateToHtmlJobInput): ToHtmlJob {
  const baseName = input.fileName.replace(/\.[^/.]+$/, "") || "tohtml";
  const folderName = resolveUniqueFolderName(`tohtml-${baseName}`, (candidate) => {
    for (const j of jobs.values()) {
      if (j.folderName === candidate) return true;
    }
    return false;
  });

  const maxLines = input.maxLinesPerChunk && input.maxLinesPerChunk > 0 ? input.maxLinesPerChunk : 600;
  const sectionRecords: ToHtmlSectionRecord[] = [];
  let globalIndex = 0;

  input.sections.forEach((sec, sIdx) => {
    const rawChunks = splitByLines(sec.content, maxLines);
    const chunks = rawChunks.length > 0 ? rawChunks : [sec.content || ""];
    const totalChunks = chunks.length;

    chunks.forEach((chunkText, cIdx) => {
      const chunkNumber = cIdx + 1;
      const label = totalChunks > 1
        ? `${sec.marker} — Chunk ${chunkNumber}/${totalChunks}`
        : `${sec.marker} — Chunk 1/1`;

      const lineCount = chunkText ? chunkText.split(/\r?\n/).length : 0;

      sectionRecords.push({
        id: crypto.randomUUID(),
        index: globalIndex++,
        sectionIndex: sIdx,
        marker: sec.marker,
        markerNumber: sec.markerNumber,
        chunkIndex: cIdx,
        chunkNumber,
        totalChunks,
        label,
        content: chunkText,
        charCount: chunkText.length,
        lineCount,
        status: "pending",
      });
    });
  });

  const job: ToHtmlJob = {
    id: crypto.randomUUID(),
    fileName: input.fileName,
    folderName,
    prompt: input.prompt,
    status: "queued",
    createdAt: new Date().toISOString(),
    sections: sectionRecords,
    logs: [
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        level: "INFO",
        message: `Job created with ${input.sections.length} section(s) split into ${sectionRecords.length} chunk(s) from "${input.fileName}".`,
      },
    ],
  };

  jobs.set(job.id, job);
  return job;
}

export function getToHtmlJob(id: string): ToHtmlJob | undefined {
  return jobs.get(id);
}

export function updateToHtmlJobStatus(id: string, status: ToHtmlJob["status"]) {
  const job = jobs.get(id);
  if (!job) return;
  job.status = status;
  if (status === "processing" && !job.startedAt) {
    job.startedAt = new Date().toISOString();
  } else if (status === "completed" || status === "failed") {
    job.completedAt = new Date().toISOString();
  }
}

export function updateToHtmlSection(
  jobId: string,
  sectionIndex: number,
  data: Partial<ToHtmlSectionRecord>
) {
  const job = jobs.get(jobId);
  if (!job) return;

  const section = job.sections[sectionIndex];
  if (!section) return;

  Object.assign(section, data);
}

export function addToHtmlLog(
  jobId: string,
  log: Omit<ToHtmlLog, "id" | "timestamp">
) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.logs.push({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...log,
  });
}

export function getToHtmlJobDetails(id: string) {
  const job = jobs.get(id);
  if (!job) return null;

  let completed = 0;
  let processing = 0;
  let failed = 0;
  let pending = 0;
  let totalDurationMs = 0;
  let durationCount = 0;

  for (const s of job.sections) {
    if (s.status === "completed") {
      completed++;
      if (s.durationMs) {
        totalDurationMs += s.durationMs;
        durationCount++;
      }
    } else if (s.status === "processing") {
      processing++;
    } else if (s.status === "failed") {
      failed++;
    } else {
      pending++;
    }
  }

  const avgDurationMs = durationCount > 0 ? Math.round(totalDurationMs / durationCount) : 0;

  const summary: ToHtmlSummary = {
    total: job.sections.length,
    completed,
    processing,
    failed,
    pending,
    avgDurationMs,
  };

  return {
    id: job.id,
    fileName: job.fileName,
    folderName: job.folderName,
    prompt: job.prompt,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    sections: job.sections,
    logs: job.logs,
    summary,
  };
}

export function getAllToHtmlJobs() {
  return Array.from(jobs.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((job) => {
      const details = getToHtmlJobDetails(job.id);
      return {
        id: job.id,
        fileName: job.fileName,
        status: job.status,
        createdAt: job.createdAt,
        totalSections: job.sections.length,
        completedSections: details?.summary.completed ?? 0,
        failedSections: details?.summary.failed ?? 0,
      };
    });
}
