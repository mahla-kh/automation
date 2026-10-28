import { GeminiOCR } from "./gemini.service";

export interface OCRProvider {
  extract(pdfPath: string, fileName: string): Promise<string>;
}

export const ocrService: OCRProvider = new GeminiOCR();