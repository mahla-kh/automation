/**
 * Centralized, robust client-side file download utility.
 * Solves premature blob revocation ("File wasn't available on site")
 * and ensures full UTF-8 encoding support for Persian, Arabic, and Markdown.
 */

export interface DownloadOptions {
  filename: string;
  content: string | Blob;
  mimeType?: string;
  format?: "txt" | "md";
}

export interface DownloadResult {
  success: boolean;
  error?: string;
}

// In-flight download lock to prevent duplicate downloads from rapid repeated clicks
const activeDownloads = new Set<string>();

/**
 * Sanitizes a filename for cross-platform filesystem compatibility.
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || !filename.trim()) {
    return `download-${Date.now()}.txt`;
  }
  // Remove dangerous filesystem characters: \ / : * ? " < > |
  const cleaned = filename.replace(/[\\/:*?"<>|]+/g, "_").trim();
  return cleaned || `download-${Date.now()}.txt`;
}

/**
 * Triggers a reliable browser download for text or blob content.
 */
export async function downloadFile({
  filename,
  content,
  mimeType,
  format,
}: DownloadOptions): Promise<DownloadResult> {
  try {
    if (content === null || content === undefined) {
      return { success: false, error: "Content is required" };
    }

    if (typeof content === "string" && content.trim().length === 0) {
      return { success: false, error: "Content is empty" };
    }

    if (content instanceof Blob && content.size === 0) {
      return { success: false, error: "Content is empty" };
    }

    const safeName = sanitizeFilename(filename);

    // Prevent accidental duplicate downloads within 1.5s window
    if (activeDownloads.has(safeName)) {
      return { success: false, error: "Download already in progress" };
    }
    activeDownloads.add(safeName);
    setTimeout(() => activeDownloads.delete(safeName), 1500);

    // Determine MIME type
    const resolvedFormat = format || (safeName.endsWith(".md") ? "md" : "txt");
    const defaultMime =
      resolvedFormat === "md"
        ? "text/markdown;charset=utf-8"
        : "text/plain;charset=utf-8";
    const finalMime = mimeType || defaultMime;

    let blob: Blob;
    if (content instanceof Blob) {
      blob = content;
    } else {
      // Prepend UTF-8 BOM (\uFEFF) to guarantee correct rendering of Persian, Arabic,
      // and Unicode characters across Windows Notepad and text processors.
      const hasBom = content.charCodeAt(0) === 0xfeff;
      blob = new Blob([hasBom ? content : "\uFEFF" + content], {
        type: finalMime,
      });
    }

    // Create Object URL
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = safeName;

    // Attach to DOM, trigger native download, then remove element
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // CRITICAL FIX FOR "File wasn't available on site":
    // The browser's download manager handles the URL asynchronously.
    // Calling URL.revokeObjectURL immediately destroys the blob in memory before
    // the download manager fetches it, resulting in ERR_FILE_NOT_FOUND.
    // Retain the URL for 60 seconds before safely cleaning it up.
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignore if already revoked
      }
    }, 60000);

    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Download failed";
    console.error("downloadFile error:", errorMsg);
    return { success: false, error: errorMsg };
  }
}
