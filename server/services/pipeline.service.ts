// import pLimit from "p-limit";
// import { getFilesFromFolder } 
// from "./drive.service";
// import { processPipeline } from "../workers/pipeline.worker";
// import { DriveFile } from "@/types/drive";
// import { createJob, updateJobStatus } from "./job.service";


// export const pipelineService = {


// async start(folderUrl:string){


// const folderId =
// extractFolderId(folderUrl);

// console.log('folder id',folderId)
// const files =
// await getFilesFromFolder(folderId as string)

// const job = await createJob(files as DriveFile[]);

// updateJobStatus(

//             job.id,

//             "processing"

//         );
// console.log('after job',job)
// const limit = pLimit(3);

//         await Promise.all(

//             job.files.map(file =>

//                 limit(() => processPipeline(file as DriveFile))

//             )

//         );

//         updateJobStatus(

//             job.id,

//             "completed"

//         );
//         return {
//             jobId: job.id,
//             totalFiles: job.files.length
//         };

// // const job = {

// // id:
// // crypto.randomUUID(),

// // status:"queued",

// // files

// // };



// // بعداً ارسال به Queue


// // return job;


// },



// async status(id:string){

// return {

// id,

// status:"processing"

// }


// }


// }



// function extractFolderId(url:string){

// return url.split("/")
// .pop();

// }

import pLimit from "p-limit";
import { DriveFile } from "@/types/drive";
import {
    createJob,
    getJob,
    updateJobStatus,
    PipelineJob
} from "./Pjob.service";
import { logger } from "../lib/logger";
import { getFilesFromFolder } from "./drive.service";
import { processPipeline } from "../workers/pipeline.worker";

const CONCURRENCY_LIMIT = 1;

export interface PipelineStartResult {
    jobId: string;
    totalFiles: number;
}

export interface PipelineStatusResult {
    id: string;
    status: PipelineJob["status"];
    totalFiles: number;
}

export const pipelineService = {

    /**
     * Kicks off a pipeline job for a Google Drive folder.
     * Resolves as soon as the job is created and dispatched — actual file
     * processing (download -> OCR -> save) happens in the background.
     * Callers should poll `status(jobId)` for progress/completion.
     */
    async start(folderUrl: string): Promise<PipelineStartResult> {

        const startedAt = performance.now();

        const folderId = extractFolderId(folderUrl);

        if (!folderId) {
            logger.error("Invalid folder URL, could not extract folder id", { folderUrl });
            throw new Error("Invalid Google Drive folder URL");
        }

        logger.info("Pipeline start requested", { folderId });

        const files = await getFilesFromFolder(folderId);

        if (!files.length) {
            logger.warn("No files found in Drive folder", { folderId });
        }

        const job = createJob(files as DriveFile[]);

        logger.info("Job created", {
            jobId: job.id,
            totalFiles: job.files.length
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
            totalFiles: job.files.length
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
            totalFiles: job.files.length
        };
    }

};

/**
 * Processes all files belonging to a job with bounded concurrency.
 * Individual file failures do not abort the whole job — they are logged
 * and reflected in the final job status.
 */
async function runJob(job: PipelineJob): Promise<void> {

    const startedAt = performance.now();
    const limit = pLimit(CONCURRENCY_LIMIT);

    const results = await Promise.allSettled(
        job.files.map(file => limit(() => processPipeline(file)))
    );

    const failures = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected"
    );

    if (failures.length > 0) {
        failures.forEach((failure) => {
            logger.error("File processing failed within job", {
                jobId: job.id,
                error: failure.reason
            });
        });

        updateJobStatus(job.id, "failed");

        logger.warn("Job finished with failures", {
            jobId: job.id,
            failedCount: failures.length,
            totalFiles: job.files.length,
            duration: performance.now() - startedAt
        });

        return;
    }

    updateJobStatus(job.id, "completed");

    logger.info("Job completed successfully", {
        jobId: job.id,
        totalFiles: job.files.length,
        duration: performance.now() - startedAt
    });
}

/**
 * Extracts a Google Drive folder ID from either:
 *  - a full folder URL (with or without query params/trailing slash)
 *  - a raw folder ID passed directly
 */
function extractFolderId(url: string): string | null {

    const folderUrlMatch = url.match(/folders\/([a-zA-Z0-9_-]+)/);

    if (folderUrlMatch) {
        return folderUrlMatch[1];
    }

    const fallback = url
        .split("?")[0]
        .split("/")
        .filter(Boolean)
        .pop();

    return fallback ?? null;
}