import { NextRequest, NextResponse } from "next/server";
import { noteBookService } from "@/server/services/noteBook.service";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const jobId = searchParams.get("jobId");

        if (jobId) {
            const job = await noteBookService.status(jobId);
            return NextResponse.json({ success: true, job });
        }

        const jobs = await noteBookService.list();
        return NextResponse.json({ success: true, jobs });
    } catch (error) {
        console.error("Notebook status error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to fetch status" },
            { status: 500 }
        );
    }
}
