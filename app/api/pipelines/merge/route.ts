import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getJob } from "@/server/services/Pjob.service";
import { sanitizeFolderName } from "@/server/services/storage.service";

const OUTPUTS_ROOT = path.join(process.cwd(), "outputs");

async function readResult(fileName: string, outputPath?: string): Promise<string | null> {
  const baseName = fileName.replace(/\.[^/.]+$/, "").replace(/[\\/:*?"<>|]+/g, "_").trim();
  const candidates = [
    ...(outputPath ? [path.resolve(process.cwd(), outputPath)] : []),
    path.join(OUTPUTS_ROOT, sanitizeFolderName(baseName), "result.txt"),
  ];

  for (const candidate of candidates) {
    // Path traversal protection
    if (!candidate.startsWith(OUTPUTS_ROOT + path.sep)) continue;
    try {
      return await fs.readFile(candidate, "utf8");
    } catch {
      // try next candidate
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const jobId = new URL(req.url).searchParams.get("jobId");
    if (!jobId) {
      return NextResponse.json({ error: "jobId query parameter is required" }, { status: 400 });
    }

    const job = getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: `Job not found: ${jobId}` }, { status: 404 });
    }

    const succeeded = Object.values(job.fileStatuses)
      .filter((f) => f.overallStatus === "success")
      .sort((a, b) =>
        a.fileName.localeCompare(b.fileName, undefined, { numeric: true, sensitivity: "base" })
      );

    if (succeeded.length === 0) {
      return NextResponse.json({ error: "No completed files to merge yet" }, { status: 400 });
    }

    const parts: string[] = [];
    const missing: string[] = [];

    for (const f of succeeded) {
      const text = await readResult(f.fileName, f.outputPath);
      if (text === null) {
        missing.push(f.fileName);
        continue;
      }
      parts.push(`===== ${f.fileName} =====\n\n${text.trim()}`);
    }

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Result file missing on disk for: ${missing.join(", ")}` },
        { status: 404 }
      );
    }

    const merged = parts.join("\n\n\n");
    const downloadName = `merged_${jobId.slice(0, 8)}.txt`;

    return new NextResponse(merged, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${downloadName}"`,
      },
    });
  } catch (error) {
    console.error("Pipeline merge error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to merge files" },
      { status: 500 }
    );
  }
}
