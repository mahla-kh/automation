import { NextRequest, NextResponse } from "next/server";
import { retryToHtmlSection, retryAllFailedSections } from "@/server/services/toHtmlRunner.service";
import { getToHtmlJob } from "@/server/services/toHtmlJob.service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId, sectionIndex } = body;

    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json(
        { error: "jobId is required and must be a string" },
        { status: 400 }
      );
    }

    const job = getToHtmlJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: `Job not found: ${jobId}` },
        { status: 404 }
      );
    }

    if (typeof sectionIndex === "number") {
      if (!Number.isInteger(sectionIndex) || sectionIndex < 0 || sectionIndex >= job.sections.length) {
        return NextResponse.json(
          { error: `Invalid sectionIndex: ${sectionIndex}` },
          { status: 400 }
        );
      }
      await retryToHtmlSection(jobId, sectionIndex);
    } else {
      await retryAllFailedSections(jobId);
    }

    return NextResponse.json({
      success: true,
      jobId,
      sectionIndex: typeof sectionIndex === "number" ? sectionIndex : "all_failed",
    });
  } catch (error) {
    console.error("ToHtml retry endpoint error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to retry section" },
      { status: 500 }
    );
  }
}
