import { NextRequest, NextResponse } from "next/server";
import { createToHtmlJob } from "@/server/services/toHtmlJob.service";
import { runToHtmlJob } from "@/server/services/toHtmlRunner.service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileName, prompt, sections, maxLinesPerChunk } = body;

    if (!fileName || typeof fileName !== "string") {
      return NextResponse.json(
        { error: "fileName is required and must be a string" },
        { status: 400 }
      );
    }

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "prompt is required and must not be empty" },
        { status: 400 }
      );
    }

    if (!Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json(
        { error: "sections must be a non-empty array of parsed sections" },
        { status: 400 }
      );
    }

    const job = createToHtmlJob({
      fileName: fileName.trim(),
      prompt: prompt.trim(),
      maxLinesPerChunk: typeof maxLinesPerChunk === "number" ? maxLinesPerChunk : undefined,
      sections: sections.map((s: any) => ({
        marker: String(s.marker || "CUT"),
        markerNumber: typeof s.markerNumber === "number" ? s.markerNumber : null,
        content: String(s.content || ""),
        charCount: typeof s.charCount === "number" ? s.charCount : String(s.content || "").length,
      })),
    });

    // Start background processing
    void runToHtmlJob(job.id).catch((err) => {
      console.error("Unhandled error in runToHtmlJob:", err);
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      totalChunks: job.sections.length,
      totalSections: sections.length,
      fileName: job.fileName,
    });
  } catch (error) {
    console.error("ToHtml start error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start tohtml job" },
      { status: 500 }
    );
  }
}
