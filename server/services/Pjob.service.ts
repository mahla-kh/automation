import { DriveFile } from "@/types/drive";

export type StageStatus = "not_started" | "pending" | "in_progress" | "success" | "error" | "skipped";

export interface StageDetails {
  status: StageStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
  retryCount?: number;
}

export interface FileProcessingStatus {
  fileId: string;
  fileName: string;
  download: StageDetails;
  upload: StageDetails;
  ocr: StageDetails;
  reformat: StageDetails;
  overallStatus: "not_started" | "pending" | "in_progress" | "success" | "error";
  startedAt?: string;
  completedAt?: string;
  totalDurationMs?: number;
  outputFilename?: string;
  outputPath?: string;
}

export interface PipelineLog {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  stage?: "download" | "upload" | "ocr" | "reformat" | "pipeline";
  fileId?: string;
  fileName?: string;
  error?: string;
}

export interface PipelineJob {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  reformatEnabled: boolean;
  folderId: string;
  createdAt: string;
  files: DriveFile[];
  fileStatuses: Record<string, FileProcessingStatus>;
  logs: PipelineLog[];
}

export interface PipelineSummary {
  total: number;
  completed: number;
  processing: number;
  failed: number;
  pending: number;
  ocrSuccessRate: number;
  ocrErrorRate: number;
  reformatSuccessRate: number;
  avgOcrDurationMs: number;
  avgReformatDurationMs: number;
}

const jobs = new Map<string, PipelineJob>();

export function createJob(files: DriveFile[], reformatEnabled: boolean = false, folderId: string = ""): PipelineJob {
  const fileStatuses: Record<string, FileProcessingStatus> = {};

  files.forEach((file) => {
    fileStatuses[file.id] = {
      fileId: file.id,
      fileName: file.name,
      download: { status: "pending" },
      upload: { status: "pending" },
      ocr: { status: "pending" },
      reformat: { status: reformatEnabled ? "pending" : "skipped" },
      overallStatus: "pending",
    };
  });

  const job: PipelineJob = {
    id: crypto.randomUUID(),
    status: "queued",
    reformatEnabled,
    folderId,
    createdAt: new Date().toISOString(),
    files,
    fileStatuses,
    logs: [
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        level: "INFO",
        message: `Job initialized with ${files.length} file(s). Reformat stage is ${reformatEnabled ? "ENABLED" : "DISABLED"}.`,
        stage: "pipeline",
      },
    ],
  };

  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): PipelineJob | undefined {
  return jobs.get(id);
}

export function updateJobStatus(id: string, status: PipelineJob["status"]) {
  const job = jobs.get(id);
  if (!job) return;
  job.status = status;
}

export function updateFileStageStatus(
  jobId: string,
  fileId: string,
  stage: "download" | "upload" | "ocr" | "reformat",
  stageData: Partial<StageDetails>,
  overallStatus?: FileProcessingStatus["overallStatus"],
  extra?: { outputFilename?: string; outputPath?: string }
) {
  const job = jobs.get(jobId);
  if (!job) return;

  const fileStatus = job.fileStatuses[fileId];
  if (!fileStatus) return;

  fileStatus[stage] = {
    ...fileStatus[stage],
    ...stageData,
  };

  if (overallStatus) {
    fileStatus.overallStatus = overallStatus;
  }

  if (extra?.outputFilename) {
    fileStatus.outputFilename = extra.outputFilename;
  }
  if (extra?.outputPath) {
    fileStatus.outputPath = extra.outputPath;
  }

  // Update timestamps and total duration
  if (stageData.startedAt && !fileStatus.startedAt) {
    fileStatus.startedAt = stageData.startedAt;
  }
  if (overallStatus === "success" || overallStatus === "error") {
    fileStatus.completedAt = new Date().toISOString();
    if (fileStatus.startedAt) {
      fileStatus.totalDurationMs =
        new Date(fileStatus.completedAt).getTime() - new Date(fileStatus.startedAt).getTime();
    }
  }
}

export function addJobLog(
  jobId: string,
  log: Omit<PipelineLog, "id" | "timestamp">
) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.logs.push({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...log,
  });
}

export function getJobDetails(id: string) {
  const job = jobs.get(id);
  if (!job) return null;

  const fileList = Object.values(job.fileStatuses);
  const total = fileList.length;

  let completed = 0;
  let processing = 0;
  let failed = 0;
  let pending = 0;

  let ocrSuccessCount = 0;
  let ocrErrorCount = 0;
  let totalOcrDuration = 0;
  let ocrDurationCount = 0;

  let reformatSuccessCount = 0;
  let totalReformatDuration = 0;
  let reformatDurationCount = 0;

  fileList.forEach((file) => {
    if (file.overallStatus === "success") completed++;
    else if (file.overallStatus === "in_progress") processing++;
    else if (file.overallStatus === "error") failed++;
    else pending++;

    if (file.ocr.status === "success") {
      ocrSuccessCount++;
      if (file.ocr.durationMs) {
        totalOcrDuration += file.ocr.durationMs;
        ocrDurationCount++;
      }
    } else if (file.ocr.status === "error") {
      ocrErrorCount++;
    }

    if (file.reformat.status === "success") {
      reformatSuccessCount++;
      if (file.reformat.durationMs) {
        totalReformatDuration += file.reformat.durationMs;
        reformatDurationCount++;
      }
    }
  });

  const ocrSuccessRate = total > 0 ? Math.round((ocrSuccessCount / total) * 100) : 0;
  const ocrErrorRate = total > 0 ? Math.round((ocrErrorCount / total) * 100) : 0;
  const reformatSuccessRate = total > 0 ? Math.round((reformatSuccessCount / total) * 100) : 0;
  const avgOcrDurationMs = ocrDurationCount > 0 ? Math.round(totalOcrDuration / ocrDurationCount) : 0;
  const avgReformatDurationMs =
    reformatDurationCount > 0 ? Math.round(totalReformatDuration / reformatDurationCount) : 0;

  const summary: PipelineSummary = {
    total,
    completed,
    processing,
    failed,
    pending,
    ocrSuccessRate,
    ocrErrorRate,
    reformatSuccessRate,
    avgOcrDurationMs,
    avgReformatDurationMs,
  };

  return {
    id: job.id,
    status: job.status,
    reformatEnabled: job.reformatEnabled,
    createdAt: job.createdAt,
    files: fileList,
    logs: job.logs,
    summary,
  };
}

export function getAllJobs() {
  return Array.from(jobs.values()).map((job) => ({
    id: job.id,
    status: job.status,
    reformatEnabled: job.reformatEnabled,
    createdAt: job.createdAt,
    totalFiles: job.files.length,
  }));
}
