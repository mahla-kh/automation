// import { DriveFile } from "@/types/drive";
// import fs from "fs/promises";
// import { downloadFile } from "../services/drive.service";
// // import { extractQuestions } from "../services/AI/gemini.service";
// import { saveJson, saveText } from "../services/storage.service";
// import { logger } from "../lib/logger";
// import { ocrService } from "../services/AI";
// import { cleanupOCR, parseQuestions } from "../services/AI/nemotron.service";

// export interface FileProcessingResult {
//     fileId: string;
//     fileName: string;
//     outputName: string;
//     durationMs: number;
// }

// /**
//  * Processes a single Drive file end-to-end:
//  * download -> OCR extraction (Gemini) -> save JSON output.
//  *
//  * Throws on any stage failure so the caller (pipeline.service's
//  * Promise.allSettled) can correctly mark the file/job as failed.
//  * Always cleans up the downloaded temp file, success or failure.
//  */
// export async function processNoteBook(
//     qLenghth:number,noteBookUrl:string,batch:number
// ): Promise<FileProcessingResult> {

//     const jobStartedAt = performance.now();
//     // let pdfPath: string | null = null;

//     logger.info("notebook processing started", {
//      qLenghth,
//      batch
//     });

//     try {

//         // --- Save output -------------------------------------------------

// const page =
// await connectChrome();


// await page.goto(
// job.notebookUrl
// );


// const prompt =
// createPrompt(
//  job.questions,
//  job.start,
//  job.end
// );


// await sendPrompt(
//  page,
//  prompt
// );


// const answer =
// await getAnswer(page);


// save(answer);


//         const durationMs = performance.now() - jobStartedAt;

//         logger.info("File processing finished", {
//           qLenghth,
//             duration: durationMs
//         });

//         return {
//                batch,
//             outputName,
//             durationMs
//         };

//     } catch (error) {
//         logger.error("File processing failed", {
//             error,
//          qLenghth,
//      batch
//         });
//         throw error;

//     } finally {
//         if (pdfPath) {
//             await fs.unlink(pdfPath).catch((cleanupError) => {
//                 logger.warn("Failed to remove temp file", {
//                     error: cleanupError,
//                     pdfPath
//                 });
//             });
//         }
//     }
// }

// /**
//  * Sanitizes a Drive file name so it is safe to use as an output file
//  * name (removes path separators and other filesystem-unsafe characters).
//  */
// function sanitizeFileName(name: string): string {
//     return name
//         .replace(/\.[^/.]+$/, "")      // strip existing extension, e.g. ".pdf"
//         .replace(/[\\/:*?"<>|]+/g, "_") // strip path/filesystem-unsafe chars
//         .trim();
// }

import { connectChrome, sendPromptToPage, getAnswer } from "../browser/connect";
import { saveNote } from "../services/storage.service";
import { logger } from "../lib/logger";

export interface FileProcessingResult {
    jobId: string;
    start: number;
    end: number;
    outputName: string;
    durationMs: number;
}

/**
 * Builds the prompt that tells NotebookLM exactly which question range to
 * answer in this batch, e.g. createPrompt(21, 40) for the second batch of a
 * batch=20 job.
 */
