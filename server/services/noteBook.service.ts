// import pLimit from "p-limit";
// import {
//     createJob,
//     getJob,
//     updateJobStatus,
//     noteBookJob
// } from "./Njob.service";
// import { logger } from "../lib/logger";
// import { processPipeline } from "../workers/pipeline.worker";
// import { PipelineJob } from "../Pjob.service";
// import { processNoteBook } from "../workers/noteBook.worker";

// const CONCURRENCY_LIMIT = 1;

// export interface PipelineStartResult {
//     jobId: string;
// }

// export interface PipelineStatusResult {
//     id: string;
//     status: noteBookJob["status"];
// }

// export const noteBookService = {

//     /**
//      * Kicks off a pipeline job for a Google Drive folder.
//      * Resolves as soon as the job is created and dispatched — actual file
//      * processing (download -> OCR -> save) happens in the background.
//      * Callers should poll `status(jobId)` for progress/completion.
//      */
//     async start(noteBookUrl: string,batch:number,qLenghth:number): Promise<PipelineStartResult> {

//         const startedAt = performance.now();

//         const job = createJob( batch);

//         logger.info("Job created", {
//             jobId: job.id,
//         });

//         updateJobStatus(job.id, "processing");

//         // Fire-and-forget on purpose: keeps the API responsive and mirrors
//         // how a future BullMQ producer would enqueue work without awaiting it.
//         void runJob(job).catch((error) => {
//             logger.error("Unhandled error while running job", {
//                 error,
//                 jobId: job.id
//             });
//             updateJobStatus(job.id, "failed");
//         });

//         logger.info("Pipeline start completed", {
//             jobId: job.id,
//             duration: performance.now() - startedAt
//         });

//         return {
//             jobId: job.id,
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
//         };
//     }

// };

// /**
//  * Processes all files belonging to a job with bounded concurrency.
//  * Individual file failures do not abort the whole job — they are logged
//  * and reflected in the final job status.
//  */
// async function runJob(job: noteBookJob): Promise<void> {

//     const startedAt = performance.now();
//     const limit = pLimit(CONCURRENCY_LIMIT);

//     const results = await Promise.allSettled(
//         for(let x=0 ; x<=job.qLength/job.batch; x++){
//             () => limit(() => processNoteBook())
//         }
//     );

//     const failures = results.filter(
//         (result): result is PromiseRejectedResult => result.status === "rejected"
//     );

//     if (failures.length > 0) {
//         failures.forEach((failure) => {
//             logger.error("File processing failed within job", {
//                 jobId: job.id,
//                 error: failure.reason
//             });
//         });

//         updateJobStatus(job.id, "failed");

//         logger.warn("Job finished with failures", {
//             jobId: job.id,
//             failedCount: failures.length,
//             duration: performance.now() - startedAt
//         });

//         return;
//     }

//     updateJobStatus(job.id, "completed");

//     logger.info("Job completed successfully", {
//         jobId: job.id,
//         totalFiles: job.files.length,
//         duration: performance.now() - startedAt
//     });
// }

// /**
//  * Extracts a Google Drive folder ID from either:
//  *  - a full folder URL (with or without query params/trailing slash)
//  *  - a raw folder ID passed directly
//  */
// function extractFolderId(url: string): string | null {

//     const noteBookUrlMatch = url.match(/folders\/([a-zA-Z0-9_-]+)/);

//     if (noteBookUrlMatch) {
//         return noteBookUrlMatch[1];
//     }

//     const fallback = url
//         .split("?")[0]
//         .split("/")
//         .filter(Boolean)
//         .pop();

//     return fallback ?? null;
// }


import pLimit from "p-limit";
import {
    createJob,
    getJob,
    updateJobStatus,
    incrementCompletedBatches,
    noteBookJob
} from "./Njob.service";
import { logger } from "../lib/logger";
import { processNoteBook } from "../workers/noteBook.worker";
import { connectChrome } from "../browser/connect";
import { expect } from "playwright/test";

// NotebookLM automation drives a single Chrome tab/session, so batches for a
// given job must run one at a time. Raise this only if each job gets its own
// isolated browser context.
const CONCURRENCY_LIMIT = 1;

export interface PipelineStartResult {
    jobId: string;
}

