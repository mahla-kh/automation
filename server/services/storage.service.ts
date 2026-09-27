import fs from "fs/promises";
import path from "path";

/** Base directory for all job outputs. */
const OUTPUTS_ROOT = path.join(process.cwd(), "outputs");

/** Resolve and validate a job directory, preventing path traversal. */
function jobDir(jobId: string): string {
    const resolved = path.resolve(OUTPUTS_ROOT, jobId);
    if (!resolved.startsWith(OUTPUTS_ROOT + path.sep) && resolved !== OUTPUTS_ROOT) {
        throw new Error(`Invalid jobId: path traversal detected`);
    }
    return resolved;
}

export async function saveNote(
    folder: string,
    file: string,
    content: string
) {
    const dir = path.join(OUTPUTS_ROOT, folder);
    await fs.mkdir(dir, { recursive: true });
    // file already has .txt extension from caller — write as-is
    await fs.writeFile(path.join(dir, file), content, "utf8");
}

export async function saveText(
    folder: string,
    file: string,
    content: string
) {
    const dir = path.join(OUTPUTS_ROOT, folder);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${file}.txt`), content, "utf8");
}

export async function saveJson(
    folder: string,
    file: string,
    content: string
) {
    const dir = path.join(OUTPUTS_ROOT, folder);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${file}.json`), content, "utf8");
}

/**
 * Save an individual NotebookLM response to:
 *   outputs/<jobId>/responses/response-<XXXX>.txt
 *
 * The index is zero-padded to 4 digits so files sort deterministically.
 */
export async function saveResponse(
    jobId: string,
    index: number,
    content: string
): Promise<string> {
    const dir = path.join(jobDir(jobId), "responses");
    await fs.mkdir(dir, { recursive: true });
    const filename = `response-${String(index + 1).padStart(4, "0")}.txt`;
    await fs.writeFile(path.join(dir, filename), content, "utf8");
    return filename;
}

/**
 * List all response files for a job, sorted by their numeric index.
 * Returns absolute paths.
 */
export async function listResponses(jobId: string): Promise<string[]> {
    const dir = path.join(jobDir(jobId), "responses");
    let entries: string[];
    try {
        entries = await fs.readdir(dir);
    } catch {
        return [];
    }
    return entries
        .filter((f) => /^response-\d+\.txt$/.test(f))
        .sort()
        .map((f) => path.join(dir, f));
}

/**
 * Merge all response files for a job into a single merged.txt file.
 * Returns the content of the merged file.
 * Writes to: outputs/<jobId>/merged.txt
 */
export async function mergeResponses(jobId: string): Promise<string> {
    const files = await listResponses(jobId);
    if (files.length === 0) {
        throw new Error(`No response files found for job ${jobId}`);
    }
    const parts = await Promise.all(files.map((f) => fs.readFile(f, "utf8")));
    const merged = parts.join("\n\n----------------------------------------\n\n");
    const outPath = path.join(jobDir(jobId), "merged.txt");
    await fs.writeFile(outPath, merged, "utf8");
    return merged;
}