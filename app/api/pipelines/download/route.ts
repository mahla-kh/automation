import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { getJob } from "@/server/services/Pjob.service";
import { sanitizeFolderName } from "@/server/services/storage.service";

const OUTPUTS_ROOT = path.join(process.cwd(), "outputs");

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");
    const fileId = searchParams.get("fileId");

    if (!jobId || !fileId) {
      return NextResponse.json(
        { error: "jobId and fileId query parameters are required" },
        { status: 400 }
      );
    }

    const job = getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: `Job not found: ${jobId}` },
        { status: 404 }
      );
    }

    const fileStatus = job.fileStatuses[fileId];
    if (!fileStatus) {
      return NextResponse.json(
        { error: `File not found in job: ${fileId}` },
        { status: 404 }
      );
    }

    if (fileStatus.upload.status !== "success") {
      return NextResponse.json(
        { error: `OCR output is not ready yet for file: ${fileStatus.fileName}` },
        { status: 400 }
      );
    }

    // Determine target file candidate paths
    const baseName = fileStatus.fileName.replace(/\.[^/.]+$/, "").replace(/[\\/:*?"<>|]+/g, "_").trim();
    const candidates: string[] = [];

    if (fileStatus.outputPath) {
      candidates.push(path.resolve(process.cwd(), fileStatus.outputPath));
    }

    const folderDir = path.resolve(OUTPUTS_ROOT, sanitizeFolderName(baseName));
    candidates.push(path.join(folderDir, "result.txt"));

    let resolvedPath: string | null = null;
    for (const cand of candidates) {
      // Path traversal security check
      if (!cand.startsWith(OUTPUTS_ROOT + path.sep) && cand !== OUTPUTS_ROOT) {
        continue;
      }
      if (fsSync.existsSync(cand)) {
        resolvedPath = cand;
        break;
      }
    }

    if (!resolvedPath) {
      return NextResponse.json(
        { error: `Output file not found on disk for file: ${fileStatus.fileName}` },
        { status: 404 }
      );
    }

    const fileBuffer = await fs.readFile(resolvedPath);
    const downloadName = fileStatus.outputFilename || `${baseName}_result.txt`;
    const contentType = "text/plain; charset=utf-8";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(downloadName)}"`,
      },
    });
  } catch (error) {
    console.error("Pipeline download error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to download file" },
      { status: 500 }
    );
  }
}
