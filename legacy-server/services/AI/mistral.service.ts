// import { Mistral } from "@mistralai/mistralai";
// import { logger } from "@/server/lib/logger";
// import { retry } from "@/server/retry";
// import { OCRProvider } from ".";
// import { readFile } from "fs/promises";

// export class MistralOCR implements OCRProvider{
//     async extract(filePath:string,fileName:string){
//   logger.info("Uploading PDF to Gemini", {
//     path: filePath
// });

// const buffer = await readFile(filePath);

// const blob = new Blob([buffer], {
//   type: "application/pdf",
// });
// const uploaded =await retry(()=> client.files.upload({
//    file: {
//     fileName,
//     content: blob,
//   },
//   purpose: "ocr",
// }),   {

//         retries: 4,

//         delay: 3000

//     })
//     const signedUrl =await client.files.getSignedUrl({fileId: uploaded.id})
// logger.info("Upload completed", {
//     uri: signedUrl.url
// });
// const response = await retry(()=>client.ocr.process({
//   model: "mistral-ocr-4-1",
//   document:{
// type:"document_url",
// documentUrl:signedUrl.url}}))
// const text =

// response.pages

// .map(

// page=>page.markdown

// )

// .join("\n\n");
// //   const result = await retry(() => client.models.generateContent({
// //     model: "gemini-3.5-flash",
// //     contents: [

// // {
// // text:OCR_PROMPT
// // },

// // {
// // fileData:{
// // mimeType:"application/pdf",
// // fileUri:uploaded.uri
// // }
// // }

// // ]
// //   }),{

// //         retries: 4,

// //         delay: 3000

// //     })

//   logger.info("mistral response received");

//   return text

// }
// }

// const client =
// new Mistral({

//     apiKey:
// process.env.MISTRAL_API_KEY!

// });