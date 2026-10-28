# Architecture Decisions (D1 - D6)

Recorded during Phase 0 preparation for the Next.js → Laravel migration.

---

### D1. Access Gate & Authentication
- **Decision:** Reverse-Proxy Access Gate (Nginx Basic Auth / IP Allowlist).
- **Rationale:** The application is an internal operator tool. It currently has zero authentication, zero users, and zero session management. Adding Laravel Sanctum / Breeze would introduce unnecessary complexity, user tables, and client login UI changes. Placing an HTTP Basic Auth gate or IP restriction at Nginx protects all endpoints (both UI and `/api/*`) with zero frontend code modification.
- **App-level fallback:** If in-app gating is ever required, an `EnsureInternalAccess` middleware validating an `X-Internal-Secret` header or token can be toggled via config.

---

### D2. Production Runtime Environment
- **Decision:** Docker Compose with PHP 8.3/8.4, Nginx, PostgreSQL 16, and Supervisor.
- **Rationale:** The existing development environment already runs PostgreSQL 16 and Adminer in Docker. Long-running queue workers (15-minute OCR tasks) and cron scheduling require a reliable process supervisor (Supervisor / systemd). Docker Compose provides identical runtime semantics across development, staging, and production on Linux or Windows WSL2.

---

### D3. Existing `outputs/` History & Archival
- **Decision:** Keep disk directory mounted as-is; no synthetic historical database backfill.
- **Rationale:** In the existing Node.js app, all job state was stored in temporary in-memory `Map` instances and discarded on process restart. Past runs only exist as text files in `outputs/` (115 folders, 420 files, 8.22 MB). Importing them into the database would require fabricating missing timestamps, metrics, and logs. Starting clean in PostgreSQL for all new jobs while preserving disk outputs on the shared volume maintains 100% parity with existing operator expectations.

---

### D4. Frontend Architecture
- **Decision:** Option C — Static Export (`output: 'export'`) served by Nginx alongside Laravel API.
- **Rationale:**
  1. The two pages (`/` and `/tohtml`) are pure client components utilizing standard `fetch` polling every 2s.
  2. Inertia or Blade rewrites would introduce high regression risk to the 1,640-line booklet editor.
  3. Serving static HTML/JS from Nginx on the same origin as `/api/*` eliminates CORS, cookies, and SSR server overhead.

---

### D5. ToHTML Prompt Source
- **Decision:** Client-submitted prompt with server-side default fallback.
- **Rationale:** In the current UI, operators can inspect and adjust the booklet generation system prompt in the browser before launching. The server saves this prompt per job in `tohtml_jobs.system_prompt`. If empty or omitted, the server falls back to `resources/prompts/tohtml-default.txt`.

---

### D6. Error Response Schema
- **Decision:** Match existing `{ "error": string }` schema exactly.
- **Rationale:** In Laravel, default API validation produces `{ "message": "...", "errors": { ... } }` with HTTP 422. The existing frontend explicitly expects HTTP 400 with `{ "error": "message" }`. Customizing FormRequest error responses to emit `{ "error": message }` ensures complete client compatibility.

---

### D7. Shared-Host Bounded Worker & Resumable Processing Architecture
- **Decision:** Step-based resumable units with atomic leases (`automation:process` Artisan command invoked via 1-minute cron).
- **Rationale:** Conventional shared hosting (cPanel/DirectAdmin/CloudLinux) prohibits root access, Supervisor, and persistent background worker daemons, terminating CLI processes running longer than 60–180 seconds. Refactoring the pipeline into discrete bounded steps (individual file downloads, Gemini OCR inference, local output persistence, and chunk-by-chunk DeepSeek synthesis) with atomic claim tokens and expiring leases allows background processing to run safely within any configured execution window (e.g. 50s) and resume seamlessly on the next cron execution without losing progress or duplicating API costs.

---

### D8. Dual Database Portability (MySQL 8.0, MariaDB & PostgreSQL 16)
- **Decision:** Support both MySQL 8.0 / MariaDB 10.x and PostgreSQL 16 using explicit Eloquent table specifications, InnoDB row-level locking, and driver-agnostic schema constructs.
- **Rationale:** While the development and Docker environments leverage PostgreSQL 16, low-cost shared hosting almost universally provides MySQL/MariaDB. Ensuring all model table definitions (`tohtml_jobs`, `tohtml_job_chunks`, `pipeline_jobs`, `pipeline_job_files`, `job_logs`) and schema migrations operate cleanly across SQLite, MySQL, and PostgreSQL allows deployment onto any standard cPanel or DirectAdmin account without breaking existing functionality.
