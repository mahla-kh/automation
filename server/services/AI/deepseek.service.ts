import { logger } from "@/server/lib/logger";
import { CLEAN_JSONPARSER } from "@/server/prompts/clean_JSON.prompt";
import { CLEANUP_PROMPT } from "@/server/prompts/cleanup.prompt";
import { CLEAN_JSONPARSER_FOR_JOSVE } from "@/server/prompts/JOSVE_clean.prompt";
// import { JSONparser_PROMPT } from "@/server/prompts/JSONparser.prompt";
import { VALIDATOR_PROMPT } from "@/server/prompts/validator.prompt";
import { retry } from "@/server/retry";
import OpenAI from "openai";
import { pdf } from "pdf-to-img";
import { readFile } from "fs/promises";
import type { OCRProvider } from "./index";

const client = new OpenAI({

    apiKey: process.env.DEEPSEEK_API_KEY || "dummy-key",

    baseURL: "https://api.deepseek.com"

});

export async function deepseekChat(

    systemPrompt: string,

    userPrompt: string

): Promise<string> {

    const started = performance.now();

    logger.info("DeepSeek request started");

    const maxTokens = parseInt(process.env.DEEPSEEK_MAX_TOKENS || "8192", 10);

    const response = await retry(() =>

        client.chat.completions.create({

            model: "deepseek-chat",

            temperature: 0,

            max_tokens: maxTokens,

            messages: [

                {

                    role: "system",

                    content: systemPrompt

                },

                {

                    role: "user",

                    content: userPrompt

                }

            ]

        })

    );

    logger.info("DeepSeek response received", {

        duration: performance.now() - started

    });

    const choice = response.choices[0];
    logger.debug("DeepSeek completion choice", { finish_reason: choice?.finish_reason });

    if (choice?.finish_reason === "length") {
        logger.warn("DeepSeek response truncated by token limit", { finish_reason: "length" });
        throw new Error("DeepSeek response truncated — increase max_tokens or reduce chunk size");
    }

    const content = choice?.message?.content;

    if (!content) {

        logger.error(`failed`);
        throw new Error("DeepSeek returned empty response");

    }

    return content;

}

const chat = deepseekChat;

/**
 * Inactive/standby function.
 * Note: When activating this function on large inputs, text must be chunked
 * using splitByLines() to avoid exceeding model token context limits.
 */
export async function cleanupOCR(

    text: string

): Promise<string> {

    logger.info("OCR Cleanup started");

    return chat(

        CLEANUP_PROMPT,

        text

    );

}

export async function clean_ParseQuestions(

    cleanedText: string

): Promise<string> {

    logger.info("Question parsing started");

    return chat(

        CLEAN_JSONPARSER,

        cleanedText

    );

}
export async function clean_ParseJOSVE(

    cleanedText: string

): Promise<string> {

    logger.info("Question parsing started");

    return chat(

        CLEAN_JSONPARSER_FOR_JOSVE,

        cleanedText

    );

}

/**
 * Inactive/standby function.
 * Note: When activating this function on large inputs, text must be chunked
 * using splitByLines() to avoid exceeding model token context limits.
 */
export async function validateQuestions(

    questionsJson: string

): Promise<string> {

    logger.info("Validation started");

    return chat(

        VALIDATOR_PROMPT,

        questionsJson

    );

}

const OCR_PAGE_BATCH_SIZE = 40;

function getOcrPrompt(startPage: number, pageCount: number): string {
    const endPage = startPage + pageCount - 1;
    return `You are an OCR system. Extract and transcribe all text from the supplied document page images exactly as it appears.

Rules:
- Preserve the exact reading order, headings, subheadings, lists, numbering, and tables.
- Preserve equations and formulas in plain text where possible.
- Preserve both Persian (RTL) and English (LTR) text exactly as written.
- Do not summarize, translate, explain, or add any information not present in the image.
- Do not omit text even if it appears repetitive or redundant.
- Do not correct spelling or grammar.

Page boundaries:
- The supplied ${pageCount} page image(s) correspond to document page(s) ${startPage}${pageCount > 1 ? ` through ${endPage}` : ""}.
- For each page, output its content preceded by a marker on its own line: --- PAGE N ---
  where N is the document page number.
${pageCount > 1 ? `- Example:
  --- PAGE ${startPage} ---
  <content of page ${startPage}>
  --- PAGE ${startPage + 1} ---
  <content of page ${startPage + 1}>` : `- Example:
  --- PAGE ${startPage} ---
  <content of page ${startPage}>`}

Process every supplied page. Do not skip any page.`;
}