function createPrompt(start: number, end: number): string {
    return (
       `You are an expert medical [patology] examiner specializing.

Your task is to analyze questions ${start} to ${end} in the order they appear in the pasted text [Questions.txt] using ONLY the uploaded source file [کلیات پاتولوژی اکبری مهر99].
Important:

Before analyzing the options, ALWAYS reproduce the complete question stem exactly as written in the question file.

If part of the question is unreadable, incomplete, or ambiguous, explicitly mention it.
For each question:
Write the complete question stem.
Determine the single best answer based strictly on the uploaded notes.
try not  to use external knowledge unless explicitly stated in the notes.
If none of the options is fully correct, state this clearly.

If multiple options appear correct according to the notes, state this clearly.
For every option (A, B, C, D):
Explain why the option is correct or incorrect.

Keep explanations concise but scientifically precise.

If the stem or options contain a flaw, explicitly describe the flaw.

If the question cannot be resolved confidently from the uploaded notes:

Do NOT invent an answer.
Mark:

متن واضح نیست

Do NOT delete questions.

Even if a question is flawed, incomplete, or ambiguous, analyze it and explain the problem.

For each question, identify the most relevant source topic from the notes.
Requirements:
Use the terminology and headings found in the notes whenever possible.

Output format:

Questions 1
Question Stem

[Write the complete question text here exactly as it appears in the file]
Options
A) ..
B) .
C) ...
D) ...
Correct Option
C) ...
Option Analysis
A) ...
Correct / Incorrect
Explanation:
B) ...
Correct / Incorrect
Explanation:
C) ...
Correct / Incorrect
Explanation:
D) ...
Correct / Incorrect

Explanation:
Repeat the same format for questions ${start}-${end} only.
Ensure all conclusions are fully aligned with the uploaded  [parasitology ]notes and preserve the original terminology whenever possible.

Concept Summary

After completing the option analysis for each question, write a short educational summary based ONLY on the uploaded notes.

Requirements:
Length: approximately 3–7 lines.

Stay strictly within the scope of the uploaded notes.

Do not introduce external knowledge.

Focus on helping the student review the tested concept rather than repeating the explanation of the correct option.

The summary should preferably include one of the following:

A concise collection of the most important facts related to the tested concept.

A comparison between closely related anatomical structures.

Key distinguishing features.

Commonly confused structures.

Functional relationships.

High-yield exam points mentioned in the notes.

Avoid simply repeating the option analysis.

Avoid repetition

Maintain awareness of previous summaries.

If an earlier question has already explained the same concept in sufficient detail:
Do NOT repeat the same explanation.

Instead, introduce another important aspect of that topic from the notes.

If no additional information exists in the notes, write:
"این مبحث در سوالات قبل به طور کامل جمع‌بندی شده است."
Output position
Insert the summary immediately after the Option Analysis section.
Example:
Concept Summary

OPTION COMPLETION RULE (VERY IMPORTANT)

If a question does NOT have exactly 4 options:

Keep all existing options exactly as they are.

Do NOT rewrite or modify them.

Complete missing options (A, B, C, D) ONLY if fewer than 4 options exist.

The missing options must be:

Strictly based on the uploaded source file [ "کلیات پاتولوژی اکبری مهر99"]

Consistent with the same topic and difficulty level of the question

Plausible exam-style distractors (not random text)

You MUST NOT introduce external knowledge beyond the provided notes.
answer in persion `
    );
}

/**
 * Processes a single batch end-to-end: open the notebook -> send the
 * range-specific prompt -> read the answer -> save it.
 *
 * Throws on any stage failure so the caller (noteBook.service's
 * Promise.allSettled) can correctly mark the batch/job as failed.
 * Always closes the page it opened, success or failure.
 */
export async function processNoteBook(
    page: Awaited<ReturnType<typeof connectChrome>>,
    jobId: string,
    start: number,
    end: number
): Promise<FileProcessingResult> {

    const startedAt = performance.now();

    logger.info("Notebook batch started", { jobId, start, end });


    try {


        const prompt = createPrompt(start, end);

        await sendPromptToPage(page, prompt);

        const answer = await getAnswer(page);

        
        const outputName = `notebook_${jobId}_${start}-${end}.txt`;
        await saveNote(jobId, outputName, answer);

        const durationMs = performance.now() - startedAt;

        logger.info("Notebook batch finished", {
            jobId,
            start,
            end,
            duration: durationMs
        });

        return { jobId, start, end, outputName, durationMs };

    } catch (error) {
        logger.error("Notebook batch failed", {
            error,
            jobId,
            start,
            end
        });
        throw error;

    } finally {
        // await page.close().catch((closeError : Error) => {
        //     logger.warn("Failed to close page", { error: closeError, jobId, start, end });
        // });
    }
}