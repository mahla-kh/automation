import { NextRequest, NextResponse } from "next/server";
import { getToHtmlJobDetails, getAllToHtmlJobs } from "@/server/services/toHtmlJob.service";

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");

    if (!id) {
      const jobs = getAllToHtmlJobs();
      return NextResponse.json({ jobs });
    }

    const job = getToHtmlJobDetails(id);
    if (!job) {
      return NextResponse.json(
        { error: `Job not found: ${id}` },
        { status: 404 }
      );
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error("ToHtml status endpoint error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch job status" },
      { status: 500 }
    );
  }
}
