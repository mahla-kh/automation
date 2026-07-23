
// export interface noteBookJob {

//     id: string;

//     status: "queued" | "processing" | "completed" | "failed";

//     batch:number;
//     qLength:number;

// }

// const jobs = new Map<string, noteBookJob>();

// export function createJob(batch:number,qLength:number) {

//     const job: noteBookJob = {

//         id: crypto.randomUUID(),

//         status: "queued",

//         batch,qLength

//     };

//     jobs.set(job.id, job);

//     return job;

// }

// export function getJob(id: string) {

//     return jobs.get(id);

// }

// export function updateJobStatus(

//     id: string,

//     status: noteBookJob["status"]

// ) {

//     const job = jobs.get(id);

//     if (!job) return;

//     job.status = status;

// }


export interface noteBookJob {

    id: string;

    noteBookUrl: string;

    status: "queued" | "processing" | "completed" | "failed";

    batch: number;
    qLength: number;

    totalBatches: number;
    completedBatches: number;

    createdAt: number;
}

const jobs = new Map<string, noteBookJob>();

export function createJob(noteBookUrl: string, batch: number, qLength: number): noteBookJob {

    const totalBatches = Math.ceil(qLength / batch);

    const job: noteBookJob = {

        id: crypto.randomUUID(),

        noteBookUrl,

        status: "queued",

        batch,
        qLength,

        totalBatches,
        completedBatches: 0,

        createdAt: Date.now()
    };

    jobs.set(job.id, job);

    return job;

}

export function getJob(id: string) {

    return jobs.get(id);

}

export function updateJobStatus(

    id: string,

    status: noteBookJob["status"]

) {

    const job = jobs.get(id);

    if (!job) return;

    job.status = status;

}

export function incrementCompletedBatches(id: string) {

    const job = jobs.get(id);

    if (!job) return;

    job.completedBatches += 1;

}