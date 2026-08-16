import { NextRequest, NextResponse } from "next/server";
import { pipelineService } from "@/server/services/pipeline.service";

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");

    if (!id) {
      const jobs = await pipelineService.listJobs();
      return NextResponse.json({ jobs });
    }

    const status = await pipelineService.status(id);
    return NextResponse.json(status);
  } catch (error) {
    console.error("Pipeline status endpoint error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch status" },
      { status: 404 }
    );
  }
}