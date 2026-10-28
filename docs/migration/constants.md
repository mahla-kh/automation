# Migration Constants & Specifications

Extracted during Phase 0 preparation from current Node.js / Next.js implementation.

---

## 1. Retry Policies

### 1.1 General Retry (`server/retry.ts`)
- **Default Attempts:** `3`
- **Initial Delay:** `2000` ms (2.0s)
- **Backoff Factor:** `2` (exponential: 2s -> 4s -> 8s)
- **Retryable Error Matchers:**
  - `ECONNRESET`
  - `UND_ERR_SOCKET`
  - `fetch failed`
  - HTTP `429` (Rate limit)
  - HTTP `500` (Internal server error)
  - HTTP `503` (Service unavailable)

### 1.2 Gemini OCR Retry (`server/services/AI/gemini.service.ts`)
- **Default Attempts:** `5`
- **Initial Delay:** `5000` ms (5.0s)
- **Backoff Factor:** `2` (exponential: 5s -> 10s -> 20s -> 40s)
- **Retryable Errors:**
  - `ApiError` with status `429` (Quota / rate limits)
  - `ApiError` with status `500`, `503`
  - Status strings: `"RESOURCE_EXHAUSTED"`, `"UNAVAILABLE"`, `"DEADLINE_EXCEEDED"`
  - Network errors: `fetch failed`, `ECONNRESET`, `ETIMEDOUT`

---

## 2. Pacing, Timeouts & Limits

### 2.1 Gemini Files & OCR API
- **Model:** `process.env.GEMINI_MODEL` (e.g. `gemini-2.5-flash` or `gemini-1.5-flash`)
- **API Key:** `process.env.GEMINI_API_KEY`
- **Minimum Interval Between Calls (`GEMINI_MIN_INTERVAL_MS`):** `10000` ms (10.0s). Pacing is enforced globally before each stream generation call.
- **Request Timeout (`GEMINI_TIMEOUT_MS`):** `900000` ms (15 minutes).
- **Thinking Budget (`GEMINI_THINKING_BUDGET`):** Optional integer. If provided, passed as `thinkingConfig: { thinkingBudget }`.
- **Upload Polling Interval:** `2000` ms.
- **Upload Polling Max Timeout:** `120000` ms (2 minutes).
- **Generation Parameters:** `temperature: 0`.

### 2.2 DeepSeek API
- **Model:** `"deepseek-chat"`
- **Base URL:** `https://api.deepseek.com`
- **API Key:** `process.env.DEEPSEEK_API_KEY`
- **Max Tokens (`DEEPSEEK_MAX_TOKENS`):** Default `8192` (can be configured via env).
- **Generation Parameters:** `temperature: 0`.
- **Truncation Detection:** If `choice.finish_reason === "length"`, throws `"DeepSeek response truncated — increase max_tokens or reduce chunk size"`.

### 2.3 Concurrency Limits
- **Drive OCR Pipeline:** `CONCURRENCY_LIMIT = 1` file per job (managed via queue `drive-ocr` with `numprocs = 1`).
- **ToHTML Synthesis:** `CONCURRENCY_LIMIT = 2` chunks per job (managed via queue `deepseek` with `numprocs = 2`).

---

## 3. Storage & Sanitization

### 3.1 Folder Sanitization (`sanitizeFolderName`)
- Regex substitutions:
  - `[/\\?%*:|"<>.]` -> `-`
  - `\s+` -> `-`
  - `-+` -> `-` (collapse consecutive hyphens)
  - Trim leading/trailing hyphens.
- Fallback if empty: `"responses"`.
- **Unicode Support:** Does **not** strip UTF-8 / Persian characters (unlike naive sluggers).

### 3.2 Output Filename Schemes
- **Pipeline OCR Output:**
  - Directory: `outputs/<sanitized_base_filename>/`
  - Output File: `result.txt`
  - Download Attachment Name: `<sanitized_base_filename>_result.txt`
- **ToHTML Chunk Output:**
  - Directory: `outputs/<folderName>/` (e.g. `outputs/tohtml-<filename>-<counter>/`)
  - File Pattern: `buildToHtmlFilename(globalIndex, marker, chunkNumber)` -> `${String(globalIndex + 1).padStart(4, '0')}-${marker.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '')}-chunk-${chunkNumber}.txt` (e.g. `0001-CUT-1-chunk-1.txt`).
- **Pipeline Merged Output:**
  - Download Attachment Name: `merged_<jobId.slice(0, 8)>.txt`
  - Delimiter: `\n\n\n`
  - File Header: `===== <filename> =====\n\n<content>`
  - Collation: Natural alphanumeric sort using locale/ICU comparison (`numeric: true`, `sensitivity: "base"`).
- **ToHTML Merged Output:**
  - Download Attachment Name: `<baseFilename>-merged.txt`
  - Delimiter: `\n\n\n`
  - Chunk Banner: `========================================\n<label || marker>\n========================================\n\n<content>`

---

## 4. Stage & Status Semantics

### 4.1 Drive Pipeline File Processing Stages
Each file goes through 3 sequential stages:
1. `download`: Google Drive stream download to local disk.
2. `ocr`: Upload to Gemini Files, wait for `ACTIVE`, paced generateContentStream with OCR prompt.
3. `upload`: Save OCR result to local `outputs/<folder>/result.txt`.
   - On completion, sets `upload.status = "success"` **AND** `overallStatus = "success"`.
   - Readiness rule: A file is ready for download/merge when `overallStatus === "success"`.

### 4.2 ToHTML Job & Chunk Status
- Job Statuses: `queued` -> `processing` -> `completed` | `failed`.
- Chunk Statuses: `pending` -> `processing` -> `completed` | `failed`.
- Chunk Index (`sectionIndex`): In the `/api/tohtml/retry` endpoint, `sectionIndex` represents the 0-indexed position within the job's chunk array (`globalIndex`).

---

## 5. Route Error Contracts & Status Codes

All API endpoints follow a unified error response contract:
`{ "error": "<message>" }`

| Route | Method | Success Code | Error Code(s) | Error Conditions |
|---|---|---|---|---|
| `/api/pipelines/start` | POST | 200 | 400, 500 | 400: missing/invalid `folderUrl`<br>500: Drive API error |
| `/api/pipelines/status` | GET | 200 | 404 | 404: `id` not found (`"Job not found"`) |
| `/api/pipelines/download` | GET | 200 | 400, 404, 500 | 400: missing `jobId`/`fileId` or not ready<br>404: job or file not found |
| `/api/pipelines/merge` | GET | 200 | 400, 404, 500 | 400: missing `jobId` or no completed files<br>404: result missing on disk |
| `/api/tohtml/start` | POST | 200 | 400, 500 | 400: missing `fileName`, `prompt`, or empty `sections`<br>500: runner init error |
| `/api/tohtml/status` | GET | 200 | 404, 500 | 404: `Job not found: <id>` |
| `/api/tohtml/retry` | POST | 200 | 400, 404, 500 | 400: missing `jobId`, invalid `sectionIndex`<br>404: `Job not found: <id>` |
| `/api/tohtml/download` | GET | 200 | 400, 404, 500 | 400: missing `jobId`, chunk not completed<br>404: `Job not found` or file missing |
