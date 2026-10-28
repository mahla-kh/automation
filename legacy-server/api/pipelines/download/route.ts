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
    const folderDir = path.resolve(OUTPUTS_ROOT, sanitizeFolderName(baseName));
    const targetFile = path.join(folderDir, "result.txt");
    const candidates: string[] = [targetFile];

    if (fileStatus.outputPath) {
      const cleanRel = fileStatus.outputPath.replace(/^[\\/]?(outputs[\\/])?/, "");
      candidates.push(path.resolve(OUTPUTS_ROOT, cleanRel));
    }

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

    let fileContent: string | null = null;
    if (resolvedPath) {
      fileContent = await fs.readFile(resolvedPath, "utf8");
    } else if (fileStatus.result) {
      // Ensure file is persisted to project disk and serve
      try {
        await fs.mkdir(folderDir, { recursive: true });
        await fs.writeFile(targetFile, fileStatus.result, "utf8");
      } catch (writeErr) {
        console.warn("Failed saving fallback result to disk:", writeErr);
      }
      fileContent = fileStatus.result;
    }

    if (fileContent === null) {
      return NextResponse.json(
        { error: `Output file not found for file: ${fileStatus.fileName}` },
        { status: 404 }
      );
    }

    const downloadName = fileStatus.outputFilename || `${baseName}_result.txt`;
    const contentType = "text/plain; charset=utf-8";

    const safeAscii = downloadName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "");
    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
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