async function extractBatch(
    imageBuffers: Buffer[],
    batchLabel: string,
    startPage: number = 1
): Promise<string> {
    const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
        {
            type: "text",
            text: getOcrPrompt(startPage, imageBuffers.length)
        },
        ...imageBuffers.map((imgBuffer) => ({
            type: "image_url" as const,
            image_url: {
                url: `data:image/png;base64,${imgBuffer.toString("base64")}`
            }
        }))
    ];

    const maxTokens = parseInt(process.env.DEEPSEEK_OCR_MAX_TOKENS || "4096", 10);

    const response = await retry(() => client.chat.completions.create({
        model: process.env.DEEPSEEK_OCR_MODEL || "deepseek-flash",
        max_tokens: maxTokens,
        messages: [
            {
                role: "user",
                content: userContent
            }
        ]
    }), {
        retries: 4,
        delay: 3000
    });

    const choice = response.choices[0];
    logger.debug("DeepSeek OCR batch completion choice", { batchLabel, finish_reason: choice?.finish_reason });

    if (choice?.finish_reason === "length") {
        logger.warn(`DeepSeek OCR response truncated by token limit for ${batchLabel}`, { finish_reason: "length" });
        throw new Error(`DeepSeek OCR response truncated for ${batchLabel} — increase max_tokens or reduce batch size`);
    }

    const content = choice?.message?.content;
    if (!content) {
        throw new Error(`DeepSeek OCR returned empty response for ${batchLabel}`);
    }

    return content;
}

export class DeepSeekOCR implements OCRProvider {
    async extract(filePath: string, fileName: string): Promise<string> {
        logger.info("DeepSeek OCR extraction started", {
            path: filePath,
            fileName
        });

        const buffer = await readFile(filePath);
        const isPdf = fileName.toLowerCase().endsWith(".pdf");

        if (!isPdf) {
            const ext = fileName.split(".").pop()?.toLowerCase() || "png";
            const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/png";

            logger.info("Processing single image file", { fileName, mimeType });
            const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
                {
                    type: "text",
                    text: getOcrPrompt(1, 1)
                },
                {
                    type: "image_url",
                    image_url: {
                        url: `data:${mimeType};base64,${buffer.toString("base64")}`
                    }
                }
            ];

            const maxTokens = parseInt(process.env.DEEPSEEK_OCR_MAX_TOKENS || "4096", 10);

            const response = await retry(() => client.chat.completions.create({
                model: process.env.DEEPSEEK_OCR_MODEL || "deepseek-flash",
                max_tokens: maxTokens,
                messages: [{ role: "user", content: userContent }]
            }), {
                retries: 4,
                delay: 3000
            });

            const choice = response.choices[0];
            logger.debug("DeepSeek OCR image completion choice", { fileName, finish_reason: choice?.finish_reason });

            if (choice?.finish_reason === "length") {
                logger.warn(`DeepSeek OCR response truncated by token limit for image ${fileName}`, { finish_reason: "length" });
                throw new Error(`DeepSeek OCR response truncated for image ${fileName} — increase max_tokens`);
            }

            const content = choice?.message?.content;
            if (!content) {
                throw new Error("DeepSeek OCR returned empty response for image");
            }

            logger.info("DeepSeek OCR completed", { fileName });
            return content;
        }

        logger.info("Rendering PDF pages", { path: filePath, fileName });
        const doc = await pdf(buffer, { scale: 1.5 });

        try {
            const totalPages = doc.length;
            logger.info(`PDF contains ${totalPages} pages`);

            if (totalPages === 0) {
                throw new Error("PDF document contains no pages");
            }

            const totalBatches = Math.ceil(totalPages / OCR_PAGE_BATCH_SIZE);
            const batchResults: string[] = [];

            for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
                const startPage = batchIndex * OCR_PAGE_BATCH_SIZE + 1;
                const endPage = Math.min((batchIndex + 1) * OCR_PAGE_BATCH_SIZE, totalPages);
                const batchLabel = `batch ${batchIndex + 1}/${totalBatches} (pages ${startPage}-${endPage})`;

                logger.info(`Processing OCR ${batchLabel}`);

                const batchImages: Buffer[] = [];
                for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
                    const pageBuffer = await doc.getPage(pageNum);
                    batchImages.push(pageBuffer);
                }

                try {
                    const batchText = await extractBatch(batchImages, batchLabel, startPage);
                    batchResults.push(batchText);
                } catch (batchError) {
                    logger.error(`DeepSeek OCR failed for pages ${startPage}-${endPage}`, {
                        error: batchError instanceof Error ? batchError.message : String(batchError)
                    });
                    throw new Error(`DeepSeek OCR failed for pages ${startPage}-${endPage}: ${batchError instanceof Error ? batchError.message : String(batchError)}`);
                }
            }

            logger.info("DeepSeek OCR completed", {
                totalPages,
                totalBatches,
                fileName
            });

            return batchResults.join("\n\n");
        } finally {
            await doc.destroy();
        }
    }
}

export async function deepseekOCR(filePath: string, fileName: string): Promise<string> {
    const ocr = new DeepSeekOCR();
    return ocr.extract(filePath, fileName);
}
