import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { getToHtmlJob } from "@/server/services/toHtmlJob.service";
import { getJobOutputPath } from "@/server/services/toHtmlRunner.service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");
    const sectionIndexStr = searchParams.get("sectionIndex");
    const filenameParam = searchParams.get("filename");
    const isMerged = searchParams.get("merged") === "true";

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId query parameter is required" },
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

    // Merged download support
    if (isMerged) {
      const completedSections = job.sections.filter(
        (s) => s.status === "completed" && s.outputFilename
      );

      if (completedSections.length === 0) {
        return NextResponse.json(
          { error: "No completed section output files available to merge" },
          { status: 400 }
        );
      }

      const contents: string[] = [];
      for (const s of completedSections) {
        if (!s.outputFilename) continue;
        const filePath = getJobOutputPath(job.folderName, s.outputFilename);
        if (fsSync.existsSync(filePath)) {
          const text = await fs.readFile(filePath, "utf8");
          contents.push(`========================================\n${s.label || s.marker}\n========================================\n\n${text}`);
        }
      }

      const mergedText = contents.join("\n\n\n");
      const baseFilename = job.fileName.replace(/\.[^/.]+$/, "") || "job";
      const mergedDownloadName = `${baseFilename}-merged.txt`;

      return new NextResponse(mergedText, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(mergedDownloadName)}"`,
        },
      });
    }

    // Individual file download
    let targetFilename = filenameParam;

    if (!targetFilename && sectionIndexStr !== null) {
      const sectionIndex = parseInt(sectionIndexStr, 10);
      if (isNaN(sectionIndex) || sectionIndex < 0 || sectionIndex >= job.sections.length) {
        return NextResponse.json(
          { error: `Invalid sectionIndex: ${sectionIndexStr}` },
          { status: 400 }
        );
      }

      const section = job.sections[sectionIndex];
      if (section.status !== "completed" || !section.outputFilename) {
        return NextResponse.json(
          { error: `Section ${section.label || section.marker} is not completed yet` },
          { status: 400 }
        );
      }

      targetFilename = section.outputFilename;
    }

    if (!targetFilename) {
      return NextResponse.json(
        { error: "Either sectionIndex or filename must be provided" },
        { status: 400 }
      );
    }

    // Safe path resolution
    const filePath = getJobOutputPath(job.folderName, targetFilename);

    if (!fsSync.existsSync(filePath)) {
      return NextResponse.json(
        { error: `Output file not found on disk: ${targetFilename}` },
        { status: 404 }
      );
    }

    const fileBuffer = await fs.readFile(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(path.basename(filePath))}"`,
      },
    });
  } catch (error) {
    console.error("ToHtml download error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to download file" },
      { status: 500 }
    );
  }
}
