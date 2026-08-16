import { OCR_PROMPT } from "../../prompts/ocr.prompt";
import { logger } from "../../lib/logger";
import { retry } from "../../retry";

export async function extractQuestions(filePath: string) {
  logger.info("Uploading PDF to Gemini (legacy handler)", {
    path: filePath
  });
  return "Legacy Gemini response placeholder";
}