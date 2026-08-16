export interface noteBookJob {
    id: string;
    noteBookUrl: string;
    promptTitle: string;
    promptText?: string;
    promptType: "question" | "jozve";
    status: "queued" | "processing" | "completed" | "failed";
    batch: number;
    qLength: number;
    topics?: string[];
    totalBatches: number;
    completedBatches: number;
    responseContent?: string;
    errorMessage?: string;
    retryCount: number;
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
}

export interface CreateJobParams {
    noteBookUrl: string;
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
    let promptTitle: string;
    let promptText: string | undefined;
    let promptType: "question" | "jozve";
    let batch: number;
    let qLength: number;
    let topics: string[] | undefined;

    if (typeof paramsOrUrl === "string") {
        noteBookUrl = paramsOrUrl;
        promptTitle = "Default Prompt";
        promptType = "question";
        batch = legacyBatch ?? 15;
        qLength = legacyQLength ?? 100;
    } else {
        noteBookUrl = paramsOrUrl.noteBookUrl;
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

    const job: noteBookJob = {
        id: crypto.randomUUID(),
        noteBookUrl,
        promptTitle,
        promptText,
        promptType,
        status: "queued",
        batch,
        qLength,
        topics,
        totalBatches,
        completedBatches: 0,
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