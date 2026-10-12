import { resolveUniqueFolderName } from "./storage.service";

export type PromptStatus = "pending" | "sending" | "completed" | "failed";

export interface PromptRecord {
    /** 0-based position in the job's batch sequence. Immutable after creation. */
    index: number;
    /** 1-based, inclusive start of the question range. Immutable after creation. */
    start: number;
    /** 1-based, inclusive end of the question range. Immutable after creation. */
    end: number;
    /** Subject associated with this prompt (e.g. "Anatomy"). Immutable after creation. */
    subject?: string;
    /** Question start number (e.g. 150). Immutable after creation. */
    qnumber?: number;
    /** Batch size/identifier. Immutable after creation. */
    batch?: number;
    /** The exact prompt text that was (or will be) sent. Immutable after creation. */
    prompt: string;
    status: PromptStatus;
    /** Filename of the saved response, set once the response is stored. */
    responseFile?: string;
    errorMessage?: string;
}

export interface noteBookJob {
    id: string;
    noteBookUrl: string;
    subject?: string;
    folderName: string;
    promptTitle: string;
    promptText?: string;
    promptType: "question" | "jozve";
    status: "queued" | "processing" | "completed" | "failed";
    batch: number;
    qLength: number;
    topics?: string[];
    totalBatches: number;
    completedBatches: number;
    /** Per-prompt tracking records. Populated before any prompt is sent. */
    prompts: PromptRecord[];
    responseContent?: string;
    errorMessage?: string;
    retryCount: number;
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
}

export interface CreateJobParams {
    noteBookUrl: string;
    subject?: string;
    folderName?: string;
    promptTitle: string;
    promptText?: string;
    promptType: "question" | "jozve";
    batch?: number;
    qLength?: number;
    topics?: string[];
}

const jobs = new Map<string, noteBookJob>();

export function createJob(
    paramsOrUrl: string | CreateJobParams,
    legacyBatch?: number,
    legacyQLength?: number
): noteBookJob {
    let noteBookUrl: string;
    let subject: string | undefined;
    let rawFolderName: string | undefined;
    let promptTitle: string;
    let promptText: string | undefined;
    let promptType: "question" | "jozve";
    let batch: number;
    let qLength: number;
    let topics: string[] | undefined;

    if (typeof paramsOrUrl === "string") {
        noteBookUrl = paramsOrUrl;
        subject = undefined;
        rawFolderName = undefined;
        promptTitle = "Default Prompt";
        promptType = "question";
        batch = legacyBatch ?? 15;
        qLength = legacyQLength ?? 100;
    } else {
        noteBookUrl = paramsOrUrl.noteBookUrl;
        subject = paramsOrUrl.subject?.trim() || undefined;
        rawFolderName = paramsOrUrl.folderName?.trim() || undefined;
        promptTitle = paramsOrUrl.promptTitle;
        promptText = paramsOrUrl.promptText;
        promptType = paramsOrUrl.promptType;
        batch = paramsOrUrl.batch ?? 15;
        qLength = paramsOrUrl.qLength ?? 100;
        topics = paramsOrUrl.topics;
    }

    const totalBatches = promptType === "jozve" && topics && topics.length > 0
        ? topics.length
        : Math.max(1, Math.ceil(qLength / Math.max(1, batch)));

    // Determine the base folder name from user input, subject, or promptTitle
    const baseFolderName = rawFolderName || subject || promptTitle || "responses";
    const folderName = resolveUniqueFolderName(baseFolderName, (candidate) => {
        for (const existingJob of jobs.values()) {
            if (existingJob.folderName === candidate) return true;
        }
        return false;
    });

    const job: noteBookJob = {
        id: crypto.randomUUID(),
        noteBookUrl,
        subject,
        folderName,
        promptTitle,
        promptText,
        promptType,
        status: "queued",
        batch,
        qLength,
        topics,
        totalBatches,
        completedBatches: 0,
        prompts: [],
        responseContent: "",
        retryCount: 0,
        createdAt: Date.now()
    };

    jobs.set(job.id, job);
    return job;
}

export function getJob(id: string): noteBookJob | undefined {
    return jobs.get(id);
}

export function getAllJobs(): noteBookJob[] {
    return Array.from(jobs.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function updateJobStatus(id: string, status: noteBookJob["status"]) {
    const job = jobs.get(id);
    if (!job) return;

    job.status = status;
    if (status === "processing" && !job.startedAt) {
        job.startedAt = Date.now();
    } else if (status === "completed" || status === "failed") {
        job.completedAt = Date.now();
    }
}

export function incrementCompletedBatches(id: string) {
    const job = jobs.get(id);
    if (!job) return;
    job.completedBatches += 1;
}

export function appendJobResponse(id: string, newText: string) {
    const job = jobs.get(id);
    if (!job) return;

    if (job.responseContent && job.responseContent.length > 0) {
        job.responseContent += "\n\n----------------------------------------\n\n" + newText;
    } else {
        job.responseContent = newText;
    }
}

export function setJobError(id: string, errorMessage: string) {
    const job = jobs.get(id);
    if (!job) return;
    job.errorMessage = errorMessage;
    job.status = "failed";
    job.completedAt = Date.now();
}

export function prepareJobForRetry(id: string): noteBookJob | undefined {
    const job = jobs.get(id);
    if (!job) return undefined;

    job.status = "queued";
    job.completedBatches = 0;
    job.errorMessage = undefined;
    job.retryCount += 1;
    job.startedAt = undefined;
    job.completedAt = undefined;
    return job;
}

/**
 * Register a prompt record for a job before sending begins.
 * Called once per prompt when the job starts, to give each prompt a persistent
 * identity (index, start, end, prompt text) before any async work happens.
 */
export function registerPrompt(
    jobId: string,
    record: Omit<PromptRecord, "status" | "responseFile" | "errorMessage">
): void {
    const job = jobs.get(jobId);
    if (!job) return;
    // Ensure no duplicate registration for the same index.
    if (job.prompts.some((p) => p.index === record.index)) return;
    job.prompts.push({ ...record, status: "pending" });
}

/**
 * Update the status of a specific prompt within a job.
 * index, start, and end are NEVER modified here — they are immutable identifiers.
 */
export function updatePromptStatus(
    jobId: string,
    promptIndex: number,
    update: Partial<Pick<PromptRecord, "status" | "responseFile" | "errorMessage">>
): void {
    const job = jobs.get(jobId);
    if (!job) return;
    const record = job.prompts.find((p) => p.index === promptIndex);
    if (!record) return;
    Object.assign(record, update);
}

/**
 * Get a single prompt record by its immutable index.
 */
export function getPromptRecord(
    jobId: string,
    promptIndex: number
): PromptRecord | undefined {
    const job = jobs.get(jobId);
    if (!job) return undefined;
    return job.prompts.find((p) => p.index === promptIndex);
}