export interface PipelineStatusResult {
    id: string;
    status: noteBookJob["status"];
    completedBatches: number;
    totalBatches: number;
}

export interface QuestionRange {
    start: number; // 1-indexed, inclusive
    end: number;   // 1-indexed, inclusive
}

export const noteBookService = {

    /**
     * Kicks off a pipeline job for a NotebookLM notebook.
     * Resolves as soon as the job is created and dispatched — the actual
     * back-and-forth with NotebookLM (goto -> prompt -> read answer, once
     * per batch of questions) happens in the background.
     * Callers should poll `status(jobId)` for progress/completion.
     */
    async start(noteBookUrl: string, batch: number, qLength: number): Promise<PipelineStartResult> {

        const startedAt = performance.now();

        const job = createJob(noteBookUrl, batch, qLength);

        logger.info("Job created", {
            jobId: job.id,
            noteBookUrl,
            batch,
            qLength,
            totalBatches: job.totalBatches
        });

        updateJobStatus(job.id, "processing");

        // Fire-and-forget on purpose: keeps the API responsive and mirrors
        // how a future BullMQ producer would enqueue work without awaiting it.
        void runJob(job).catch((error) => {
            logger.error("Unhandled error while running job", {
                error,
                jobId: job.id
            });
            updateJobStatus(job.id, "failed");
        });

        logger.info("Pipeline start completed", {
            jobId: job.id,
            duration: performance.now() - startedAt
        });

        return {
            jobId: job.id,
        };
    },

    /**
     * Returns the current status of a previously started job.
     */
    async status(id: string): Promise<PipelineStatusResult> {

        const job = getJob(id);

        if (!job) {
            logger.warn("Status requested for unknown job", { jobId: id });
            throw new Error(`Job not found: ${id}`);
        }

        return {
            id: job.id,
            status: job.status,
            completedBatches: job.completedBatches,
            totalBatches: job.totalBatches
        };
    }

};

/**
 * Splits qLength into 1-indexed, inclusive [start, end] ranges of `batch`
 * questions each, e.g. batch=20, qLength=45 -> [1,20] [21,40] [41,45].
 */
function buildRanges(qLength: number, batch: number): QuestionRange[] {

    const ranges: QuestionRange[] = [];

    for (let x = 0; x < qLength; x += batch) {
        ranges.push({
            start: x + 1,
            end: Math.min(x + batch, qLength)
        });
    }

    return ranges;
}

/**
 * Processes all question ranges belonging to a job with bounded concurrency.
 * Individual batch failures do not abort the whole job — they are logged
 * and reflected in the final job status.
 */
async function runJob(job: noteBookJob): Promise<void> {

    const startedAt = performance.now();
    const limit = pLimit(CONCURRENCY_LIMIT);
    const ranges = buildRanges(job.qLength, job.batch);

    logger.info("Job ranges built", {
        jobId: job.id,
        totalBatches: ranges.length
    });
const page = await connectChrome();

await page.goto(job.noteBookUrl, {
    // waitUntil: "networkidle",
    timeout: 180000,
});

const input = page.locator("textarea[aria-label='Query box']");

await expect(input).toBeVisible();

await expect(input).toBeEditable();

logger.info("Notebook is ready");


    const results = await Promise.allSettled(
        ranges.map((range) =>
            limit(async () => {
                const result = await processNoteBook(page, job.id, range.start, range.end);
                incrementCompletedBatches(job.id);
                return result;
            })
        )
    );
    await page.close().catch((closeError : Error) => {
            logger.warn("Failed to close page", { error: closeError, jobId: job.id });
        });
    const failures = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected"
    );

    if (failures.length > 0) {
        failures.forEach((failure) => {
            logger.error("Batch failed within job", {
                jobId: job.id,
                error: failure.reason
            });
        });

        updateJobStatus(job.id, "failed");

        logger.warn("Job finished with failures", {
            jobId: job.id,
            failedCount: failures.length,
            duration: performance.now() - startedAt
        });

        return;
    }

    updateJobStatus(job.id, "completed");

    logger.info("Job completed successfully", {
        jobId: job.id,
        totalBatches: ranges.length,
        duration: performance.now() - startedAt
    });
}