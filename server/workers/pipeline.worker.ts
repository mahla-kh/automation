// import { DriveFile } from "@/types/drive";
// import { downloadFile } from "../services/drive.service";
// import { extractQuestions } from "../services/gemini.service";
// import { saveJson } from "../services/storage.service";
// // import { saveJson } from "../services/storage.service";

// export async function processPipeline(file: DriveFile){

//     console.log("شروع پردازش", file.name);

//     //--------------------------------------------------

//     const pdfPath = await downloadFile(file);

//     //--------------------------------------------------

//     const json = await extractQuestions(pdfPath) as string

//     //--------------------------------------------------

//     await saveJson(file.name, json)

//     //--------------------------------------------------

//     console.log("پایان");
// }

import { DriveFile } from "@/types/drive";
import fs from "fs/promises";
import { downloadFile } from "../services/drive.service";
import { extractQuestions } from "../services/gemini.service";
import { saveJson } from "../services/storage.service";
import { logger } from "../lib/logger";

export interface FileProcessingResult {
    fileId: string;
    fileName: string;
    outputName: string;
    durationMs: number;
}

/**
 * Processes a single Drive file end-to-end:
 * download -> OCR extraction (Gemini) -> save JSON output.
 *
 * Throws on any stage failure so the caller (pipeline.service's
 * Promise.allSettled) can correctly mark the file/job as failed.
 * Always cleans up the downloaded temp file, success or failure.
 */
export async function processPipeline(
    file: DriveFile
): Promise<FileProcessingResult> {

    const jobStartedAt = performance.now();
    let pdfPath: string | null = null;

    logger.info("File processing started", {
        fileId: file.id,
        fileName: file.name
    });

    try {

        // --- Download -------------------------------------------------
        const downloadStartedAt = performance.now();
        pdfPath = await downloadFile(file);
        logger.info("File download completed", {
            fileId: file.id,
            fileName: file.name,
            duration: performance.now() - downloadStartedAt
        });

        // --- OCR extraction --------------------------------------------
        const ocrStartedAt = performance.now();
        const rawResult = await extractQuestions(pdfPath);

        if (!rawResult) {
            throw new Error("Gemini returned an empty response");
        }

        logger.info("Gemini OCR extraction completed", {
            fileId: file.id,
            fileName: file.name,
            duration: performance.now() - ocrStartedAt
        });

        const json = sanitizeAndValidateJson(rawResult, file);

        // --- Save output -------------------------------------------------
        const saveStartedAt = performance.now();
        const outputName = sanitizeFileName(file.name);
        await saveJson(outputName, json);
        logger.info("Output saved", {
            fileId: file.id,
            fileName: file.name,
            outputName,
            duration: performance.now() - saveStartedAt
        });

        const durationMs = performance.now() - jobStartedAt;

        logger.info("File processing finished", {
            fileId: file.id,
            fileName: file.name,
            duration: durationMs
        });

        return {
            fileId: file.id,
            fileName: file.name,
            outputName,
            durationMs
        };

    } catch (error) {
        logger.error("File processing failed", {
            error,
            fileId: file.id,
            fileName: file.name
        });
        throw error;

    } finally {
        if (pdfPath) {
            await fs.unlink(pdfPath).catch((cleanupError) => {
                logger.warn("Failed to remove temp file", {
                    error: cleanupError,
                    fileId: file.id,
                    pdfPath
                });
            });
        }
    }
}

/**
 * Strips common LLM markdown code fences and validates that the result
 * is parseable JSON. Never blocks saving on a validation failure (the
 * raw OCR output is still valuable for manual review) — it only warns.
 */
function sanitizeAndValidateJson(
    raw: string,
    file: DriveFile
): string {

    const cleaned = raw
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();

    try {
        JSON.parse(cleaned);
    } catch (parseError) {
        logger.warn("OCR output is not valid JSON, saving raw text for review", {
            error: parseError,
            fileId: file.id,
            fileName: file.name
        });
    }

    return cleaned;
}

/**
 * Sanitizes a Drive file name so it is safe to use as an output file
 * name (removes path separators and other filesystem-unsafe characters).
 */
function sanitizeFileName(name: string): string {
    return name
        .replace(/\.[^/.]+$/, "")      // strip existing extension, e.g. ".pdf"
        .replace(/[\\/:*?"<>|]+/g, "_") // strip path/filesystem-unsafe chars
        .trim();
}