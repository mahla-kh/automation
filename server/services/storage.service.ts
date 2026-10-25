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
