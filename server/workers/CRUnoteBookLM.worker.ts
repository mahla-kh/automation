import { DriveFile } from "@/types/drive";
import fs from "fs/promises";
import { downloadFile } from "../services/drive.service";
// import { extractQuestions } from "../services/AI/gemini.service";
import { saveJson, saveText } from "../services/storage.service";
import { logger } from "../lib/logger";
import { ocrService } from "../services/AI";
import { clean_ParseQuestions} from "../services/AI/deepseek.service";
import { createNoteBook } from "../services/noteBookLM/createNoteBook";
import { connectChrome } from "../browser/connect";
import { uploadToNotebook } from "../services/noteBookLM/uploadSource";

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

const NOTEBOOK_URL = 'https://notebooklm.google.com/'
export async function processCRNPipeline(
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
        // const rawResult = await extractQuestions(pdfPath);
        const rawOCR  = await ocrService.extract(pdfPath,file.name)

        if (!rawOCR ) {
            throw new Error("Gemini returned an empty response");
        }

        logger.info("Gemini OCR extraction completed", {
            fileId: file.id,
            fileName: file.name,
            duration: performance.now() - ocrStartedAt
        });

        // --- Save output -------------------------------------------------
        const outputName = sanitizeFileName(file.name);
        await saveText(outputName,"01_raw.md",rawOCR);
        // const json = sanitizeAndValidateJson(rawResult, file);

        const page = await connectChrome();
        
        await page.goto(NOTEBOOK_URL, {
            // waitUntil: "networkidle",
            timeout: 180000,
        });
        await createNoteBook(page);
        await uploadToNotebook(page, outputName);
        const saveStartedAt = performance.now();
        logger.info("OCR Output saved", {
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

export function splitByLines(
    text: string,
    maxLines: number = 600
): string[] {

    const lines = text.split(/\r?\n/);

    const chunks: string[] = [];

    for (let i = 0; i < lines.length; i += maxLines) {

        chunks.push(
            lines
                .slice(i, i + maxLines)
                .join("\n")
        );

    }

    return chunks;
}