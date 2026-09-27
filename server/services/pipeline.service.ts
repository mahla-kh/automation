import pLimit from "p-limit";
import { DriveFile } from "@/types/drive";
import {
  createJob,
  getJobDetails,
  getAllJobs,
  updateJobStatus,
  addJobLog,
  PipelineJob,
} from "./Pjob.service";
import { logger } from "../lib/logger";
import { getFilesFromFolder } from "./drive.service";
import { processPipeline } from "../workers/pipeline.worker";

const CONCURRENCY_LIMIT = 1;

export interface PipelineStartResult {
  jobId: string;
  totalFiles: number;
}

export const pipelineService = {
  /**
   * Starts a pipeline job for a Google Drive folder.
   * Processes files asynchronously with concurrency limit.
   */
  async start(folderUrl: string, enableReformat: boolean = false): Promise<PipelineStartResult> {
    const startedAt = performance.now();
    const folderId = extractFolderId(folderUrl);

    if (!folderId) {
      logger.error("Invalid folder URL, could not extract folder id", { folderUrl });
      throw new Error("Invalid Google Drive folder URL");
    }

    logger.info("Pipeline start requested", { folderId, enableReformat });

    const files = await getFilesFromFolder(folderId);

    if (!files.length) {
      logger.warn("No files found in Drive folder", { folderId });
    }

    const job = createJob(files as DriveFile[], enableReformat, folderId);

    logger.info("Job created", {
      jobId: job.id,
      totalFiles: job.files.length,
      reformatEnabled: enableReformat,
    });

    updateJobStatus(job.id, "processing");

    void runJob(job).catch((error) => {
      logger.error("Unhandled error while running job", {
        error,
        jobId: job.id,
      });
      updateJobStatus(job.id, "failed");
      addJobLog(job.id, {
        level: "ERROR",
        message: `Pipeline job execution failed: ${error instanceof Error ? error.message : String(error)}`,
        stage: "pipeline",
      });
    });

    logger.info("Pipeline start completed", {
      jobId: job.id,
      duration: performance.now() - startedAt,
    });

    return {
      jobId: job.id,
      totalFiles: job.files.length,
    };
  },

  /**
   * Returns current detailed job status including files breakdown, summary statistics, and logs.
   */
  async status(id: string) {
    const details = getJobDetails(id);

    if (!details) {
      logger.warn("Status requested for unknown job", { jobId: id });
      throw new Error(`Job not found: ${id}`);
    }

    return details;
  },

  /**
   * Returns summaries of all active and past jobs.
   */
  async listJobs() {
    return getAllJobs();
  },
};

/**
 * Processes all files belonging to a job with bounded concurrency.
 */
async function runJob(job: PipelineJob): Promise<void> {
  const startedAt = performance.now();
  const limit = pLimit(CONCURRENCY_LIMIT);

  const results = await Promise.allSettled(
    job.files.map((file) => limit(() => processPipeline(file, job.folderId, job.id, job.reformatEnabled)))
  );

  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected"
  );

  if (failures.length > 0) {
    failures.forEach((failure) => {
      logger.error("File processing failed within job", {
        jobId: job.id,
        error: failure.reason,
      });
    });

    updateJobStatus(job.id, "failed");

    addJobLog(job.id, {
      level: "WARN",
      message: `Pipeline finished with ${failures.length} failure(s) out of ${job.files.length} file(s)`,
      stage: "pipeline",
    });

    logger.warn("Job finished with failures", {
      jobId: job.id,
      failedCount: failures.length,
      totalFiles: job.files.length,
      duration: performance.now() - startedAt,
    });

    return;
  }

  updateJobStatus(job.id, "completed");

  addJobLog(job.id, {
    level: "INFO",
    message: `Pipeline completed successfully for all ${job.files.length} file(s)`,
    stage: "pipeline",
  });

  logger.info("Job completed successfully", {
    jobId: job.id,
    totalFiles: job.files.length,
    duration: performance.now() - startedAt,
  });
}

function extractFolderId(url: string): string | null {
  const folderUrlMatch = url.match(/folders\/([a-zA-Z0-9_-]+)/);

  if (folderUrlMatch) {
    return folderUrlMatch[1];
  }

  const fallback = url
    .split("?")[0]
    .split("/")
    .filter(Boolean)
    .pop();

  return fallback ?? null;
}