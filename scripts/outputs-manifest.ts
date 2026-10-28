import fs from "fs";
import path from "path";
import crypto from "crypto";

const OUTPUTS_DIR = path.join(process.cwd(), "outputs");
const MANIFEST_FILE = path.join(process.cwd(), "docs", "migration", "outputs-manifest.json");

interface FileEntry {
  path: string;
  size: number;
  sha256: string;
}

function scanDir(dir: string, baseDir: string): FileEntry[] {
  const entries: FileEntry[] = [];
  if (!fs.existsSync(dir)) return entries;

  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      entries.push(...scanDir(fullPath, baseDir));
    } else {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
      const buffer = fs.readFileSync(fullPath);
      const hash = crypto.createHash("sha256").update(buffer).digest("hex");
      entries.push({
        path: relPath,
        size: buffer.length,
        sha256: hash,
      });
    }
  }

  return entries;
}

console.log("Generating outputs manifest from:", OUTPUTS_DIR);
const files = scanDir(OUTPUTS_DIR, OUTPUTS_DIR);
files.sort((a, b) => a.path.localeCompare(b.path));

const totalBytes = files.reduce((acc, f) => acc + f.size, 0);

const manifest = {
  generatedAt: new Date().toISOString(),
  totalFolders: fs.readdirSync(OUTPUTS_DIR).filter((f) => fs.statSync(path.join(OUTPUTS_DIR, f)).isDirectory()).length,
  totalFiles: files.length,
  totalBytes,
  files,
};

fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2), "utf8");
console.log(`Manifest created: ${files.length} files (${(totalBytes / (1024 * 1024)).toFixed(2)} MB)`);
console.log("Saved to:", MANIFEST_FILE);
