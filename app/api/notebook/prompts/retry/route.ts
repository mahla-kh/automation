import { NextRequest, NextResponse } from "next/server";
import { noteBookService } from "@/server/services/noteBook.service";
import { getJob } from "@/server/services/Njob.service";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { jobId, promptIndex } = body;

        if (!jobId || typeof jobId !== "string") {
            return NextResponse.json({ error: "jobId is required" }, { status: 400 });
        }

        if (typeof promptIndex !== "number" || !Number.isInteger(promptIndex) || promptIndex < 0) {
            return NextResponse.json({ error: "promptIndex must be a non-negative integer" }, { status: 400 });
        }

        // Validate the job exists and the prompt belongs to it.
        const job = getJob(jobId);
        if (!job) {
            return NextResponse.json({ error: `Job not found: ${jobId}` }, { status: 404 });
        }

        const record = job.prompts.find((p) => p.index === promptIndex);
        if (!record) {
            return NextResponse.json(
                { error: `Prompt index ${promptIndex} not found in job ${jobId}` },
                { status: 404 }
            );
        }

        // Kick off the async retry. Returns immediately with the prompt's current state.
        await noteBookService.retryPrompt(jobId, promptIndex);

        return NextResponse.json({
            success: true,
            jobId,
            promptIndex,
            // Return the current state of the prompt (status is now "sending").
            prompt: job.prompts.find((p) => p.index === promptIndex)
        });
    } catch (error) {
        console.error("Prompt retry error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Prompt retry failed" },
            { status: 500 }
        );
    }
}
