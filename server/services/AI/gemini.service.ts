import { GoogleGenAI } from "@google/genai";
import { OCR_PROMPT } from "../../prompts/ocr.prompt";
import { logger } from "../../lib/logger";
import { retry } from "../../retry";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});


export async function extractQuestions(filePath: string) {
  logger.info("Uploading PDF to Gemini", {
    path: filePath
});
const uploaded =await retry(()=> ai.files.upload({
  file: filePath,
  config: {
    mimeType: "application/pdf",
  },
}),   {

        retries: 4,

        delay: 3000

    })
logger.info("Upload completed", {
    uri: uploaded.uri
});
  const result = await retry(() => ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [

{
text:OCR_PROMPT
},

{
fileData:{
mimeType:"application/pdf",
fileUri:uploaded.uri
}
}

]
  }),{

        retries: 4,

        delay: 3000

    })

  logger.info("Gemini response received");

  return result.text;
}