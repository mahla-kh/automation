import test, { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { downloadFile, sanitizeFilename } from "../../app/lib/download";

describe("Automation Download System Unit Tests", () => {
  let createdUrls: string[] = [];
  let revokedUrls: string[] = [];

  // Setup DOM stubs for Node.js test environment
  beforeEach(() => {
    createdUrls = [];
    revokedUrls = [];

    // Mock global URL methods
    (globalThis as any).URL.createObjectURL = (blob: any) => {
      const url = `blob:http://localhost:4000/${Math.random().toString(36).slice(2)}`;
      createdUrls.push(url);
      return url;
    };

    (globalThis as any).URL.revokeObjectURL = (url: string) => {
      revokedUrls.push(url);
    };

    // Mock DOM document and anchor
    (globalThis as any).document = {
      createElement: (tag: string) => {
        if (tag === "a") {
          return {
            style: {},
            href: "",
            download: "",
            click: () => {},
          };
        }
        return {};
      },
      body: {
        appendChild: () => {},
        removeChild: () => {},
      },
    };
  });

  afterEach(() => {
    delete (globalThis as any).document;
  });

  it("sanitizes filenames correctly for all platforms", () => {
    assert.equal(
      sanitizeFilename('test:file*name?with"quotes<and>bars|'),
      "test_file_name_with_quotes_and_bars_"
    );
    assert.match(sanitizeFilename(""), /^download-\d+\.txt$/);
    assert.match(sanitizeFilename("   "), /^download-\d+\.txt$/);
  });

  it("rejects null or undefined content", async () => {
    const res = await downloadFile({ filename: "test.txt", content: null as any });
    assert.equal(res.success, false);
    assert.match(res.error || "", /required/i);
  });

  it("rejects empty string or whitespace content", async () => {
    const res = await downloadFile({ filename: "empty.txt", content: "   " });
    assert.equal(res.success, false);
    assert.match(res.error || "", /empty/i);
    assert.equal(createdUrls.length, 0);
  });

  it("preserves Persian/Arabic Unicode content by prepending UTF-8 BOM", async () => {
    const persianContent = "پاسخ سوال ۱: آناتومی و فیزیولوژی بالینی";
    let capturedParts: any[] = [];
    let capturedOptions: any = null;

    const originalBlob = globalThis.Blob;
    (globalThis as any).Blob = function (parts: any, opts: any) {
      capturedParts = parts;
      capturedOptions = opts;
      return new originalBlob(parts, opts);
    };

    try {
      const res = await downloadFile({
        filename: "persian-answer.txt",
        content: persianContent,
        format: "txt",
      });

      assert.equal(res.success, true);
      assert.equal(capturedParts.length, 1);
      // Verify BOM character (\uFEFF)
      assert.equal(capturedParts[0].charCodeAt(0), 0xfeff);
      assert.equal(capturedParts[0].slice(1), persianContent);
      assert.equal(capturedOptions?.type, "text/plain;charset=utf-8");
    } finally {
      globalThis.Blob = originalBlob;
    }
  });

  it("preserves Markdown formatting with correct MIME type", async () => {
    const mdContent = "# گزارش نهایی آزمون\n\n- نکته ۱\n- نکته ۲\n\n```ts\nconst x = 1;\n```";
    let capturedOptions: any = null;

    const originalBlob = globalThis.Blob;
    (globalThis as any).Blob = function (parts: any, opts: any) {
      capturedOptions = opts;
      return new originalBlob(parts, opts);
    };

    try {
      const res = await downloadFile({
        filename: "report.md",
        content: mdContent,
        format: "md",
      });

      assert.equal(res.success, true);
      assert.equal(capturedOptions?.type, "text/markdown;charset=utf-8");
    } finally {
      globalThis.Blob = originalBlob;
    }
  });

  it("prevents premature URL.revokeObjectURL calls (the cause of 'File wasn\\'t available on site')", async () => {
    const res = await downloadFile({
      filename: "valid-file.txt",
      content: "Valid download text",
    });

    assert.equal(res.success, true);
    assert.equal(createdUrls.length, 1);
    // CRITICAL: URL must NOT be revoked immediately after click!
    assert.equal(
      revokedUrls.length,
      0,
      "URL was prematurely revoked! It must be deferred so browser can download."
    );
  });

  it("prevents duplicate downloads from rapid repeated clicks", async () => {
    const fileOptions = {
      filename: "duplicate-test.txt",
      content: "Sample content",
    };

    const first = await downloadFile(fileOptions);
    assert.equal(first.success, true);

    const second = await downloadFile(fileOptions);
    assert.equal(second.success, false);
    assert.match(second.error || "", /already in progress/i);
  });
});
