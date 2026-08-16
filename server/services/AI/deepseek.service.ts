import { logger } from "@/server/lib/logger";
import { CLEAN_JSONPARSER } from "@/server/prompts/clean_JSON.prompt";
import { CLEANUP_PROMPT } from "@/server/prompts/cleanup.prompt";
import { CLEAN_JSONPARSER_FOR_JOSVE } from "@/server/prompts/JOSVE_clean.prompt";
// import { JSONparser_PROMPT } from "@/server/prompts/JSONparser.prompt";
import { VALIDATOR_PROMPT } from "@/server/prompts/validator.prompt";
import { retry } from "@/server/retry";
import OpenAI from "openai";

const client = new OpenAI({

    apiKey: process.env.DEEPSEEK_API_KEY,

    baseURL: "https://api.deepseek.com"

});

async function chat(

    systemPrompt: string,

    userPrompt: string

): Promise<string> {

    const started = performance.now();

    logger.info("DeepSeek request started");

    const response = await retry(() =>

        client.chat.completions.create({

            model: "deepseek-chat",

            temperature: 0,

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

    const content = response.choices[0].message.content;

    if (!content) {

        logger.error(`failed`);
        throw new Error("DeepSeek returned empty response");

    }

    return content;

}


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

export async function validateQuestions(

    questionsJson: string

): Promise<string> {

    logger.info("Validation started");

    return chat(

        VALIDATOR_PROMPT,

        questionsJson

    );

}