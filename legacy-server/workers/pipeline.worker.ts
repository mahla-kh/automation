import { DriveFile } from "@/types/drive";
import fs from "fs/promises";
import { downloadFile } from "../services/drive.service";
import { logger } from "../lib/logger";
import { ocrService } from "../services/AI";
import { updateFileStageStatus, addJobLog } from "../services/Pjob.service";
import { saveText } from "../services/storage.service";

export interface FileProcessingResult {
    fileId: string;
    fileName: string;
    outputName: string;
    durationMs: number;
}

/**
 * Processes a single Drive file end-to-end:
 * Download -> OCR -> Upload (Save raw text).
 */
export async function processPipeline(
    file: DriveFile,
    folderId: string,
    jobId: string
): Promise<FileProcessingResult> {
    const jobStartedAt = performance.now();
    let pdfPath: string | null = null;
    let currentStage: "download" | "upload" | "ocr" = "download";

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

        const result = await ocrService.extract(pdfPath, file.name);

        if (!result) {
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

        // --- Stage 3: Upload (Saving result) -----------------------------------
        currentStage = "upload";
        const saveStartedAt = performance.now();
        const saveStartTimeIso = new Date().toISOString();

        updateFileStageStatus(jobId, file.id, "upload", {
            status: "in_progress",
            startedAt: saveStartTimeIso,
        });

        const outputName = sanitizeFileName(file.name);
        const resultFileName = `${outputName}_result.txt`;
        const outputFilename = `${outputName}_result.txt`;
        const outputPath = `outputs/${outputName}/result.txt`;

        addJobLog(jobId, {
            level: "INFO",
            message: `Saving OCR result locally...`,
            fileId: file.id,
            fileName: file.name,
            stage: "upload",
        });

        await saveText(outputName, "result", result);

        const saveDuration = Math.round(performance.now() - saveStartedAt);

        updateFileStageStatus(
            jobId,
            file.id,
            "upload",
            {
                status: "success",
                completedAt: new Date().toISOString(),
                durationMs: saveDuration,
            },
            "success",
            {
                outputFilename,
                outputPath,
                result,
            }
        );

        addJobLog(jobId, {
            level: "INFO",
            message: `OCR result saved locally as "${resultFileName}" in ${saveDuration}ms`,
            fileId: file.id,
            fileName: file.name,
            stage: "upload",
        });

        const durationMs = Math.round(performance.now() - jobStartedAt);

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
            message: `Stage ${currentStage} failed: ${errorMsg}`,
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
