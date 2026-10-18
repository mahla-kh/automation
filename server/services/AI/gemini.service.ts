import {
  GoogleGenAI,
  ApiError,
  FileState,
  FinishReason,
  createPartFromUri,
  createUserContent,
} from "@google/genai";
import { OCR_PROMPT } from "../../prompts/ocr.prompt";
import { logger } from "../../lib/logger";
import { retry } from "../../retry";
import type { OCRProvider } from "./index";

function getMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    default:
      throw new Error(`Unsupported file type for OCR: ${fileName}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientGeminiError(error: unknown): boolean {
  if (error instanceof ApiError) {
    if (
      error.status === 500 ||
      error.status === 502 ||
      error.status === 503 ||
      error.status === 504
    ) {
      return true;
    }
    if (error.status === 429) {
      if (/(?:perday|per[ _]day)/i.test(error.message)) {
        return false;
      }
      return true;
    }
    return false;
  }

  if (error instanceof Error) {
    if (
      error.name === "AbortError" ||
      error.name === "TimeoutError" ||
      error.message.includes("timed out") ||
      error.message.includes("timeout")
    ) {
      return false;
    }

    const msg = error.message;
    if (
      msg.includes("ECONNRESET") ||
      msg.includes("UND_ERR_SOCKET") ||
      msg.includes("ETIMEDOUT") ||
      msg.includes("fetch failed")
    ) {
      return true;
    }
  }

  return false;
}

const GEMINI_RETRY = {
  retries: 5,
  delay: 5000,
  factor: 2,
  shouldRetry: isTransientGeminiError,
};

let paceChain: Promise<void> = Promise.resolve();
let lastStartAt = 0;

function getMinIntervalMs(): number {
  const envVal = process.env.GEMINI_MIN_INTERVAL_MS;
  if (!envVal) return 10000;
  const parsed = parseInt(envVal.trim(), 10);
  if (isNaN(parsed) || parsed < 0) return 10000;
  return parsed;
}

function paceGeminiCall(): Promise<void> {
  const minInterval = getMinIntervalMs();
  if (minInterval === 0) return Promise.resolve();

  const run = paceChain.then(async () => {
    const wait = lastStartAt + minInterval - Date.now();
    if (wait > 0) {
      await sleep(wait);
    }
    lastStartAt = Date.now();
  });
  paceChain = run.catch(() => { });
  return run;
}

function getTimeoutMs(): number {
  const envVal = process.env.GEMINI_TIMEOUT_MS;
  if (!envVal) return 900000;
  const parsed = parseInt(envVal.trim(), 10);
  if (isNaN(parsed) || parsed <= 0) return 900000;
  return parsed;
}

function wrapQuotaError(err: unknown, model: string, attempts: number): never {
  if (err instanceof ApiError && err.status === 429) {
    throw new Error(
      `Gemini rate limit/quota exceeded for model ${model} after ${attempts} attempts`,
      { cause: err }
    );
  }
  throw err;
}

export class GeminiOCR implements OCRProvider {
  async extract(filePath: string, fileName: string): Promise<string> {
    const started = performance.now();
    logger.info("Gemini OCR extraction started", {
      path: filePath,
      fileName,
    });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY environment variable");
    }

    const model = process.env.GEMINI_MODEL;
    if (!model) {
      throw new Error("Missing GEMINI_MODEL environment variable");
    }

    const timeout = getTimeoutMs();
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { timeout },
    });
    const mimeType = getMimeType(fileName);

    let uploadName: string | undefined;

    try {
      logger.info("Uploading original file to Gemini Files API", { fileName, mimeType });

      let fileUpload;
      try {
        fileUpload = await retry(
          () =>
            ai.files.upload({
              file: filePath,
              config: {
                mimeType,
                displayName: fileName,
              },
            }),
          GEMINI_RETRY
        );
      } catch (err) {
        wrapQuotaError(err, model, GEMINI_RETRY.retries);
      }

      if (!fileUpload.name) {
        throw new Error(`Gemini file upload did not return a file name for ${fileName}`);
      }

      uploadName = fileUpload.name;
      const uploadedName = fileUpload.name;
      let fileUri = fileUpload.uri;
      let fileState = fileUpload.state;

      const pollIntervalMs = 2000;
      const maxWaitMs = 120000;
      let waitedMs = 0;

      while (fileState === FileState.PROCESSING) {
        if (waitedMs >= maxWaitMs) {
          throw new Error(`Gemini file processing timed out for ${fileName} after ${maxWaitMs / 1000}s`);
        }
        await sleep(pollIntervalMs);
        waitedMs += pollIntervalMs;

        const fileInfo = await retry(
          () => ai.files.get({ name: uploadedName }),
          GEMINI_RETRY
        );
        fileState = fileInfo.state;
        if (fileInfo.uri) {
          fileUri = fileInfo.uri;
        }

        if (fileState === FileState.FAILED) {
          throw new Error(`Gemini file processing failed for ${fileName}`);
        }
      }

      if (fileState === FileState.FAILED) {
        throw new Error(`Gemini file processing failed for ${fileName}`);
      }

      if (!fileUri) {
        throw new Error(`Gemini file upload did not return a valid URI for ${fileName}`);
      }

      logger.info("Generating content from file with combined OCR prompt", {
        fileName,
        model,
      });

      const thinkingBudgetEnv = process.env.GEMINI_THINKING_BUDGET;
      const thinkingBudget =
        thinkingBudgetEnv !== undefined && thinkingBudgetEnv.trim() !== ""
          ? parseInt(thinkingBudgetEnv.trim(), 10)
          : undefined;

      const generateConfig: Record<string, unknown> = {
        temperature: 0,
      };

      if (thinkingBudget !== undefined && !isNaN(thinkingBudget)) {
        generateConfig.thinkingConfig = { thinkingBudget };
      }

      let generationResult;
      try {
        generationResult = await retry(
          async () => {
            await paceGeminiCall();

            const responseStream = await ai.models.generateContentStream({
              model,
              contents: createUserContent([createPartFromUri(fileUri, mimeType), OCR_PROMPT]),
              config: generateConfig,
            });

            let accumulatedText = "";
            let lastFinishReason: string | undefined;

            for await (const chunk of responseStream) {
              if (chunk.text) {
                accumulatedText += chunk.text;
              }
              const chunkFinishReason = chunk.candidates?.[0]?.finishReason;
              if (chunkFinishReason) {
                lastFinishReason = chunkFinishReason;
              }
            }

            return {
              text: accumulatedText,
              finishReason: lastFinishReason,
            };
          },
          GEMINI_RETRY
        );
      } catch (err) {
        wrapQuotaError(err, model, GEMINI_RETRY.retries);
      }

      const { text, finishReason } = generationResult;

      logger.debug("Gemini OCR completion choice", {
        fileName,
        finishReason,
      });

      if (finishReason === FinishReason.MAX_TOKENS) {
        logger.warn("Gemini OCR response truncated by token limit", {
          fileName,
          finishReason: "MAX_TOKENS",
        });
        throw new Error("Gemini OCR response truncated — document too large for a single response");
      }

      if (!text || !text.trim()) {
        throw new Error("Gemini OCR returned empty response");
      }

      const duration = Math.round(performance.now() - started);
      logger.info("Gemini OCR completed", { fileName, duration });

      return text.trim();
    } finally {
      if (uploadName) {
        try {
          await ai.files.delete({ name: uploadName });
          logger.debug("Deleted Gemini file after processing", { name: uploadName, fileName });
        } catch (cleanupErr) {
          logger.warn("Failed to delete Gemini file", {
            error: cleanupErr,
            fileName,
            name: uploadName,
          });
        }
      }
    }
  }
}