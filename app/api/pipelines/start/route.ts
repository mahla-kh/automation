import { NextRequest, NextResponse } from "next/server";
import { pipelineService } from "@/server/services/pipeline.service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { folderUrl, enableReformat } = body;

    if (!folderUrl) {
      return NextResponse.json(
        { error: "Folder URL is required" },
        { status: 400 }
      );
    }

    const jobData = await pipelineService.start(folderUrl, Boolean(enableReformat));

    return NextResponse.json({
      success: true,
      jobId: jobData.jobId,
      totalFiles: jobData.totalFiles,
      reformatEnabled: Boolean(enableReformat),
    });
  } catch (error) {
    console.error("Pipeline start error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Pipeline failed to start" },
      { status: 500 }
    );
  }
}