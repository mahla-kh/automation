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
    registerPrompt,
    updatePromptStatus,
    getPromptRecord,
    noteBookJob,
    CreateJobParams
} from "./Njob.service";
import { logger } from "../lib/logger";
import { processNoteBook, buildPromptForBatch } from "../workers/noteBook.worker";
import { browserManager } from "../browser/browserManager";
import { expect } from "playwright/test";
import { getPromptByTitle } from "../prompts/notebookPrompts";

const CONCURRENCY_LIMIT = 1;

export interface PipelineStartResult {
    jobId: string;
}

import { buildRanges, resolveQuestionsLength, type QuestionRange } from "./batchRanges";
export type { QuestionRange } from "./batchRanges";

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
                qLength: resolveQuestionsLength(legacyQLength)
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
            subject: job.subject,
            folderName: job.folderName,
            noteBookUrl: job.noteBookUrl,
            promptTitle: job.promptTitle,
            promptType: job.promptType,
            batch: job.batch,
            qLength: job.qLength,
            startpoint: job.startpoint,
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
    },

    /**
     * Retry a single prompt within a job.
     *
     * The stored PromptRecord is the source of truth for subject, qnumber, batch,
     * index, start, end, and prompt text. These values are NEVER regenerated — the
     * original values are reused verbatim, guaranteeing the retry is deterministic.
     */
    async retryPrompt(jobId: string, promptIndex: number): Promise<{ jobId: string; promptIndex: number }> {
        const job = getJob(jobId);
        if (!job) throw new Error(`Job not found: ${jobId}`);

        const record = getPromptRecord(jobId, promptIndex);
        if (!record) throw new Error(`Prompt index ${promptIndex} not found in job ${jobId}`);

        // Mark as sending immediately so the UI reflects the in-progress state.
        updatePromptStatus(jobId, promptIndex, { status: "sending", errorMessage: undefined });

        void browserManager.withPage(async (page) => {
            await page.goto(job.noteBookUrl, { timeout: 180000 });
            const input = page.locator("textarea[aria-label='Query box']");
            await expect(input).toBeVisible();

            try {
                await processNoteBook(
                    page,
                    jobId,
                    record.start,
                    record.end,
                    record.index,
                    record.batch ?? job.batch,
                    // Use the stored prompt text — never regenerate from current job state.
                    record.prompt,
                    undefined, // topic
                    record.subject ?? job.subject,
                    job.folderName
                );

                updatePromptStatus(jobId, promptIndex, {
                    status: "completed",
                    errorMessage: undefined
                });

                logger.info("Prompt retry succeeded", {
                    jobId,
                    promptIndex,
                    subject: record.subject ?? job.subject,
                    folderName: job.folderName
                });
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                updatePromptStatus(jobId, promptIndex, { status: "failed", errorMessage: msg });
                logger.error("Prompt retry failed", { jobId, promptIndex, error: err });
            }
        }).catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            updatePromptStatus(jobId, promptIndex, { status: "failed", errorMessage: msg });
            logger.error("Prompt retry browser session failed", { jobId, promptIndex, error: err });
        });

        return { jobId, promptIndex };
    }
};


async function runJob(job: noteBookJob): Promise<void> {
    const startedAt = performance.now();
    const limit = pLimit(CONCURRENCY_LIMIT);

    try {
        await browserManager.withPage(async (page) => {
            await page.goto(job.noteBookUrl, { timeout: 180000 });

            const input = page.locator("textarea[aria-label='Query box']");
            await expect(input).toBeVisible();
            await expect(input).toBeEditable();
            logger.info("Notebook is ready for job", {
                jobId: job.id,
                subject: job.subject,
                folderName: job.folderName
            });

            if (job.promptType === "jozve" && job.topics && job.topics.length > 0) {
                // Register all topic-based prompts BEFORE any async work starts
                // so every prompt has a stable identity even if earlier ones fail.
                job.topics.forEach((topic, index) => {
                    const promptText = buildPromptForBatch(job.promptText, {
                        start: 1,
                        end: 1,
                        index,
                        batch: 1,
                        topic,
                        subject: job.subject,
                        qnumber: 1
                    });
                    registerPrompt(job.id, {
                        index,
                        start: 1,
                        end: 1,
                        subject: job.subject,
                        qnumber: 1,
                        batch: 1,
                        prompt: promptText
                    });
                });

                const results = await Promise.allSettled(
                    job.topics.map((topic, index) =>
                        limit(async () => {
                            updatePromptStatus(job.id, index, { status: "sending" });
                            try {
                                const result = await processNoteBook(
                                    page,
                                    job.id,
                                    1,
                                    1,
                                    index,
                                    1,
                                    job.promptText,
                                    topic,
                                    job.subject,
                                    job.folderName
                                );
                                updatePromptStatus(job.id, index, {
                                    status: "completed"
                                });
                                incrementCompletedBatches(job.id);
                                return result;
                            } catch (err) {
                                const msg = err instanceof Error ? err.message : String(err);
                                updatePromptStatus(job.id, index, { status: "failed", errorMessage: msg });
                                throw err;
                            }
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
                const ranges = buildRanges(job.qLength, job.batch, job.startpoint ?? 1);
                logger.info("Job question ranges built", {
                    jobId: job.id,
                    subject: job.subject,
                    folderName: job.folderName,
                    totalBatches: ranges.length,
                    startpoint: job.startpoint,
                    firstQuestion: ranges[0]?.start,
                    lastQuestion: ranges[ranges.length - 1]?.end
                });

                // Register all prompts BEFORE any async work starts.
                // This guarantees each prompt's subject, qnumber, batch, index, start, and end
                // are immutable and captured before any closure or concurrent execution can alter state.
                ranges.forEach((range, index) => {
                    const promptText = buildPromptForBatch(job.promptText, {
                        start: range.start,
                        end: range.end,
                        index,
                        batch: job.batch,
                        subject: job.subject,
                        qnumber: range.start
                    });
                    registerPrompt(job.id, {
                        index,
                        start: range.start,
                        end: range.end,
                        subject: job.subject,
                        qnumber: range.start,
                        batch: job.batch,
                        prompt: promptText
                    });
                });

                const results = await Promise.allSettled(
                    ranges.map((range, index) =>
                        limit(async () => {
                            // Each closure captures its own `range` and `index` from
                            // the outer .map() — these are immutable within the closure.
                            updatePromptStatus(job.id, index, { status: "sending" });
                            try {
                                const result = await processNoteBook(
                                    page,
                                    job.id,
                                    range.start,
                                    range.end,
                                    index,
                                    job.batch,
                                    job.promptText,
                                    undefined,
                                    job.subject,
                                    job.folderName
                                );
                                updatePromptStatus(job.id, index, {
                                    status: "completed"
                                });
                                incrementCompletedBatches(job.id);
                                return result;
                            } catch (err) {
                                const msg = err instanceof Error ? err.message : String(err);
                                updatePromptStatus(job.id, index, { status: "failed", errorMessage: msg });
                                throw err;
                            }
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
        });
    } catch (err) {
        logger.error("Job execution failed", { error: err, jobId: job.id });
        setJobError(job.id, err instanceof Error ? err.message : String(err));
    }
}