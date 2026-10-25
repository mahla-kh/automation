// import {
//     getJob,
//     noteBookJob
// } from "./Njob.service";
// import { logger } from "../lib/logger";
// import { processCRNPipeline } from "../workers/CRUnoteBookLM.worker";
// import { DriveFile } from "@/types/drive";

// // NotebookLM automation drives a single Chrome tab/session, so batches for a
// // given job must run one at a time. Raise this only if each job gets its own
// // isolated browser context.
// // const CONCURRENCY_LIMIT = 1;

// export interface PipelineStartResult {
//     jobId: string;
// }

// export interface PipelineStatusResult {
//     id: string;
//     status: noteBookJob["status"];
//     completedBatches: number;
//     totalBatches: number;
// }

// export interface QuestionRange {
//     start: number; // 1-indexed, inclusive
//     end: number;   // 1-indexed, inclusive
// }

// export const CRUnoteBookService = {

//     /**
//      * Kicks off a pipeline job for a NotebookLM notebook.
//      * Resolves as soon as the job is created and dispatched — the actual
//      * back-and-forth with NotebookLM (goto -> prompt -> read answer, once
//      * per batch of questions) happens in the background.
//      * Callers should poll `status(jobId)` for progress/completion.
//      */
//     async start(fileURL: DriveFile): Promise<PipelineStartResult> {

//         const startedAt = performance.now();


//         // Fire-and-forget on purpose: keeps the API responsive and mirrors
//         // how a future BullMQ producer would enqueue work without awaiting it.
//         void runJob(fileURL).catch((error) => {
//             logger.error("Unhandled error while running job", {
//                 error,
//             });
//             // updateJobStatus(job.id, "failed"); // No job object available here
//         });

//         logger.info("Pipeline start completed", {
//             duration: performance.now() - startedAt
//         });

//         return {
//             jobId: "unknown",
//         };
//     },

//     /**
//      * Returns the current status of a previously started job.
//      */
//     async status(id: string): Promise<PipelineStatusResult> {

//         const job = getJob(id);

//         if (!job) {
//             logger.warn("Status requested for unknown job", { jobId: id });
//             throw new Error(`Job not found: ${id}`);
//         }

//         return {
//             id: job.id,
//             status: job.status,
//             completedBatches: job.completedBatches,
//             totalBatches: job.totalBatches
//         };
//     }

// };

// /**
//  * Splits qLength into 1-indexed, inclusive [start, end] ranges of `batch`
//  * questions each, e.g. batch=20, qLength=45 -> [1,20] [21,40] [41,45].
//  */
// function buildRanges(qLength: number, batch: number): QuestionRange[] {

//     const ranges: QuestionRange[] = [];

//     for (let x = 0; x < qLength; x += batch) {
//         ranges.push({
//             start: x + 1,
//             end: Math.min(x + batch, qLength)
//         });
//     }

//     return ranges;
// }

// /**
//  * Processes all question ranges belonging to a job with bounded concurrency.
//  * Individual batch failures do not abort the whole job — they are logged
//  * and reflected in the final job status.
//  */
// async function runJob(fileURL: DriveFile): Promise<void> {

//     const startedAt = performance.now();


// logger.info("Notebook is ready");


// const result = await processCRNPipeline(fileURL);

//     logger.info(`File ${fileURL.name} completed successfully`, {
//         duration: performance.now() - startedAt
//     });
// }

export const CRUnoteBookService = {
    async start(_fileURL: unknown): Promise<{ jobId: string }> {
        return { jobId: "unknown" };
    },
    async status(_id: string): Promise<unknown> {
        throw new Error("Service unavailable");
    }
};