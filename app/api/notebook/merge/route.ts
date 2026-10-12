import { NextRequest, NextResponse } from "next/server";
import { noteBookService } from "@/server/services/noteBook.service";
import { mergeResponses, listResponses } from "@/server/services/storage.service";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { jobId } = body;

        if (!jobId || typeof jobId !== "string") {
            return NextResponse.json(
                { error: "jobId is required" },
                { status: 400 }
            );
        }

        // Validate that the job exists (path-safe lookup through job store)
        const job = await noteBookService.status(jobId);

        if (job.status !== "completed") {
            return NextResponse.json(
                { error: "Job is not completed yet" },
                { status: 409 }
            );
        }

        const targetFolder = job.folderName || jobId;
        const merged = await mergeResponses(targetFolder);

        return NextResponse.json({
            success: true,
            jobId,
            folderName: targetFolder,
            merged,
            length: merged.length
        });
    } catch (error) {
        console.error("Notebook merge error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Merge failed" },
            { status: 500 }
        );
    }
}

/** GET /api/notebook/merge?jobId=... — check if response files exist */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const jobId = searchParams.get("jobId");

        if (!jobId) {
            return NextResponse.json({ error: "jobId is required" }, { status: 400 });
        }

        // Validate job exists
        const job = await noteBookService.status(jobId);
        const targetFolder = job.folderName || jobId;

        const files = await listResponses(targetFolder);
        return NextResponse.json({
            success: true,
            jobId,
            folderName: targetFolder,
            fileCount: files.length,
            files: files.map((f) => {
                const parts = f.split(/[\\/]/);
                return parts[parts.length - 1];
            })
        });
    } catch (error) {
        console.error("Notebook merge list error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to list responses" },
            { status: 500 }
        );
    }
}
