import pLimit from "p-limit";
import {
    createJob,
    getJob,
    getAllJobs,
    updateJobStatus,
    incrementCompletedBatches,
    appendJobResponse,
    setJobError,
    prepareJobForRetry,
    noteBookJob,
    CreateJobParams
} from "./Njob.service";
import { logger } from "../lib/logger";
import { processNoteBook } from "../workers/noteBook.worker";
import { connectChrome } from "../browser/connect";
import { expect } from "playwright/test";
import { getPromptByTitle } from "../prompts/notebookPrompts";

const CONCURRENCY_LIMIT = 1;

export interface PipelineStartResult {
    jobId: string;
}

export interface QuestionRange {
    start: number; // 1-indexed, inclusive
    end: number;   // 1-indexed, inclusive
}

export const noteBookService = {
    async start(
        paramsOrUrl: string | CreateJobParams,
        legacyBatch?: number,
        legacyQLength?: number
    ): Promise<PipelineStartResult> {
        const startedAt = performance.now();

        let jobParams: CreateJobParams;
        if (typeof paramsOrUrl === "string") {
            jobParams = {
                noteBookUrl: paramsOrUrl,
                promptTitle: "Default Question Analysis",
                promptType: "question",
                batch: legacyBatch ?? 15,
                qLength: legacyQLength ?? 100
            };
        } else {
            jobParams = paramsOrUrl;
        }

        // If promptText wasn't passed directly, resolve template by title if possible
        if (!jobParams.promptText && jobParams.promptTitle) {
            const preset = getPromptByTitle(jobParams.promptTitle);
            if (preset) {
                jobParams.promptText = preset.template;
            }
        }

        const job = createJob(jobParams);

        logger.info("Job created", {
            jobId: job.id,
            noteBookUrl: job.noteBookUrl,
            promptTitle: job.promptTitle,
            promptType: job.promptType,
            batch: job.batch,
            qLength: job.qLength,
            totalBatches: job.totalBatches
        });

        updateJobStatus(job.id, "processing");

        void runJob(job).catch((error) => {
            logger.error("Unhandled error while running job", {
                error,
                jobId: job.id
            });
            setJobError(job.id, error instanceof Error ? error.message : String(error));
        });

        logger.info("Pipeline start completed", {
            jobId: job.id,
            duration: performance.now() - startedAt
        });

        return { jobId: job.id };
    },

    async status(id: string): Promise<noteBookJob> {
        const job = getJob(id);
        if (!job) {
            logger.warn("Status requested for unknown job", { jobId: id });
            throw new Error(`Job not found: ${id}`);
        }
        return job;
    },

    async list(): Promise<noteBookJob[]> {
        return getAllJobs();
    },

    async retry(id: string): Promise<PipelineStartResult> {
        const job = prepareJobForRetry(id);
        if (!job) {
            throw new Error(`Job not found for retry: ${id}`);
        }

        updateJobStatus(job.id, "processing");

        void runJob(job).catch((error) => {
            logger.error("Unhandled error while running retried job", {
                error,
                jobId: job.id
            });
            setJobError(job.id, error instanceof Error ? error.message : String(error));
        });

        return { jobId: job.id };
    }
};

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

async function runJob(job: noteBookJob): Promise<void> {
    const startedAt = performance.now();
    const limit = pLimit(CONCURRENCY_LIMIT);

    let page;
    try {
        page = await connectChrome();
        await page.goto(job.noteBookUrl, { timeout: 180000 });

        const input = page.locator("textarea[aria-label='Query box']");
        await expect(input).toBeVisible();
        await expect(input).toBeEditable();
        logger.info("Notebook is ready for job", { jobId: job.id });
    } catch (err) {
        logger.error("Failed to connect Chrome or navigate to notebook", { error: err, jobId: job.id });
        setJobError(job.id, err instanceof Error ? err.message : "Failed to open NotebookLM");
        if (page) {
            await page.close().catch(() => {});
        }
        return;
    }

    try {
        if (job.promptType === "jozve" && job.topics && job.topics.length > 0) {
            const results = await Promise.allSettled(
                job.topics.map((topic, index) =>
                    limit(async () => {
                        const result = await processNoteBook(
                            page,
                            job.id,
                            1,
                            1,
                            index,
                            1,
                            job.promptText,
                            topic
                        );
                        incrementCompletedBatches(job.id);
                        appendJobResponse(job.id, result.answer);
                        return result;
                    })
                )
            );

            const failures = results.filter(
                (res): res is PromiseRejectedResult => res.status === "rejected"
            );

            if (failures.length > 0) {
                setJobError(job.id, `${failures.length} topic batches failed during execution.`);
                return;
            }
        } else {
            const ranges = buildRanges(job.qLength, job.batch);
            logger.info("Job question ranges built", { jobId: job.id, totalBatches: ranges.length });

            const results = await Promise.allSettled(
                ranges.map((range, index) =>
                    limit(async () => {
                        const result = await processNoteBook(
                            page,
                            job.id,
                            range.start,
                            range.end,
                            index,
                            job.batch,
                            job.promptText
                        );
                        incrementCompletedBatches(job.id);
                        appendJobResponse(job.id, result.answer);
                        return result;
                    })
                )
            );

            const failures = results.filter(
                (res): res is PromiseRejectedResult => res.status === "rejected"
            );

            if (failures.length > 0) {
                setJobError(job.id, `${failures.length} question batches failed during execution.`);
                return;
            }
        }

        updateJobStatus(job.id, "completed");
        logger.info("Job completed successfully", { jobId: job.id, duration: performance.now() - startedAt });
    } catch (err) {
        logger.error("Job execution failed", { error: err, jobId: job.id });
        setJobError(job.id, err instanceof Error ? err.message : String(err));
    } finally {
        if (page) {
            await page.close().catch((closeErr: Error) => {
                logger.warn("Failed to close page", { error: closeErr, jobId: job.id });
            });
        }
    }
}