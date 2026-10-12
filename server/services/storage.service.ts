import fs from "fs/promises";
import fsSync from "fs";
import path from "path";

/** Base directory for all job outputs. */
const OUTPUTS_ROOT = path.join(process.cwd(), "outputs");

/**
 * Sanitize a user-provided folder name so it is safe to use in the filesystem.
 * Strips invalid characters, dots, and path traversal sequences while preserving
 * human readability.
 */
export function sanitizeFolderName(name: string): string {
    if (!name || !name.trim()) {
        return "responses";
    }

    const sanitized = name
        .trim()
        .replace(/[/\\?%*:|"<>]/g, "-") // replace illegal filesystem chars / traversal slashes
        .replace(/\.+/g, "-") // replace dots (prevents ../ or ./)
        .replace(/\s+/g, "-") // replace whitespace with hyphens
        .replace(/-+/g, "-") // collapse consecutive hyphens
        .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens

    return sanitized || "responses";
}

/**
 * Resolves a collision-safe folder name under OUTPUTS_ROOT.
 * If outputs/Anatomy exists or is allocated, checks Anatomy-2, Anatomy-3, etc.
 */
export function resolveUniqueFolderName(
    rawName: string,
    isAllocatedInMemory?: (folder: string) => boolean
): string {
    const base = sanitizeFolderName(rawName);
    let candidate = base;
    let counter = 2;

    const exists = (name: string) => {
        const fullPath = path.join(OUTPUTS_ROOT, name);
        const onDisk = fsSync.existsSync(fullPath);
        const inMemory = isAllocatedInMemory ? isAllocatedInMemory(name) : false;
        return onDisk || inMemory;
    };

    while (exists(candidate)) {
        candidate = `${base}-${counter}`;
        counter++;
    }

    return candidate;
}

/** Resolve and validate a folder directory under OUTPUTS_ROOT, preventing path traversal. */
export function jobDir(folderOrJobId: string): string {
    const sanitized = sanitizeFolderName(folderOrJobId);
    const resolved = path.resolve(OUTPUTS_ROOT, sanitized);
    if (!resolved.startsWith(OUTPUTS_ROOT + path.sep) && resolved !== OUTPUTS_ROOT) {
        throw new Error(`Invalid folder name: path traversal detected`);
    }
    return resolved;
}

export async function saveNote(
    folder: string,
    file: string,
    content: string
) {
    const dir = path.join(OUTPUTS_ROOT, sanitizeFolderName(folder));
    await fs.mkdir(dir, { recursive: true });
    // file already has .txt extension from caller — write as-is
    await fs.writeFile(path.join(dir, file), content, "utf8");
}

export async function saveText(
    folder: string,
    file: string,
    content: string
) {
    const dir = path.join(OUTPUTS_ROOT, sanitizeFolderName(folder));
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${file}.txt`), content, "utf8");
}

export async function saveJson(
    folder: string,
    file: string,
    content: string
) {
    const dir = path.join(OUTPUTS_ROOT, sanitizeFolderName(folder));
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${file}.json`), content, "utf8");
}

/**
 * Build the deterministic response filename for a prompt.
 *
 * Format: `<index(4)>-<start(6)>-<end(6)>.txt`
 * Example: `0002-000100-000149.txt`
 *
 * This ensures lexicographic sort == correct prompt order.
 */
export function buildResponseFilename(index: number, start: number, end: number): string {
    return (
        String(index).padStart(4, "0") +
        "-" +
        String(start).padStart(6, "0") +
        "-" +
        String(end).padStart(6, "0") +
        ".txt"
    );
}

/**
 * Save an individual NotebookLM response to:
 *   outputs/<folderName>/<index(4)>-<start(6)>-<end(6)>.txt
 *
 * Filenames sort lexicographically in the correct prompt order (index → start → end).
 */
export async function saveResponse(
    folderOrJobId: string,
    index: number,
    start: number,
    end: number,
    content: string
): Promise<string> {
    const dir = jobDir(folderOrJobId);
    await fs.mkdir(dir, { recursive: true });
    const filename = buildResponseFilename(index, start, end);
    await fs.writeFile(path.join(dir, filename), content, "utf8");
    return filename;
}

/**
 * List all response files for a job folder, sorted by their numeric index.
 * Returns absolute paths.
 */
export async function listResponses(folderOrJobId: string): Promise<string[]> {
    const dir = jobDir(folderOrJobId);
    let entries: string[] = [];
    try {
        entries = await fs.readdir(dir);
    } catch {
        return [];
    }

    // Also check responses subdirectory for backward compatibility
    let subEntries: string[] = [];
    try {
        const subDir = path.join(dir, "responses");
        const sub = await fs.readdir(subDir);
        subEntries = sub.map((f) => path.join("responses", f));
    } catch {
        // no responses subfolder
    }

    const all = [
        ...entries
            .filter((f) => /^\d{4}-\d{6}-\d{6}\.txt$/.test(f) || /^response-\d+\.txt$/.test(f))
            .map((f) => path.join(dir, f)),
        ...subEntries
            .filter((f) => /^\d{4}-\d{6}-\d{6}\.txt$/.test(path.basename(f)) || /^response-\d+\.txt$/.test(path.basename(f)))
            .map((f) => path.join(dir, f))
    ];

    return all.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
}

/**
 * Merge all response files for a job into a single merged.txt file.
 * Returns the content of the merged file.
 * Writes to: outputs/<folderName>/merged.txt
 */
export async function mergeResponses(folderOrJobId: string): Promise<string> {
    const files = await listResponses(folderOrJobId);
    if (files.length === 0) {
        throw new Error(`No response files found for folder: ${folderOrJobId}`);
    }
    const parts = await Promise.all(files.map((f) => fs.readFile(f, "utf8")));
    const merged = parts.join("\n\n----------------------------------------\n\n");
    const outPath = path.join(jobDir(folderOrJobId), "merged.txt");
    await fs.writeFile(outPath, merged, "utf8");
    return merged;
}