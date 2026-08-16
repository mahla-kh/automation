import { NextRequest, NextResponse } from "next/server";
import { noteBookService } from "@/server/services/noteBook.service";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { jobId } = body;

        if (!jobId || typeof jobId !== "string") {
            return NextResponse.json(
                { error: "jobId is required for retry" },
                { status: 400 }
            );
        }

        const result = await noteBookService.retry(jobId);
        return NextResponse.json({ success: true, jobId: result.jobId });
    } catch (error) {
        console.error("Notebook retry error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Retry failed" },
            { status: 500 }
        );
    }
}
