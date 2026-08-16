import { DriveFile } from "@/types/drive";
import fs from "fs/promises";
import { downloadFile } from "../services/drive.service";
import { saveJson, saveText } from "../services/storage.service";
import { logger } from "../lib/logger";
import { ocrService } from "../services/AI";
import { clean_ParseQuestions } from "../services/AI/deepseek.service";
import { updateFileStageStatus, addJobLog } from "../services/Pjob.service";

export interface FileProcessingResult {
  fileId: string;
  fileName: string;
  outputName: string;
  durationMs: number;
}

/**
 * Processes a single Drive file end-to-end:
 * Download -> OCR -> Upload (Save raw text) -> Reformat (optional, if enableReformat is true).
 */
export async function processPipeline(
  file: DriveFile,
  jobId: string,
  enableReformat: boolean = false
): Promise<FileProcessingResult> {
  const jobStartedAt = performance.now();
  let pdfPath: string | null = null;
  let currentStage: "download" | "upload" | "ocr" | "reformat" = "download";

  logger.info("File processing started", {
    fileId: file.id,
    fileName: file.name,
    jobId,
  });

  addJobLog(jobId, {
    level: "INFO",
    message: `Started processing file ${file.name}`,
    fileId: file.id,
    fileName: file.name,
    stage: "pipeline",
  });

  try {
    // --- Stage 1: Download -------------------------------------------------
    currentStage = "download";
    const downloadStartedAt = performance.now();
    const downloadStartTimeIso = new Date().toISOString();

    updateFileStageStatus(
      jobId,
      file.id,
      "download",
      { status: "in_progress", startedAt: downloadStartTimeIso },
      "in_progress"
    );

    addJobLog(jobId, {
      level: "INFO",
      message: `Downloading file from Google Drive...`,
      fileId: file.id,
      fileName: file.name,
      stage: "download",
    });

    pdfPath = await downloadFile(file);
    const downloadDuration = Math.round(performance.now() - downloadStartedAt);

    updateFileStageStatus(jobId, file.id, "download", {
      status: "success",
      completedAt: new Date().toISOString(),
      durationMs: downloadDuration,
    });

    addJobLog(jobId, {
      level: "INFO",
      message: `Download completed successfully in ${downloadDuration}ms`,
      fileId: file.id,
      fileName: file.name,
      stage: "download",
    });

    // --- Stage 2: OCR ------------------------------------------------------
    currentStage = "ocr";
    const ocrStartedAt = performance.now();
    const ocrStartTimeIso = new Date().toISOString();

    updateFileStageStatus(jobId, file.id, "ocr", {
      status: "in_progress",
      startedAt: ocrStartTimeIso,
    });

    addJobLog(jobId, {
      level: "INFO",
      message: `Executing OCR extraction...`,
      fileId: file.id,
      fileName: file.name,
      stage: "ocr",
    });

    const rawOCR = await ocrService.extract(pdfPath, file.name);

    if (!rawOCR) {
      throw new Error("OCR provider returned an empty response");
    }

    const ocrDuration = Math.round(performance.now() - ocrStartedAt);

    updateFileStageStatus(jobId, file.id, "ocr", {
      status: "success",
      completedAt: new Date().toISOString(),
      durationMs: ocrDuration,
    });

    addJobLog(jobId, {
      level: "INFO",
      message: `OCR extraction completed in ${ocrDuration}ms`,
      fileId: file.id,
      fileName: file.name,
      stage: "ocr",
    });

    // --- Stage 3: Upload (Saving raw output) ------------------------------
    currentStage = "upload";
    const saveStartedAt = performance.now();
    const saveStartTimeIso = new Date().toISOString();

    updateFileStageStatus(jobId, file.id, "upload", {
      status: "in_progress",
      startedAt: saveStartTimeIso,
    });

    const outputName = sanitizeFileName(file.name);
    await saveText(outputName, "01_raw.md", rawOCR);

    const saveDuration = Math.round(performance.now() - saveStartedAt);

    updateFileStageStatus(jobId, file.id, "upload", {
      status: "success",
      completedAt: new Date().toISOString(),
      durationMs: saveDuration,
    });

    addJobLog(jobId, {
      level: "INFO",
      message: `Saved raw OCR output file 01_raw.md in ${saveDuration}ms`,
      fileId: file.id,
      fileName: file.name,
      stage: "upload",
    });

    // --- Stage 4: Reformat (Optional - Controlled by Toggle) --------------
    if (enableReformat) {
      currentStage = "reformat";
      const reformatStartedAt = performance.now();
      const reformatStartTimeIso = new Date().toISOString();

      updateFileStageStatus(jobId, file.id, "reformat", {
        status: "in_progress",
        startedAt: reformatStartTimeIso,
      });

      addJobLog(jobId, {
        level: "INFO",
        message: `Reformat stage started (DeepSeek parsing)`,
        fileId: file.id,
        fileName: file.name,
        stage: "reformat",
      });

      const chunks = splitByLines(rawOCR, 600);
      let allQuestions = "";

      for (const chunk of chunks) {
        const result = await clean_ParseQuestions(chunk);
        allQuestions += result;
      }

      await saveJson(outputName, "03_questions.json", allQuestions);

      const reformatDuration = Math.round(performance.now() - reformatStartedAt);

      updateFileStageStatus(jobId, file.id, "reformat", {
        status: "success",
        completedAt: new Date().toISOString(),
        durationMs: reformatDuration,
      });

      addJobLog(jobId, {
        level: "INFO",
        message: `Reformat completed and saved to 03_questions.json in ${reformatDuration}ms`,
        fileId: file.id,
        fileName: file.name,
        stage: "reformat",
      });
    } else {
      updateFileStageStatus(jobId, file.id, "reformat", {
        status: "skipped",
      });
      addJobLog(jobId, {
        level: "INFO",
        message: `Reformat stage skipped as requested by toggle setting`,
        fileId: file.id,
        fileName: file.name,
        stage: "reformat",
      });
    }

    const durationMs = Math.round(performance.now() - jobStartedAt);

    updateFileStageStatus(
      jobId,
      file.id,
      "reformat",
      {},
      "success"
    );

    addJobLog(jobId, {
      level: "INFO",
      message: `File processing completed successfully in ${durationMs}ms`,
      fileId: file.id,
      fileName: file.name,
      stage: "pipeline",
    });

    return {
      fileId: file.id,
      fileName: file.name,
      outputName,
      durationMs,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    logger.error("File processing failed", {
      error,
      fileId: file.id,
      fileName: file.name,
      stage: currentStage,
    });

    updateFileStageStatus(
      jobId,
      file.id,
      currentStage,
      {
        status: "error",
        error: errorMsg,
        completedAt: new Date().toISOString(),
      },
      "error"
    );

    addJobLog(jobId, {
      level: "ERROR",
      message: `Stage ${currentStage.toUpperCase()} failed: ${errorMsg}`,
      fileId: file.id,
      fileName: file.name,
      stage: currentStage,
      error: errorMsg,
    });

    throw error;
  } finally {
    if (pdfPath) {
      await fs.unlink(pdfPath).catch((cleanupError) => {
        logger.warn("Failed to remove temp file", {
          error: cleanupError,
          fileId: file.id,
          pdfPath,
        });
      });
    }
  }
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/\.[^/.]+$/, "")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .trim();
}

export function splitByLines(text: string, maxLines: number = 600): string[] {
  const lines = text.split(/\r?\n/);
  const chunks: string[] = [];

  for (let i = 0; i < lines.length; i += maxLines) {
    chunks.push(lines.slice(i, i + maxLines).join("\n"));
  }

  return chunks;
}