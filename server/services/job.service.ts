import { DriveFile } from "@/types/drive";

export interface PipelineJob {

    id: string;

    status: "queued" | "processing" | "completed" | "failed";

    files: DriveFile[];

}

const jobs = new Map<string, PipelineJob>();

export function createJob(files: DriveFile[]) {

    const job: PipelineJob = {

        id: crypto.randomUUID(),

        status: "queued",

        files

    };

    jobs.set(job.id, job);

    return job;

}

export function getJob(id: string) {

    return jobs.get(id);

}

export function updateJobStatus(

    id: string,

    status: PipelineJob["status"]

) {

    const job = jobs.get(id);

    if (!job) return;

    job.status = status;

}