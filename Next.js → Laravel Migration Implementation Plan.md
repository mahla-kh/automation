# Next.js → Laravel Migration Implementation Plan

WePass `automation` repo (Drive OCR pipeline + ToHTML booklet engine) · Prepared 25 Oct 2026 · Plan only: no code, files, dependencies or infrastructure were changed.

## 0. Read this first

**Evidence basis.** I worked from the audit report and the command log that precedes it. I did not have shell access to the repository in this conversation, so 'validation' means: each claim is checked against what the log shows was actually opened or searched, against the report's own internal consistency, and against Laravel/PHP facts. Anything that needs the live repo is tagged **VERIFY** and is resolved by a scripted Phase 0 (section 24). If a VERIFY comes back different, the repository wins and the affected row must be corrected before the dependent phase starts.

**Premise mismatch.** The brief describes Next.js + Prisma + PostgreSQL with users, passwords, OTP, roles, admin, courses, purchases, coupons and object storage. The audited repository has none of these: no database, no auth, no payments, no admin area, no S3/Arvan. Sections that cover them are marked N/A with the reason rather than invented. If you meant a different repository (one that really has Prisma and users), this plan does not apply to it; send that repo's audit instead.

**What the migration really is.** An internal, unauthenticated tool with two dashboards, 8 REST route handlers, and two in-process job runners that keep all state in `Map` objects. The migration is therefore: (1) give job state a database, (2) move long-running work into real queue workers, (3) keep the React UI and every API contract unchanged.

**Tags used.** BLOCKER (work cannot safely start), HIGH RISK, IMPORTANT, OPTIONAL.

## 1. Audit Validation

### 1.1 What the log proves was actually read

| Evidence level | Items |
| --- | --- |
| Read fully (high confidence) | package.json, LARAVEL\_MIGRATION\_FEASIBILITY\_REPORT.md, all 8 route handlers, pipeline.service, Pjob.service, toHtmlJob.service, toHtmlRunner.service, pipeline.worker, drive/storage/gemini/deepseek/mistral services, retry.ts, logger.ts, cutParser.ts, splitByLines.ts, ocr.prompt.ts, layout.tsx, LanguageContext, LanguageSelector, download.ts, next.config.ts |
| Read partially (medium/low) | app/page.tsx (lines 1-100), app/tohtml/page.tsx (lines 1-120 of a reported 1,640), translations.ts (1-100), globals.css, both test scripts (first 50-60 lines), README, CLAUDE.md |
| Never opened | AGENTS.md, the other five prompt files, tsconfig, eslint and postcss configs, .gitignore, any file inside outputs/ |
| Searches run | prisma, postgres, docker, clean\_JSON, cleanupOCR, clean\_ParseQuestions, validateQuestions, MistralOCR |
| Searches NOT run (but the report asserts conclusions about them) | `use server`, auth/session/cookie/token, middleware or Next 16 `proxy.ts`, cron/schedule, webhook, setInterval, localStorage, full `process.env` usage, `fetch(` call sites in the pages |

### 1.2 Verdict summary

The structural findings (no DB, no Prisma, 8 API routes, in-memory Maps, two pipelines, local disk output) are well supported by the log. The report is weaker on: UI details (based on partial reads), server-side behaviors it never quantified (response shapes, retry parameters, log caps), and several Laravel recommendations that are technically wrong or heavier than needed (section 2).

## 2. Corrections to the Audit

| # | Audit claim | Actual repository state / evidence | Status | Impact on migration |
| --- | --- | --- | --- | --- |
| 1 | No Prisma, no PostgreSQL, no DB | Searches for prisma/postgres ran; package.json read; no schema dir in the tree | CONFIRMED | Prisma→Eloquent mapping is N/A. Schema is net-new. Re-run `git grep -il prisma` and check package-lock as a cheap double check |
| 2 | No auth, sessions, RBAC, admin, payments | Inferred from route files and tree. No grep for auth/session/middleware/`proxy.ts` is in the log. Next 16 renamed middleware to `proxy.ts` | PARTIALLY CONFIRMED | If a `proxy.ts` or header check exists it must be ported. Phase 0 grep |
| 3 | Zero Server Actions | No `use server` search in the log; structure (route handlers only) supports it | PARTIALLY CONFIRMED | Section 11 is N/A unless Phase 0 finds one |
| 4 | 8 API routes | 8 route.ts files viewed | CONFIRMED | Full route table in section 9 |
| 5 | State lives only in `Map` objects | Pjob.service and toHtmlJob.service read | CONFIRMED | Persisting state is a deliberate behavior change; it introduces new failure modes (stuck rows) handled in section 15 |
| 6 | Laravel `queue:work --concurrency=N` | **INCORRECT.** `queue:work` has no concurrency flag (that is Horizon/Sidekiq vocabulary) | INCORRECT | Concurrency = number of worker processes on a named queue (Supervisor `numprocs`) |
| 7 | Pace Gemini with `$this->release(10)` | **INCORRECT for this workload.** `release()` re-queues the whole job; `handle()` restarts from the top and would re-download the PDF | INCORRECT | Use an in-process paced call (cache lock + last-call timestamp) inside one job, like the Node `sleep` does |
| 8 | Redis queue is part of the required stack | Not required: concurrency is 1 and 2, jobs last minutes, one host | OUTDATED / over-scoped | Database queue + database cache locks. Revisit only if multi-host or high throughput |
| 9 | `Laravel 11.x`, `openai-php/client ^0.10`, `google/apiclient ^2.15` | Version pins written from memory; Laravel has newer majors by Oct 2026 | OUTDATED | Pin whatever is current stable at kickoff via `composer create-project`; do not copy these numbers |
| 10 | cutParser must be reimplemented in PHP (High priority) | Parsing runs in the browser; the server receives already-parsed `sections` in the start payload | INCORRECT (priority) | cutParser stays TypeScript in the frontend. PHP port is OPTIONAL (server-side revalidation only) |
| 11 | splitByLines is client-only | Report also says `start` splits oversized sections on the server | PARTIALLY CONFIRMED | PHP `LineSplitter` is REQUIRED and must be byte-for-byte compatible with the TS version used for the client preview |
| 12 | Downloads lack UTF-8 BOM (LOW) | Same report says `download.ts` injects the BOM client-side | INTERNALLY INCONSISTENT | With the React UI retained, BOM stays client-side and the server stays BOM-free. Add server BOM only if a Blade/direct-link path is introduced |
| 13 | Path traversal risk MEDIUM | Current code already sanitizes names and guards with a prefix check. The risk is in a careless port, not the current app. The guard reportedly references a Windows absolute root | PARTIALLY CONFIRMED | VERIFY the root is computed, not hard-coded. PHP version must use `realpath` on both sides |
| 14 | `p-limit` phantom dependency crashes prod with `--omit=dev` | `npm list p-limit` ran; whether it breaks depends on install hoisting | PARTIALLY CONFIRMED | Irrelevant after cutover; fix only if the old app must run in parallel |
| 15 | Pipeline concurrency is 1 | Unknown whether the limiter is module-global or created per job. The 10 s Gemini pacing is described as global | VERIFY | Decides queue topology: global concurrency 1 = one worker process on `drive-ocr` |
| 16 | Download is allowed when `upload.status === success`; merge uses `overallStatus === success` | Two different readiness rules for the same file | VERIFY (possible latent bug) | Decide consciously: replicate or fix; define stage semantics in the enum docs |
| 17 | ToHTML start validates a client-supplied `prompt`; deepseek service injects `DEFAULT_PROMPT` | Two sources of the system prompt | VERIFY | Decides whether the prompt is a DB column (per job) or a file. Also a security issue: unauthenticated clients choose the system prompt |
| 18 | UI facts: 1,640-line page, 2 s polling, localStorage keys, 6 KPI cards | Only the first 100-120 lines of each page were read | UNVERIFIED by log | Treat as hints. The contract is captured as HTTP fixtures in Phase 0 |
| 19 | Env table lists 11 variables | `.env` has about 19 lines; `OPENROUTER_API_KEY` usage not shown anywhere in code | VERIFY | Unused vars are REMOVED. `.env` was opened during the audit, so treat its secrets as exposed and rotate them for the new system |
| 20 | Copy `outputs/` (107 folders) as-is | The log lists a folder literally named `tohtml-%D8%AE...` (percent-encoded Persian) | VERIFY | Either a display artifact or real names. Affects Linux copy, the sanitizer regex, and path checks |
| 21 | `gemini-3.5-flash-lite`, DeepSeek `max_tokens` 16384 | Model names and limits are config values I cannot verify | UNKNOWN | Keep them in `.env`/config, never hard-coded |
| 22 | (omitted) API response shapes, error body shape, status enums | `JobDetailsResponse` and error JSON are not documented | MISSING | BLOCKER for exact-compat: capture fixtures in Phase 0 |
| 23 | (omitted) retry.ts parameters, log array cap, route `maxDuration`/runtime exports | Read in the log but never summarized | MISSING | Extract constants into `config/automation.php` in Phase 0 |
| 24 | (omitted) request body size | ToHTML start posts whole booklets; PHP defaults (`post_max_size` 8M) are far lower than Next's | MISSING | HIGH RISK silent 413s. Measure real payloads; raise PHP and Nginx limits |
| 25 | (omitted) Windows vs Linux | Dev machine is Windows (`d:\` paths, PowerShell). Production target is unknown | MISSING | Case sensitivity, separators, and Unicode normalization of Persian filenames become real. Production host is BLOCKER D2 |
| 26 | (omitted) `intl` dependency | Merge sorting uses `localeCompare` with numeric collation (ICU) | MISSING | PHP needs `ext-intl` `Collator`; plain `sort()` or `strnatcmp` will order Persian names differently |

## 3. Current Architecture Summary and Migration Inventory

### 3.1 Summary

- Frontend: Next.js 16 App Router, React 19, Tailwind 4. Two pure client pages (`/`, `/tohtml`) polling status every \~2 s. Persian default (RTL) with English toggle; theme and language in localStorage.
- Backend: 8 Next route handlers. Work is launched with `void runJob(...)` (floating promises) in the same Node process.
- Pipeline A (Drive OCR): folder URL → Drive list (service account) → per file: download to `temp/` → upload to Gemini Files → poll until ACTIVE → paced `generateContent` (stream, temp 0) → write result text to `outputs/<folder>/` → delete remote file and temp PDF.
- Pipeline B (ToHTML): parsed `CUT n` sections → server splits to ≤600-line chunks → DeepSeek chat per chunk (concurrency 2, system prompt + chunk, `max_tokens` 16384, `finish_reason=length` = failure) → `outputs/tohtml-<name>-N/<index4>-<marker>-chunk-<n>.txt`. Per-section retry.
- State: process memory only. Files on disk are the only durable artifact.

### 3.2 Inventory (KEEP / REWRITE / ADAPT / REPLACE / REMOVE / VERIFY)

| Current item | Class | Target / note |
| --- | --- | --- |
| app/api/pipelines/{start,status,download,merge}/route.ts | REWRITE | PipelineController |
| app/api/tohtml/{start,status,retry,download}/route.ts | REWRITE | ToHtmlController |
| Pjob.service.ts, toHtmlJob.service.ts (in-memory Maps) | REPLACE | Eloquent models + tables |
| pipeline.service.ts | REWRITE | PipelineService + queued job dispatch |
| pipeline.worker.ts (3-stage worker) | REPLACE | ProcessDriveFileJob |
| toHtmlRunner.service.ts | REPLACE | ProcessToHtmlChunkJob |
| drive.service.ts | ADAPT | GoogleDriveService behind a DriveGateway interface |
| gemini.service.ts | ADAPT | Same protocol and rules, HTTP instead of SDK |
| deepseek.service.ts (active function only) | ADAPT | DeepSeekClient |
| storage.service.ts | ADAPT | OutputStorage (Unicode-aware sanitizer, realpath guard) |
| retry.ts | ADAPT | RetryPolicy (same attempts/backoff constants) |
| logger.ts | REPLACE | JobLogger writing `job_logs` + Laravel Log |
| splitByLines.ts | KEEP (TS) + REWRITE (PHP) | Parity-tested pair |
| cutParser.ts | KEEP | Moves to `frontend/`; PHP port OPTIONAL |
| ocr.prompt.ts, DeepSeek DEFAULT\_PROMPT | ADAPT | Plain text files in `resources/prompts/`, byte-identical |
| JSONparser, clean\_JSON, cleanup, JOSVE\_clean, validator prompts | REMOVE | Dead; remain in git history |
| mistral.service.ts, deepseek standby functions (cleanupOCR, clean\_ParseQuestions, clean\_ParseJOSVE, validateQuestions) | REMOVE | Zero callers |
| scripts/google-drive-oauth.ts, next.config `serverExternalPackages` (pdfjs-dist, @napi-rs/canvas), `p-limit` | REMOVE | Dead or phantom |
| app/page.tsx, app/tohtml/page.tsx, LanguageContext, translations, LanguageSelector, download.ts, globals.css | KEEP | Unchanged in behavior (export mode, section 13) |
| app/layout.tsx | KEEP / ADAPT | `next/font/google` works in static export; verify at build |
| types/drive.ts | VERIFY | Keep only if the client imports it |
| scripts/test-cutParser.ts, test-tohtml-flow.ts | KEEP + ADAPT | Keep TS tests for the client parser; port cases to PHPUnit for the splitter |
| outputs/ (107 folders) | KEEP (data) | Copied, checksummed (section 20) |
| temp/ | REMOVE | Recreated empty at runtime |
| .env | REPLACE | New `.env`, rotated secrets |
| OPENROUTER\_API\_KEY | VERIFY → REMOVE | Unused unless Phase 0 finds a caller |
| Next middleware / `proxy.ts` | VERIFY | Expected: none |

## 4. Target Architecture

### 4.1 Options compared

| Criterion | A. Laravel + Blade | B. Laravel + Inertia + React | C. Laravel API + existing React UI (static) | D. Laravel + Livewire |
| --- | --- | --- | --- | --- |
| Migration complexity | High (rewrite two big pages) | Medium-High (convert pages to Inertia props/routing) | **Low** | High |
| Existing UI/UX preserved | No (re-created) | Mostly | **Fully** | No |
| SEO | Irrelevant (internal tool) | Irrelevant | Irrelevant | Irrelevant |
| Auth | Built-in | Built-in | None needed today; gate at Nginx or middleware | Built-in |
| Polling/live status | Needs Alpine/Livewire polling | Same as now | **Same as now** | Livewire polling |
| Background jobs, files | Same for all options | Same | Same | Same |
| Regression risk | High | Medium | **Low** | High |
| Deployment | One app | One app + Node build | Static files + PHP-FPM, one Nginx | One app |
| Long-term | Fine | Fine | Fine; UI can move to Vite later without touching the API | Fine |

### 4.2 Decision: Option C, same-origin

Laravel is a headless API; the existing React app is built once as a static export and served by Nginx from the same origin as `/api/*`. Reasons that are specific to this repo:

1. Both pages are already pure client components that only call `fetch` and poll. Inertia would add nothing (no SSR, SEO or server-driven auth) while forcing changes into a 1,640-line file.
2. Keeping every `/api/pipelines/*` and `/api/tohtml/*` path and response shape identical means the frontend needs zero fetch changes.
3. Same origin means no CORS, no cookies, no CSRF. The API is stateless.
4. The valuable change is entirely server-side (persistence + queues), so that is where effort should go.

Costs accepted: Next.js remains a build-time tool for the frontend (acceptable; replacing it with Vite is OPTIONAL and out of scope). The Next `app/api` folder must be removed from the frontend build because route handlers conflict with `output: 'export'`.

### 4.3 Stack

PHP 8.3+ (8.4 acceptable), current stable Laravel, PostgreSQL, Nginx + PHP-FPM, queue driver `database`, cache driver `database` (for locks), Supervisor-managed `queue:work`. **No Redis, no Sanctum, no Breeze, no Spatie, no Horizon** (no concrete need).

## 5. Target Project Structure

```text
automation/                      (existing repo; history preserved)
├── frontend/                    MOVED Next app (app/, public/, config files), static export
│   └── src-lib/ or lib/         cutParser.ts, splitByLines.ts moved here from server/lib
├── backend/                     NEW Laravel app
│   ├── app/
│   │   ├── Console/Commands/    ReconcileStuckWork, CleanupTemp (OPTIONAL), ImportArchivedOutputs (OPTIONAL)
│   │   ├── Enums/               JobStatus, StageStatus, ChunkStatus, LogLevel
│   │   ├── Exceptions/          UpstreamApiException, DocumentTooLargeException, TruncatedOutputException
│   │   ├── Http/Controllers/    PipelineController, ToHtmlController
│   │   ├── Http/Middleware/     EnsureInternalAccess (only if decision D1 = app-level gate)
│   │   ├── Http/Requests/       StartPipelineRequest, StartToHtmlRequest, RetryToHtmlRequest, StatusRequest, Download*/Merge* requests
│   │   ├── Http/Resources/      PipelineJob{Summary,Details}Resource, ToHtmlJob{Summary,Details}Resource
│   │   ├── Jobs/                ProcessDriveFileJob, ProcessToHtmlChunkJob
│   │   ├── Models/              PipelineJob, PipelineJobFile, ToHtmlJob, ToHtmlJobChunk, JobLog
│   │   ├── Services/
│   │   │   ├── Pipeline/PipelineService.php, ToHtml/ToHtmlService.php
│   │   │   ├── Drive/DriveGateway.php (interface), GoogleDriveService.php
│   │   │   ├── Ai/GeminiClient.php, GeminiPacer.php, DeepSeekClient.php, PromptRepository.php
│   │   │   ├── Storage/OutputStorage.php
│   │   │   └── Support/RetryPolicy.php, JobLogger.php, LineSplitter.php, FolderUrlParser.php, NaturalSorter.php
│   ├── config/automation.php    all tunables: pacing, timeouts, retries, chunk size, concurrency notes
│   ├── config/services.php      google / gemini / deepseek credentials
│   ├── database/migrations/     5 domain migrations (+ jobs, failed_jobs, cache tables)
│   ├── resources/prompts/       ocr.txt, tohtml-default.txt (byte-identical to current)
│   ├── routes/api.php, routes/console.php (scheduled commands)
│   └── tests/{Unit,Feature,Integration,Fixtures}/
├── deploy/                      Dockerfile, nginx.conf, supervisord.conf, compose.yml, compose.dev.yml
├── docs/migration/contracts/    recorded JSON fixtures of every old API response
└── outputs/                     data, mounted as storage/app/outputs in containers
```

| Directory | Why it exists | What moves in | Removed or replaced |
| --- | --- | --- | --- |
| backend/app/Services | Domain logic out of controllers and jobs | drive, gemini, deepseek, storage, retry, logger, splitter logic | server/services/\*, server/lib/logger.ts, server/retry.ts |
| backend/app/Jobs | Queue workers replace floating promises | pipeline.worker.ts, toHtmlRunner.service.ts | `void runJob(...)` call sites |
| backend/app/Http | Thin HTTP layer preserving contracts | 8 route handlers | frontend/app/api/\* (after cutover) |
| backend/app/Models + migrations | Durable state | Map structures | in-memory Maps |
| backend/resources/prompts | Prompts as files, not escaped PHP strings | ocr.prompt.ts, DEFAULT\_PROMPT | server/prompts/\* (5 dead files dropped) |
| frontend/ | Isolated UI build | app/, public/, Tailwind/PostCSS/TS config | server/, scripts/google-drive-oauth.ts |
| deploy/ | Reproducible runtime | none (new) | none |
| docs/migration/contracts | Executable definition of 'unchanged API' | Phase 0 recordings | none |

Default Laravel scaffolding to delete on day one: `User` model/factory, users/sessions/password\_reset migrations, `welcome` view, web auth routes. They would create unused tables and an apparent auth surface.

## 6. Database Migration Plan

### 6.1 Strategy

**Strategy B (new schema).** Strategy A is impossible (no existing database), and C is pointless (no data to carry). The only historical data is files in `outputs/`, handled in section 20. Prisma-to-Eloquent mapping is therefore N/A; the table below maps the in-memory structures instead.

| Current structure | Table | Laravel model | Migration | Data transformation |
| --- | --- | --- | --- | --- |
| `Map<string, PipelineJob>` (job header) | `pipeline_jobs` | PipelineJob | New | None (no history) |
| `PipelineJob.files[]` with download/upload/ocr stage state | `pipeline_job_files` | PipelineJobFile | New | None |
| `Map<string, ToHtmlJob>` header | `tohtml_jobs` | ToHtmlJob | New | None |
| `ToHtmlJob.chunks[]` | `tohtml_job_chunks` | ToHtmlJobChunk | New | None |
| `logs[]` arrays | `job_logs` | JobLog | New | None |
| (none; Laravel infrastructure) | `jobs`, `failed_jobs`, `cache`, `cache_locks` | n/a | Framework migrations | Delete default `users`, `sessions`, `password_reset_tokens` |

### 6.2 Conventions

- Primary keys: UUID (`HasUuids`) for jobs, files and chunks, so existing client code that treats `jobId` as a string is unaffected. `job_logs` uses bigint identity (ordering and cursoring).
- Status columns: `varchar` + PHP backed enums + `CHECK` constraints. Avoid native PG enum types (hard to alter).
- Timestamps: `timestampTz`; log rows use millisecond precision.
- JSON: only if a VERIFY shows free-form per-job data; default is no JSON columns.
- Soft deletes: none (nothing is user-deletable). Cascades: `ON DELETE CASCADE` from job to files, chunks and logs. Output files on disk are never deleted by cascade.
- Aggregates (completed/failed/avg duration/success rate) are computed by queries or resource accessors, never stored, so they cannot drift.

### 6.3 Table definitions

**pipeline\_jobs**: `id uuid PK`; `folder_id varchar(128)` indexed; `folder_url text`; `output_folder varchar(255)` (sanitized directory name; VERIFY it exists on the current object); `status varchar(16)` default `queued` (queued, processing, completed, failed); `total_files int`; `error_message text null`; `started_at`, `completed_at` null; `created_at`, `updated_at`. Indexes: `(status)`, `(created_at desc)`.

**pipeline\_job\_files**: `id uuid PK`; `pipeline_job_id uuid FK cascade`; `drive_file_id varchar(128)`; `file_name varchar(512)`; `position int` (Drive listing order); `download_status`, `upload_status`, `ocr_status varchar(16)` default `pending` (pending, in\_progress, success, error); `overall_status varchar(16)` default `pending`; `error_stage varchar(16) null`; `error_message text null`; `output_filename varchar(512) null`; `output_path varchar(1024) null` (relative to the outputs disk); `download_ms`, `upload_ms`, `ocr_ms int null`; `started_at`, `completed_at`, `heartbeat_at null`. Constraints: `UNIQUE (pipeline_job_id, drive_file_id)`. Indexes: `(pipeline_job_id, overall_status)`.

**tohtml\_jobs**: `id uuid PK`; `file_name varchar(512)`; `output_dir varchar(512) UNIQUE` (relative, e.g. `tohtml-<name>-2`); `system_prompt text null` (only if the client-supplied prompt is truly used, see correction 17); `max_lines_per_chunk int default 600`; `total_sections int`; `total_chunks int`; `status varchar(16)`; `created_at`, `started_at`, `completed_at`, `updated_at`.

**tohtml\_job\_chunks**: `id uuid PK`; `tohtml_job_id uuid FK cascade`; `global_index int`; `section_index int`; `chunk_index int`; `chunk_number int`; `chunks_in_section int`; `marker varchar(64)`; `marker_number int null`; `label varchar(255)`; `content text`; `char_count int`; `line_count int`; `status varchar(16)` (pending, processing, completed, failed); `attempt_count smallint default 0`; `output_filename varchar(512) null`; `duration_ms int null`; `error_message text null`; `started_at`, `completed_at`, `heartbeat_at null`. Constraints: `UNIQUE (tohtml_job_id, global_index)`. Index: `(tohtml_job_id, status)`. VERIFY whether the API's `sectionIndex` means chunk position (assumed `global_index`) or the CUT section; the schema carries both.

**job\_logs**: `id bigint identity PK`; `pipeline_job_id uuid null FK cascade`; `tohtml_job_id uuid null FK cascade`; `CHECK` exactly one of the two FKs is non-null (replaces the report's FK-less polymorphic design, which could orphan rows); `level varchar(8)`; `stage varchar(32) null`; `file_id varchar(128) null`; `file_name varchar(512) null`; `section_index int null`; `message text`; `error text null`; `created_at timestamptz(3)`. Indexes: `(pipeline_job_id, id)`, `(tohtml_job_id, id)`. Status endpoints return the last N rows (N from the old in-memory cap; VERIFY). OPTIONAL: prune rows older than 90 days.

### 6.4 Prisma → Eloquent equivalents used here

| Concept | Eloquent approach |
| --- | --- |
| Model definition | `$fillable`/guarded, `casts()` with enum classes and datetime |
| Relations | `hasMany` / `belongsTo` with `ordered` scopes (`position`, `global_index`) |
| Transactions | `DB::transaction()` when creating a job with its files/chunks |
| Atomic state transitions | `update ... where status = 'failed'` and check affected rows (no read-modify-write) |
| Finalizing a job | Run inside a transaction with `lockForUpdate()` on the job row, then count remaining non-terminal children |
| Computed metrics | Query scopes plus resource accessors |

## 7. Authentication Migration

**Current state:** none (CONFIRMED by structure; Phase 0 greps for `proxy.ts`, `middleware.ts`, `Authorization`, `cookies(`). Registration, login, logout, password hashing, OTP, email verification, password reset, sessions, cookies, tokens and account restrictions **do not exist, so there is nothing to migrate**. There are no existing users, hence no password-hash compatibility problem.

However the audit correctly flags the real exposure: anyone who can reach the host can start Drive/Gemini/DeepSeek jobs that cost money, and can supply their own system prompt to DeepSeek.

```text
CURRENT                       TARGET
no auth (open endpoints)  -->  same behavior by default (zero UX change)
                              + access gate chosen in decision D1:
                                (a) Nginx basic auth or IP allowlist   [recommended, zero code]
                                (b) EnsureInternalAccess middleware    [only if gate must live in the app]
                              + throttle middleware on the start endpoints
                              + body size limits
```

| Item | Plan | Tag |
| --- | --- | --- |
| Access gate | (a) at Nginx for `/` and `/api/` (same origin, so the browser prompts once). (b) middleware reading a shared secret from env, constant-time compare; the static UI would need a header injection, so (a) is simpler | IMPORTANT (D1) |
| Rate limits | `throttle:10,1` on `POST /api/pipelines/start`, `POST /api/tohtml/start`, `POST /api/tohtml/retry` (config-driven). Status polling (every 2 s) is exempt from throttling | IMPORTANT |
| Guest/anonymous | Entire app stays guest-accessible if D1 is (a) with a shared credential | n/a |
| Users, models, guards, policies, Breeze/Sanctum | Not created | REMOVE default scaffolding |
| Sessions, cookies, CSRF | API group is stateless. Do not enable `web` middleware for these routes | n/a |

## 8. Authorization / RBAC

The audit's permission matrix is accurate: every capability is open to everyone, and 'Admin' does not exist. Preserve that: **no roles, no policies, no permission tables**. Authorization equals the D1 access gate. If a future requirement introduces operators vs admins, add them then; adding Spatie or policies now would be invented infrastructure.

Server-side authority: the access gate is enforced by Nginx or middleware, never by the frontend. The `System Configuration / API Keys` row in the audit matrix is N/A because keys live only in server env and are never exposed by any endpoint (Phase 0: confirm no route echoes env values).

## 9. Route Migration

Pages become static files; APIs keep identical paths and verbs. Laravel's `routes/api.php` prefix is `/api`, so the paths match with no frontend change.

| Current route | Current behavior | Laravel route | Controller@method | Middleware | Method | Behavior change |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | Client page: Drive OCR dashboard | Nginx static `index.html` | none | Nginx gate (D1) | GET | None |
| `/tohtml` | Client page: ToHTML dashboard | Nginx static `tohtml.html` or `tohtml/index.html` (depends on export `trailingSlash`) | none | Nginx gate | GET | Verify the exact URL form the UI uses for in-app links |
| `/api/pipelines/start` | Extract folder id, list PDFs, create job, launch runner, return ids | `/api/pipelines/start` | PipelineController@start | throttle | POST | Job is persisted and queued |
| `/api/pipelines/status` | `?id=` optional: list summaries or one job's details | same | PipelineController@status | none | GET | Unknown id still 404; list now survives restarts |
| `/api/pipelines/download` | `?jobId&fileId` text stream, attachment | same | PipelineController@download | none | GET | Same headers; path guard via realpath |
| `/api/pipelines/merge` | `?jobId` concatenates successful outputs | same | PipelineController@merge | none | GET | Natural sort via ICU Collator |
| `/api/tohtml/start` | Validate, create dir, chunk, launch runner | same | ToHtmlController@start | throttle | POST | Body-size limits raised; persisted and queued |
| `/api/tohtml/status` | `?id=` optional | same | ToHtmlController@status | none | GET | Same |
| `/api/tohtml/retry` | Reset failed chunk(s) to pending and relaunch | same | ToHtmlController@retry | throttle | POST | Atomic transition |
| `/api/tohtml/download` | Single chunk or `merged=true` | same | ToHtmlController@download | none | GET | Same |
| (new) `/up` | none | framework health route | built-in | none | GET | Used by container healthchecks |

No webhooks, cron endpoints, upload routes, dynamic page routes, auth routes, user routes, admin routes or super-admin routes exist.

## 10. API Migration

Flow for every endpoint: `routes/api.php -> FormRequest -> Controller -> Service -> Model -> Resource`. **Contract rule:** the JSON bodies, status codes, header names and error shapes of the old app are recorded in Phase 0 and the Laravel responses must match them field for field. Laravel's default validation error (HTTP 422 with `errors`) is overridden in each FormRequest `failedValidation` to emit the old status code and error body (expected: 400 with a message; VERIFY from fixtures).

| Endpoint | Auth | Validation (FormRequest) | Service call | Response | Errors | Transaction |
| --- | --- | --- | --- | --- | --- | --- |
| POST `/api/pipelines/start` | gate | `folderUrl` required string; must match the Drive folder pattern (`folders/` followed by letters, digits, underscore or hyphen; confirm the exact length rule in code) | `PipelineService::start`: parse id, list PDFs via `DriveGateway` (synchronous, as today), create job + file rows, dispatch jobs after commit | `{success, jobId, totalFiles}` | 400 invalid/missing URL; 500 Drive failure (log upstream detail, return the old message shape) | One `DB::transaction` for job + files. Dispatch with `afterCommit` so a worker never sees missing rows |
| GET `/api/pipelines/status` | gate | `id` optional uuid | `PipelineService::summaries()` / `details($id)` | list of summaries or details (`progress`, per-file stages, `avgOcrDurationMs`, `ocrSuccessRate`, logs) | 404 unknown id | read only |
| GET `/api/pipelines/download` | gate | `jobId`, `fileId` required | `OutputStorage::resolveForRead` | text/plain stream, attachment + UTF-8 filename (ASCII fallback plus `filename*`) | 400 not ready (apply the rule decided in correction 16), 404 missing | read only |
| GET `/api/pipelines/merge` | gate | `jobId` required | `PipelineService::merge` | text/plain, `merged_<jobId first 8>.txt`, parts joined by `===== <filename> =====` + blank line | 400 none succeeded, 404 file missing on disk | read only |
| POST `/api/tohtml/start` | gate | `fileName` string, `prompt` string (see correction 17), `sections` array min 1 with `marker`, `markerNumber`, `content`, `charCount`; `maxLinesPerChunk` int min 1 default 600 | `ToHtmlService::start`: collision-safe output dir, `LineSplitter`, create job + chunks, dispatch chunk jobs after commit | `{success, jobId, totalChunks, totalSections, fileName}` | 400 validation | One transaction for job + chunks; directory creation is race-safe through the unique `output_dir`, and a failed mkdir marks the job failed |
| GET `/api/tohtml/status` | gate | `id` optional | `ToHtmlService` | per-chunk detail, metrics, logs | 404 | read only |
| POST `/api/tohtml/retry` | gate | `jobId` required; `sectionIndex` optional int | `ToHtmlService::retry` | `{success, jobId, sectionIndex}` | 404 job; 400 nothing retryable (VERIFY old behavior) | One transaction: atomic `failed -> pending`, job back to processing, dispatch after commit |
| GET `/api/tohtml/download` | gate | `jobId` + (`sectionIndex` or `merged=true`) | `ToHtmlService::download` | text/plain attachment, banners between merged chunks | 400/404 | read only |

Resources (`JsonResource`) hold all computed fields so controllers contain no arithmetic. Large downloads use `response()->download()` or `streamDownload()`, never `file_get_contents` into memory.

## 11. Server Action Migration

No Server Actions exist (structure supports it; the `use server` grep was not in the log, so Phase 0 re-runs it). The nearest analogs are the two `void run...()` floating promises, which become queued Jobs (section 12). If the Phase 0 grep finds any action, add a row here.

| Server Action | Caller | Purpose | Laravel replacement | Dependencies |
| --- | --- | --- | --- | --- |
| (none expected) | n/a | n/a | n/a | n/a |

## 12. Business Logic Migration

Each process is redesigned around Laravel (service + job + model), not translated line by line.

### 12.1 Drive OCR pipeline

```text
POST start -> StartPipelineRequest -> PipelineController -> PipelineService
   -> FolderUrlParser -> DriveGateway::listPdfs (sync)
   -> DB::transaction( PipelineJob + PipelineJobFile[] )
   -> after commit: one ProcessDriveFileJob per file on queue 'drive-ocr'

ProcessDriveFileJob::handle (one file, one job):
   mark in_progress, heartbeat
   1 download   DriveGateway::download -> storage/app/temp/<fileId>.pdf   (stream to disk)
   2 upload     GeminiClient::uploadFile (streams from disk) ; poll ACTIVE (120 s cap)
   3 ocr        GeminiPacer::wait() ; GeminiClient::generate(ocr prompt, temp 0, stream)
                finishReason MAX_TOKENS -> DocumentTooLargeException
   4 save       OutputStorage::writeResult (temp name, then atomic rename)
   finally      GeminiClient::deleteFile ; unlink temp PDF ; finalize job (lockForUpdate + count)
```

Design rules:

- **One job per file**, with stage columns updated as it goes. Whole-file retry is simple and cheap to reason about.
- `public $tries = 1`; transient-error retries live inside the job via `RetryPolicy` using the exact attempts/backoff constants from `retry.ts` (extracted in Phase 0). Reason: if Laravel redelivered a timed-out job, it would repeat an expensive Gemini call and double-bill.
- `public $timeout` must exceed the worst case: Gemini request timeout (reported default 900 s) + upload + 120 s ACTIVE polling + pacing. Use 1500 s as a starting config value. The queue connection `retry_after` must be **greater than** the job timeout (e.g. 1800 s) or the database queue will hand the same job to a second worker mid-run. This is the most common cause of duplicate runs and is explicitly tested.
- Pacing: `GeminiPacer` takes `Cache::lock('gemini-pace')`, reads `last_call_at`, sleeps the remainder of `GEMINI_MIN_INTERVAL_MS` (default 10 000), stamps the time, releases. Which calls count toward pacing is taken from gemini.service.ts (VERIFY lines around 100).
- The `finally` cleanup must survive exceptions; a hard-killed worker is covered by the reconcile command (section 15).
- Job finalization runs under a row lock so two workers cannot both finish, or neither finish, the same job.

### 12.2 ToHTML synthesis

```text
POST start -> StartToHtmlRequest -> ToHtmlController -> ToHtmlService
   -> OutputStorage::reserveDir('tohtml-<sanitized name>-N')  (race-safe via unique output_dir)
   -> LineSplitter (sections > maxLines -> numbered chunks)
   -> DB::transaction( ToHtmlJob + ToHtmlJobChunk[] )
   -> after commit: ProcessToHtmlChunkJob per chunk on queue 'deepseek'

ProcessToHtmlChunkJob::handle:
   atomic pending->processing ; heartbeat
   DeepSeekClient::complete(system prompt, chunk text, max_tokens, temp 0)
   finish_reason == length -> TruncatedOutputException (chunk failed, message preserved)
   OutputStorage::writeChunk('<index4>-<marker>-chunk-<n>.txt')  (temp name + rename)
   mark completed with duration_ms ; finalize job
```

- Concurrency 2 = two worker processes on `deepseek` (`numprocs=2`). If the current `CONCURRENCY_LIMIT=2` is per job rather than global, this is stricter than before (VERIFY, correction 15) and is acceptable.
- Chunk file names must match exactly (4-digit zero-padded index, marker with spaces turned into hyphens, e.g. `0001-CUT-1-chunk-1.txt`). The marker sanitizer is copied from the current code; a golden test fixes it.
- Retry: the endpoint flips `failed -> pending` atomically and re-dispatches only those chunks. A chunk job's `failed()` hook persists the error and finalizes.

### 12.3 Other logic

| Process | Laravel home | Note |
| --- | --- | --- |
| Folder URL parsing | `FolderUrlParser` | Same pattern as the Node code; unit tests with valid, invalid, and trailing-parameter URLs |
| Output folder and file name sanitizing | `OutputStorage::sanitize` | Must be Unicode-aware (letter and number classes with the `u` flag) to keep Persian names. **Never use `Str::slug`**: it transliterates and drops Persian text |
| Natural sort for merge | `NaturalSorter` using `ext-intl` `Collator` with numeric collation | Golden test with real filenames from `outputs/` |
| Metrics (success rate, avg duration) | Resource accessors | Same formulas as `status/route.ts` |
| Logging | `JobLogger` | Writes `job_logs` and mirrors to the Laravel log; messages preserved verbatim where the UI displays them |
| Prompt loading | `PromptRepository` | Reads `resources/prompts/*.txt`; no regeneration of content |

## 13. Frontend Migration

| Page / file | Class | Change |
| --- | --- | --- |
| `app/page.tsx` (Drive dashboard) | KEEP | No fetch changes (same paths). Poll interval and localStorage keys unchanged |
| `app/tohtml/page.tsx` (1,640 lines) | KEEP | Fix imports of `server/lib/cutParser` and `splitByLines` to the new `frontend/lib/` location. **Do not refactor the file in this migration** |
| `app/layout.tsx`, `LanguageContext`, `LanguageSelector`, `translations.ts`, `download.ts`, `globals.css` | KEEP | Verify `next/font/google` resolves at build time (needs network on the build machine) |
| `app/api/**` | REMOVE from the frontend build after the Laravel endpoints pass contract tests | Required for `output: 'export'` |
| `next.config.ts` | MODIFY | `output: 'export'`; drop dead `serverExternalPackages`; `images.unoptimized: true` if images are used |
| `server/**` | MOVE/REMOVE | Shared parsers move to `frontend/lib/`; the rest is replaced by `backend/` |
| `package.json` | MODIFY | Remove `openai`, `googleapis`, `@google/genai`, `@mistralai/mistralai` and the `tsx --test` script that points at non-existent files; keep `tsx` for the parser tests |

Behavior to preserve or check: client-side `CUT n` parsing; 600-line preview chunking; BOM-injected downloads; Persian RTL layout; theme persistence; polling every 2 s; modal chunk previews. Data fetching, routing, form submission, error handling, file input (a local `.txt` read in the browser, never uploaded), pagination (none), search and filters stay unchanged. One new behavior the UI may meet: job lists now survive server restarts. Check what the pages do on load (do they call status without an id?) and whether the active `jobId` is stored; no change is required, just confirm there is no surprising list rendering.

Development: a `compose.dev.yml` with Nginx in front of PHP-FPM and the Next dev server gives same-origin behavior locally. Avoid Next `rewrites` with `output: 'export'`.

## 14. Admin Migration

There is no admin system. The two dashboards are operator tools and are migrated as part of section 13. Users, subjects, topics, questions, files, courses, purchases, coupons, notifications, analytics and settings pages **do not exist** and are not planned. Admin vs Super Admin restrictions: N/A.

## 15. Background Jobs / Queues / Cron

| Current process | Trigger | Current implementation | Laravel job/command | Queue | Schedule |
| --- | --- | --- | --- | --- | --- |
| Drive OCR, one file | POST `/api/pipelines/start` | `void runJob()` + `p-limit(1)` + 3-stage worker | `ProcessDriveFileJob` | `drive-ocr`, **1 worker process** | none |
| ToHTML synthesis, one chunk | POST start, POST retry | `void runToHtmlJob()`, concurrency 2 | `ProcessToHtmlChunkJob` | `deepseek`, **2 worker processes** | none |
| Gemini pacing (10 s) | inline | `paceGeminiCall()` sleep | `GeminiPacer` (cache lock + timestamp) | inside the job | none |
| Lost-worker recovery | none today (state vanished with the process) | n/a | `automation:reconcile-stuck`: any file/chunk `in_progress`/`processing` with `heartbeat_at` older than job timeout + margin becomes `error`/`failed` with message 'worker lost', then the parent job is finalized | n/a | every 5 min (IMPORTANT: persistence creates this new failure mode) |
| Orphan temp PDFs | none (leaks after crashes) | n/a | `automation:cleanup-temp` deletes temp files older than 24 h | n/a | hourly (OPTIONAL) |
| Failed-job table hygiene | none | n/a | `queue:prune-failed --hours=168` | n/a | daily (OPTIONAL) |
| Log retention | none | n/a | prune `job_logs` older than 90 days | n/a | daily (OPTIONAL) |

**Redis is not required.** Concurrency is 1 and 2, jobs run for minutes, and there is one host. The `database` queue is durable and adds no service. Revisit only if workers move to several hosts or throughput grows by an order of magnitude.

Worker settings (starting values in `deploy/supervisord.conf`, all from config):

```text
[program:queue-drive]    queue:work database --queue=drive-ocr --timeout=1500 --tries=1 --sleep=3 --max-time=3600  numprocs=1  stopwaitsecs=1600
[program:queue-deepseek] queue:work database --queue=deepseek  --timeout=900  --tries=1 --sleep=3 --max-time=3600  numprocs=2  stopwaitsecs=950
config/queue.php  connections.database.retry_after = 1800   (must exceed the largest --timeout)
scheduler: * * * * * php artisan schedule:run   (needed for the commands above)
```

`--max-time` recycles workers to bound memory. Deploys run `php artisan queue:restart`, which lets in-flight jobs finish. If a deploy must interrupt a running OCR job, the reconcile command handles the leftover row. A pipeline retry endpoint does not exist today and is not added (OPTIONAL later).

## 16. File Storage

| Topic | Plan |
| --- | --- |
| Uploads | None. The ToHTML page reads a local `.txt` in the browser and posts parsed sections as JSON |
| Downloads | Streamed from the `outputs` disk with the same headers as today |
| S3 / Arvan / presigned URLs | N/A. No object storage exists; do not introduce any |
| File metadata | `output_filename`, `output_path`, `output_dir` columns (section 6) |
| Access control | The D1 gate. No per-file ACLs exist today |
| Deletion / replacement | No endpoint exists; none added. Retry of a ToHTML chunk overwrites the chunk file via temp name + rename |
| Disks | `config/filesystems.php`: `outputs` -> `storage_path('app/outputs')`, `temp` -> `storage_path('app/temp')`. In Docker, a persistent volume is mounted at the outputs path and shared by the PHP-FPM container and the worker container; both run as the same UID so files are writable by both |
| Path safety | `OutputStorage` resolves every path with `realpath` on the root and the candidate and requires the candidate to start with root plus separator. Directory names come only from the sanitizer, never directly from request text |
| Sanitizer fidelity | Copy the exact allowed-character set from `storage.service.ts` (Phase 0) so existing folders keep their names. Unicode-aware; no slugging |
| Existing references | There are none in a DB. Existing `outputs/` is copied as-is (section 20), so no re-generation |
| Linux vs Windows | Case-sensitive names, no reserved device names, `/` separators. Phase 0 checks for names differing only by case and for the percent-encoded folder name (correction 20) |

## 17. External Services

| Service | Current implementation | Laravel equivalent | Package | Config | Migration risk |
| --- | --- | --- | --- | --- | --- |
| Google Drive v3 | `googleapis`, service-account JWT, list PDFs + stream download | `GoogleDriveService` implementing `DriveGateway` | `google/apiclient` (current stable; the only new Composer runtime package) | `services.google.client_email`, `private_key` (convert literal `\n` sequences to real newlines on load) | Low-Medium: key newline handling, large-file streaming to disk, pagination of `files.list` |
| Gemini Files + generateContent | `@google/genai`: upload, poll ACTIVE (120 s), paced stream generate, `finishReason` check, delete in `finally` | `GeminiClient` over Laravel `Http` (resumable upload, `files.get` polling, `streamGenerateContent` with SSE parsing, `files.delete`) | none | `services.gemini.api_key`, `model`, `min_interval_ms`, `timeout_ms`, `thinking_budget` | **Medium-High**: protocol details and API drift were hidden by the SDK. Mitigate with recorded fixtures, an interface (`OcrProvider`) and a staging run on a real 2-file folder |
| DeepSeek chat | `openai` SDK with `baseURL` | `DeepSeekClient` over `Http::post(.../chat/completions)` | none (this replaces the audit's `openai-php/client`; the call is one POST and a package adds nothing) | `services.deepseek.api_key`, `max_tokens`, optional `base_uri` | Low |
| Mistral OCR, OpenRouter | dormant | not ported | none | not carried | none (REMOVE) |
| Email, SMS, payments, webhooks, object storage | absent | n/a | n/a | n/a | n/a |

Streaming note: the old code streams the Gemini response. Keep that (read the SSE body incrementally, accumulate text, keep the final `finishReason`) rather than a single blocking call, so very long generations are not dropped by idle-timeout intermediaries. All upstream failures are wrapped in `UpstreamApiException` with HTTP status and a trimmed body for logs; raw keys are never logged.

## 18. Analytics / User Data

No user progress, events or analytics are stored today. The only 'analytics' are metrics computed per request.

| Metric | Existing storage | Laravel equivalent | Historical data | New write path | Read query |
| --- | --- | --- | --- | --- | --- |
| Pipeline totals: completed, processing, failed, pending | in-memory file states | `pipeline_job_files.overall_status` | none exists | job writes status transitions | `count ... group by overall_status` |
| `ocrSuccessRate`, `ocrErrorRate` | computed | same formulas over `ocr_status` | none | same | accessor on resource |
| `avgOcrDurationMs` | computed | `avg(ocr_ms) where ocr_status = success` | none | job stores `ocr_ms` | aggregate |
| ToHTML totals + `avgDurationMs` | computed | `tohtml_job_chunks.status`, `duration_ms` | none | chunk job writes | aggregate |
| Logs shown in the UI | in-memory arrays | `job_logs` | none | `JobLogger` | last N by `id` |

Previous runs exist only as files in `outputs/`. **D3 (OPTIONAL):** an artisan importer can register those folders as read-only archived jobs so they appear in the dashboard (needs an `is_archived` flag and honest nulls for durations). Default: copy files only, no importer. Nothing is lost relative to today, because the old dashboard could not show earlier runs either.

## 19. Testing Strategy

The goal is behavioral parity, proven by the fixtures captured in Phase 0 from the running Node app.

| Level | Scope | Must cover |
| --- | --- | --- |
| Unit | `LineSplitter`, `FolderUrlParser`, `OutputStorage::sanitize`, chunk filename builder, `NaturalSorter`, `RetryPolicy`, `GeminiPacer`, metrics accessors | Splitter parity: port every case from `test-tohtml-flow.ts` and run the same input through the TS and PHP splitters comparing output. CRLF vs LF, empty lines, exactly 600 lines, 601 lines, trailing newline. Sanitizer: Persian names, dots, slashes, `..`, long names. Sort: numeric ordering with Persian and Latin names |
| Feature / API | All 8 endpoints through HTTP | Compare status code, headers, JSON shape and key set to fixtures. Validation failures return the old shape. 404s. Same response when the job id is unknown |
| Authentication / authorization | The D1 gate only | Unauthenticated request blocked; throttle returns 429 at the limit; status polling not throttled |
| Database | Migrations and constraints on real PostgreSQL | up/down, unique keys, CHECK on `job_logs`, cascade deletes, atomic transition affects 0 rows on a second attempt |
| Jobs | `ProcessDriveFileJob`, `ProcessToHtmlChunkJob`, `ReconcileStuckWork` | Run handlers synchronously with fakes: success path writes the right file; Gemini `MAX_TOKENS`; DeepSeek `finish_reason=length`; 429 with retry; remote delete runs on failure; temp PDF removed; finalization correct when the last two files finish together (parallel test or forced lock); reconcile marks stale rows; job timeout vs `retry_after` config assertion |
| Integration (gated) | Real Drive/Gemini/DeepSeek in staging | 2-file Drive folder; 3-section booklet with one oversized section; one induced failure then retry. Run only manually, costs are small |
| E2E | Browser against the compose stack | One happy path per dashboard (start, watch progress, download, merge) and one retry path. Tooling is the team's choice; Playwright is fine as a dev dependency. Include a Persian RTL screenshot check |
| Non-functional | Polling load | `GET status` with 5,000 log rows stays fast; 20 concurrent pollers; 30 MB start payload accepted |

High-risk subsystems and their exit tests: **queue timing** (retry\_after assertion, duplicate-run test), **Gemini client** (fixture-driven SSE and upload tests plus staging run), **filename/ordering fidelity** (golden tests), **body-size limits** (large-payload test through Nginx, not just PHPUnit).

## 20. Data Migration Strategy

Only files migrate. There are no database records, passwords, purchases or user progress.

| Step | Action | Evidence of success |
| --- | --- | --- |
| 1 Backup | Archive the current `outputs/` and keep a secured copy of the old `.env` (encrypted, then rotate all keys for the new system) | Archive checksum recorded |
| 2 Snapshot | Old DB: N/A. New DB: empty after migrations; snapshot before first real run | n/a |
| 3 Scripts | `deploy/scripts/outputs-manifest.sh` (sha256 per file + relative path + size) and `copy-outputs.sh` (rsync or robocopy) | Scripts committed |
| 4 Transformation | None. Names are copied byte-for-byte. If Phase 0 shows percent-encoded real folder names, keep them literal | Decision logged |
| 5 Validate counts | Folder count (expected 107), file count, total bytes: old vs new | Equal |
| 6 Checksums | Manifest diff old vs new | Zero differences |
| 7 FK validation | New schema enforces FKs; run an integrity query after any importer | 0 orphans |
| 8 Users / passwords | N/A | n/a |
| 9 File reference validation | N/A for the default path; if D3 importer is used, every `output_path` exists on disk | 100% |
| 10 Historical progress / purchases | N/A | n/a |
| 11 Unicode check | List every folder and file with PHP `scandir`, assert valid UTF-8 and that the old name set equals the new name set | Equal |
| 12 Final reconciliation | Signed report: counts, bytes, manifest diff, name-set diff | Archived with the release |

Old-vs-new comparison for behavior: run the same small input through both apps with live APIs and compare structure, not content (LLM text varies): chunk count, filename set, merged ordering, status transitions, error messages for forced failures.

## 21. Deployment Strategy

| Component | Plan |
| --- | --- |
| Image | One `deploy/Dockerfile`: PHP 8.3/8.4 FPM with `pdo_pgsql`, `intl`, `mbstring`, `zip`, `opcache`; Composer install with `--no-dev --optimize-autoloader`; same image runs FPM, workers and scheduler (different commands) |
| Services in `compose.yml` | `nginx` (serves `frontend/out` and proxies `/api` to FPM), `app` (php-fpm), `worker-drive`, `worker-deepseek`, `scheduler`, `postgres`. **No Redis** |
| Volumes | `outputs` (persistent, shared by app and workers), `pgdata`, `temp` (ephemeral) |
| PHP settings | `post_max_size` and `upload_max_filesize` sized to real payloads (start at 64M; measure in Phase 0), `memory_limit` 512M for workers, `max_execution_time` default for FPM (jobs run on CLI, which is unlimited) |
| Nginx | `client_max_body_size` matching PHP; `fastcgi_read_timeout` 120 s (the start endpoint calls Drive synchronously); static `try_files` for the two pages; basic auth block if D1(a) |
| Env / secrets | `.env` with mode 600, injected by compose `env_file` or a secrets manager; never in the image. New keys, not the audited ones |
| Env variables | `APP_KEY`, `APP_ENV`, `APP_URL`, `DB_*`, `QUEUE_CONNECTION=database`, `CACHE_STORE=database`, `LOG_CHANNEL=stderr`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_MIN_INTERVAL_MS`, `GEMINI_TIMEOUT_MS`, `GEMINI_THINKING_BUDGET`, `DEEPSEEK_API_KEY`, `DEEPSEEK_MAX_TOKENS`, plus `AUTOMATION_*` tunables (chunk size, retry constants) |
| Health checks | `/up` for the app container; worker health = Supervisor status plus a 'last heartbeat' metric; Postgres `pg_isready` |
| Logging | JSON to stderr, collected by Docker; `job_logs` is the user-facing log |
| Backups | Nightly `pg_dump` (small data) and a volume snapshot of `outputs/`; restore tested once before cutover |
| Monitoring | Alert on: failed\_jobs growth, rows stuck `in_progress` beyond the timeout, disk usage of `outputs/`, 5xx rate, upstream 429 rate |
| Unknown host | If production is a Windows machine without Docker, use Docker Desktop/WSL2 or a Linux VM. Native Windows PHP + Supervisor is not recommended (D2) |

## 22. Cutover / Rollback Strategy

Because the old system holds no durable state beyond files, cutover is low-risk if no jobs are running.

1. **Pre-migration:** staging passes all acceptance criteria (section 26); production rehearsal done on a copy of the host; keys rotated and tested; backup restore tested.
2. **Migration window:** agree a quiet period. Confirm the old status endpoint shows zero `processing` jobs. Stop accepting new jobs (stop the old app or block start endpoints).
3. **Data synchronization:** final delta copy of `outputs/` into the new volume; manifest comparison.
4. **Deployment:** bring up the new stack, run migrations, start workers and scheduler, verify `/up`.
5. **Smoke tests:** open both pages; start a 2-file Drive job and watch it finish; start a 3-section ToHTML job with one forced failure and retry it; download single and merged files and check the BOM through the UI; restart the worker container mid-run and confirm reconcile behavior; confirm Persian filenames in downloads.
6. **Proxy / DNS switch:** repoint the port or hostname that operators use (the old app ran on port 4000; keep the same entry point if possible).
7. **Rollback:** repoint to the old app (kept installed and stopped, not deleted) and copy any new `outputs/` files back. Nothing in a database needs reversing. Rollback trigger: any smoke test failure that cannot be fixed within the window, or duplicate-run behavior in workers.
8. **Post-migration monitoring:** 7 days of daily checks of failed jobs, stuck rows, disk, and upstream error rates; keep the old app for 2 weeks, then decommission.

## 23. Risk Register

| Risk | Probability | Impact | Severity | Mitigation | Owner / phase |
| --- | --- | --- | --- | --- | --- |
| Authentication / password hashes / permissions | n/a | n/a | n/a | No users or roles exist | n/a |
| Open endpoints let anyone spend API money | High (exists today) | High | High | D1 gate, throttle, server-chosen prompt if possible | P6 |
| Gemini client mismatches SDK behavior (upload, polling, stream, finishReason) | Medium | High | High | Interface + fixtures + staging run before cutover | P4 |
| Duplicate job execution (`retry_after` below job timeout) | Medium | High | High | Config assertion test; `$tries=1`; row-level atomic transitions | P5 |
| Rows stuck forever after worker crash | High without mitigation | Medium | High | Heartbeats + `reconcile-stuck` + monitoring | P5 |
| Silent 413 on large booklet payloads | Medium | High | High | Measure payloads; raise PHP and Nginx limits; large-payload test | P0, P6 |
| Persian filename loss or reorder (slugging, collation) | Medium | High | High | Unicode sanitizer, ICU Collator, golden tests | P3 |
| API contract drift breaks the UI | Medium | High | High | Phase 0 fixtures + contract tests | P0, P6 |
| `output: export` conflicts with leftover route handlers or fonts | Medium | Medium | Medium | Move frontend early (P1), build in CI | P1, P7 |
| Prompt text altered when moved to files | Low | High | Medium | Byte-identical file test (hash) | P3 |
| Secrets exposed during audit | High | Medium | Medium | Rotate all keys for the new system | P0, P9 |
| Unknown production host (Windows / shared hosting) | Medium | Critical | Critical until resolved | Decision D2 before P1 | Project owner |
| Disk growth in `outputs/` | Medium | Low | Low | Monitoring; retention policy OPTIONAL | P9 |
| Production downtime | Low | Low | Low | Short window, rollback by proxy switch | P9 |

## 24. Phase-by-Phase Implementation Plan

Ordered by dependency and risk, not by folder. Effort labels are relative (Small / Medium / Large / Very Large); no hours are estimated because the repository does not provide enough evidence.

| Phase | Name | Complexity | Depends on | Relative effort | Risk |
| --- | --- | --- | --- | --- | --- |
| P0 | Preparation and contract capture | Medium | none | Medium | Medium (blocks everything downstream) |
| P1 | Repository restructure and Laravel foundation | Low | P0 | Small | Low |
| P2 | Database and models | Low | P1 | Small | Low |
| P3 | Pure domain services (text, storage, retry, prompts) | Medium | P1 | Medium | Medium |
| P4 | External clients (Drive, Gemini, DeepSeek, pacer) | High | P3 | Large | High |
| P5 | Jobs, orchestration, recovery | Critical | P2, P3, P4 | Very Large | Critical |
| P6 | HTTP layer and contract tests | Medium | P5 | Medium | Medium |
| P7 | Frontend integration (static export) | Low-Medium | P6 | Small | Medium |
| P8 | Staging, file migration, rehearsal | Medium | P7 | Medium | Medium |
| P9 | Production deployment and cutover | Medium | P8 | Small-Medium | Medium |
| P10 | Decommission | Low | P9 + 2 weeks | Small | Low |

P2 and P3 can run in parallel. The P4 client code can begin once P3's `RetryPolicy` exists.

### P0. Preparation and contract capture

**Objective:** resolve every VERIFY item and record the old API as executable fixtures. Source code is read, never modified (except a git tag).

**Create:** `docs/migration/constants.md` (retry attempts and delays from `retry.ts`; whether `pLimit` is global or per job; pacing call sites; sanitizer allowed-character set; log array cap; stage-readiness rule for download and merge; exact error strings; `sectionIndex` meaning; any route `maxDuration`/`dynamic` exports); `docs/migration/decisions.md` (D1-D6); `docs/migration/contracts/*.json` (recorded request/response pairs for all 8 endpoints, including 400/404/500 cases and download headers); `scripts/record-contracts.ts`.

**Commands to run (read-only):**

```text
git tag pre-laravel-migration
git grep -il 'use server'
git grep -inE 'proxy|middleware|cookies\(|authorization|bearer|session' -- app server
git grep -n 'process.env' ; git grep -n OPENROUTER
git grep -nE 'pLimit|p-limit|CONCURRENCY_LIMIT'
git grep -nE 'localStorage|setInterval|fetch\(' -- app
git grep -nE 'maxDuration|export const (dynamic|runtime)' -- app
list outputs/ : percent-encoded names, case-insensitive duplicates, total size
measure the largest realistic ToHTML start payload
rotate GOOGLE/GEMINI/DEEPSEEK/MISTRAL/OPENROUTER keys
```

**Tests / acceptance:** every row tagged VERIFY in section 2 is updated to a final status; fixtures exist for each endpoint and error case; D1 and D2 are decided; the premise question in section 0 is answered. **Rollback:** nothing to undo.

### P1. Repository restructure and Laravel foundation

**Objective:** new layout with the old app still running unchanged.

**Create:** `backend/` via `composer create-project laravel/laravel backend` (current stable; PHP 8.3+); `deploy/Dockerfile`, `deploy/compose.dev.yml`, `deploy/nginx.conf`, `.github/workflows/ci.yml` (or the team's CI); `backend/config/automation.php`; `backend/routes/api.php` (enable API routing in `bootstrap/app.php`, JSON rendering for `api/*`).

**Modify:** `git mv` the Next app (`app/`, `public/`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`, `package*.json`, `next-env.d.ts`) into `frontend/`; move `server/lib/cutParser.ts`, `server/lib/splitByLines.ts` and their tests to `frontend/lib/` and fix imports. Keep `app/api` and the old `server/` in place (renamed `legacy-server/` if a move is easier) until P6 so the old app still runs.

**Remove:** default Laravel `User` model, factory, users/sessions/password-reset migrations, `welcome` view. **DB:** none yet. **Do not** enable `output: export` yet: route handlers still exist.

**Tests / acceptance:** `docker compose -f deploy/compose.dev.yml up` serves the old UI at the same URL; `GET /up` returns 200; `php artisan test` passes; frontend builds. **Rollback:** reset to tag `pre-laravel-migration`.

### P2. Database and models

**Create:** migrations `create_pipeline_jobs_table`, `create_pipeline_job_files_table`, `create_tohtml_jobs_table`, `create_tohtml_job_chunks_table`, `create_job_logs_table`, plus `queue:table`, `cache:table`, `queue:failed-table` equivalents in `backend/database/migrations/`; models `PipelineJob`, `PipelineJobFile`, `ToHtmlJob`, `ToHtmlJobChunk`, `JobLog`; enums `JobStatus`, `StageStatus`, `ChunkStatus`, `LogLevel`; factories.

**Code:** casts, relations, query scopes for metrics, `HasUuids`, CHECK constraint via `DB::statement` in the `job_logs` migration.

**Tests:** migrate up/down on PostgreSQL; unique and cascade tests; atomic-transition test. **Acceptance:** schema matches section 6 exactly. **Rollback:** `php artisan migrate:rollback` (no production data yet).

### P3. Pure domain services

**Create:** `app/Services/Support/{LineSplitter,FolderUrlParser,NaturalSorter,RetryPolicy,JobLogger}.php`, `app/Services/Storage/OutputStorage.php`, `app/Services/Ai/PromptRepository.php`, `resources/prompts/ocr.txt`, `resources/prompts/tohtml-default.txt` (byte-identical copies of the prompt strings), disks in `config/filesystems.php`.

**Code:** splitter semantics from `splitByLines.ts`; sanitizer from `storage.service.ts`; retry constants from P0; atomic write helper; `reserveDir` using a unique key to avoid races.

**Tests:** parity suite described in section 19; SHA-256 of prompt files equals SHA-256 of the strings extracted from TS. **Acceptance:** all green; no I/O to the network. **Rollback:** revert commits (no runtime impact).

### P4. External clients

**Create:** `app/Services/Drive/DriveGateway.php`, `GoogleDriveService.php`; `app/Services/Ai/GeminiClient.php`, `GeminiPacer.php`, `DeepSeekClient.php`, `OcrProvider.php` (interface); `app/Exceptions/*`; entries in `config/services.php`; fixtures in `tests/Fixtures/`.

**Code:** service-account auth and `files.list` pagination; streamed download to `storage/app/temp`; Gemini resumable upload, `ACTIVE` polling (120 s), paced SSE generation (temp 0, thinking budget from config, `finishReason` handling), deletion in `finally`; DeepSeek completion with `finish_reason` handling.

**Tests:** `Http::fake` suites for success, 429, 5xx, timeout, truncation; a gated `automation:probe` command that calls each API once with a tiny input. **Acceptance:** probe succeeds in staging with the rotated keys. **Rollback:** none needed (unused by routes yet).

### P5. Jobs, orchestration, recovery (highest risk)

**Create:** `app/Jobs/ProcessDriveFileJob.php`, `ProcessToHtmlChunkJob.php`; `app/Services/Pipeline/PipelineService.php`, `ToHtml/ToHtmlService.php`; `app/Console/Commands/ReconcileStuckWork.php`, `CleanupTemp.php`; schedule in `routes/console.php`; `deploy/supervisord.conf`; queue settings (`retry_after`, queue names) in `config/queue.php`.

**Code:** section 12 flows; heartbeats; row-locked finalization; `$tries = 1`, `$timeout` from config; `failed()` hooks; `afterCommit` dispatch.

**Tests:** section 19 job suite, plus a worker-kill drill in staging and a two-worker race test for finalization. **Acceptance:** with fakes, a 5-file job and a 20-chunk job complete correctly; killing a worker mid-file results in a reconciled error row within the margin; no duplicate execution when a job runs longer than 90 s (default `retry_after`) because config is set correctly. **Rollback:** feature is unreachable from HTTP until P6.

### P6. HTTP layer and contract tests

**Create:** `app/Http/Controllers/{PipelineController,ToHtmlController}.php`; `app/Http/Requests/*`; `app/Http/Resources/*`; optional `EnsureInternalAccess` middleware; routes in `routes/api.php`; contract test suite `tests/Feature/Contract/*` reading `docs/migration/contracts/*.json`; Nginx throttle/body-size settings.

**Acceptance:** every fixture matches on status, headers and JSON shape; throttling works; 30 MB payload accepted end to end through Nginx. **Rollback:** disable routes by reverting; old app still serves.

### P7. Frontend integration

**Modify:** `frontend/next.config.ts` (`output: 'export'`); delete `frontend/app/api/**` and `legacy-server/**` **only now**; `frontend/package.json` (remove server SDKs); Nginx serves `frontend/out`; `compose.dev.yml` proxies `/api` to PHP-FPM.

**Tests:** export build passes; E2E happy paths for both dashboards; RTL/Persian visual check; BOM check on downloaded files. **Acceptance:** UI behaves identically against Laravel. **Rollback:** restore removed folders from git, run the old Next server.

### P8. Staging, file migration, rehearsal

**Do:** deploy to staging with the production compose file; run the section 20 copy and manifest comparison; run gated integration tests on real APIs; run the restore test for backups; full cutover rehearsal including rollback. **Acceptance:** section 26 criteria met; rehearsal timing recorded.

### P9. Production deployment and cutover

Execute section 22. **Acceptance:** smoke tests pass; monitoring quiet for the agreed period. **Rollback:** section 22 step 7.

### P10. Decommission

After two stable weeks: stop and archive the old app, delete `legacy-server/` leftovers and stale branches, update README and runbook. **Rollback:** the archive plus tag `pre-laravel-migration`.

### Final roadmap

1. Confirm the premise and make decisions D1 and D2 (BLOCKERS).
2. Tag the repo, rotate keys, run the P0 verification, record contract fixtures.
3. Restructure into `frontend/` and `backend/`; keep the old app running.
4. Create schema and models; in parallel build pure domain services with parity tests.
5. Build external clients behind interfaces; probe each real API once.
6. Build jobs, orchestration and recovery; prove timing, duplicate-run and crash behavior.
7. Add controllers, requests, resources, throttling and the access gate; pass contract tests.
8. Flip the frontend to static export, remove old route handlers, run E2E.
9. Deploy staging, copy and verify `outputs/`, rehearse cutover and rollback.
10. Cut over in a quiet window; run smoke tests; monitor for a week.
11. Keep the old app for two weeks, then decommission.

## 25. File-by-File Mapping

Only files with real logic are listed; trivial UI files are KEEP in `frontend/` (section 13).

| Current | Target | Responsibility and key changes | Tests |
| --- | --- | --- | --- |
| `app/api/pipelines/start/route.ts` | `PipelineController@start`, `StartPipelineRequest`, `PipelineService::start` | Validate URL, list PDFs, create job+files in one transaction, dispatch after commit. Return the old JSON | Contract fixture, invalid URL, Drive failure fake |
| `app/api/pipelines/status/route.ts` | `PipelineController@status`, `PipelineJob{Summary,Details}Resource` | List or detail; metrics and logs computed in resources | Contract fixtures; metrics unit tests |
| `app/api/pipelines/download/route.ts`, `merge/route.ts` | `PipelineController@download`, `@merge`, `OutputStorage`, `NaturalSorter` | Readiness rule (correction 16), realpath guard, streaming, `=====` separators, ICU sort | Header/body fixtures; traversal attempts; Persian sort golden |
| `app/api/tohtml/start/route.ts` | `ToHtmlController@start`, `StartToHtmlRequest`, `ToHtmlService::start`, `LineSplitter` | Dir reservation, chunking, job+chunks in one transaction, dispatch | Splitter parity; large payload; collision of two simultaneous starts |
| `app/api/tohtml/{status,retry,download}/route.ts` | `ToHtmlController@status`, `@retry`, `@download` | Atomic `failed -> pending`; merged banner format; single chunk download | Retry race test; fixtures |
| `server/services/Pjob.service.ts`, `toHtmlJob.service.ts` | Models + `PipelineService`/`ToHtmlService` query methods | In-memory Map replaced by Eloquent; ids stay UUID strings | DB tests |
| `server/services/pipeline.service.ts`, `server/workers/pipeline.worker.ts` | `PipelineService`, `ProcessDriveFileJob` | Orchestration vs per-file work separated; stage columns; heartbeat; finalization | Job suite; kill drill |
| `server/services/toHtmlRunner.service.ts` | `ProcessToHtmlChunkJob`, `ToHtmlService` | Chunk lifecycle, filename builder, truncation failure, finalization | Job suite |
| `server/services/AI/gemini.service.ts` | `GeminiClient`, `GeminiPacer`, `OcrProvider` | Same protocol rules (poll 120 s, 10 s pacing, temp 0, `finishReason`, delete in `finally`) | Fixture-driven; staging probe |
| `server/services/AI/deepseek.service.ts` | `DeepSeekClient` | Only the active completion function; `max_tokens`; `length` detection | Http fake |
| `server/services/drive.service.ts` | `DriveGateway`, `GoogleDriveService` | Service-account auth, pagination, streamed download | Interface fake; staging probe |
| `server/services/storage.service.ts` | `OutputStorage` | Sanitizer, reserve dir, safe resolve, atomic write | Golden names; traversal |
| `server/retry.ts`, `server/lib/logger.ts` | `RetryPolicy`, `JobLogger` | Same constants; logs to DB and Laravel log | Unit |
| `server/lib/splitByLines.ts` | `frontend/lib/splitByLines.ts` (KEEP) + `LineSplitter` (PHP) | Identical outputs on shared cases | Parity suite |
| `server/lib/cutParser.ts` | `frontend/lib/cutParser.ts` (KEEP) | PHP port only if D-optional server validation is chosen | Existing TS tests |
| `server/prompts/ocr.prompt.ts`, DeepSeek `DEFAULT_PROMPT` | `resources/prompts/*.txt`, `PromptRepository` | Byte-identical | Hash test |
| `next.config.ts`, `package.json` | `frontend/next.config.ts`, `frontend/package.json` | Export mode; dependency cleanup | Build in CI |

## 26. Acceptance Criteria (whole migration)

1. All 8 contract fixtures pass (status codes, headers, JSON shape, error shape).
2. A 2-file Drive job and a 3-section ToHTML job (one oversized section, one forced failure, one retry) complete on staging with real APIs, and output file names match the scheme.
3. Workers survive a restart mid-run: no duplicate execution, no permanently stuck rows.
4. The `outputs/` migration manifest has zero differences and the Persian name set is identical.
5. Both dashboards are visually and behaviorally unchanged (RTL, theme, language, polling, downloads with BOM).
6. No secrets in the repo or images; all keys rotated; throttling and the access gate are verified.
7. Cutover rehearsal and rollback were both executed once.
8. Logs, health checks, backups and alerts are live.

## 27. Final Migration Checklist

For each item record: old behavior verified, new behavior implemented, data verified, access verified, automated test, manual test.

- [ ] Open both pages (`/`, `/tohtml`) through Nginx with the access gate
- [ ] Persian default, RTL, English toggle, language and theme persistence
- [ ] Start Drive pipeline with a valid folder URL; invalid and missing URL errors
- [ ] Per-file stage statuses (download, upload, ocr) and overall progress
- [ ] Gemini upload, ACTIVE polling, 10 s pacing, OCR result saved, remote file deleted, temp PDF removed
- [ ] `MAX_TOKENS` error surfaced as the same message
- [ ] Per-file download and merged download (ordering, separators, filename)
- [ ] Client-side `CUT n` parsing and 600-line chunk preview
- [ ] Start ToHTML job; output folder naming and collision handling
- [ ] DeepSeek synthesis, concurrency 2, `finish_reason=length` failure
- [ ] Chunk file names match `<index4>-<marker>-chunk-<n>.txt`
- [ ] Retry one failed chunk; retry all failed chunks
- [ ] Single chunk download; merged download with banners
- [ ] Status polling, metrics cards, live log panel
- [ ] Jobs and logs survive an app restart (new behavior)
- [ ] Stuck work is reconciled after a worker kill (new behavior)
- [ ] Throttle on start/retry; large payload accepted
- [ ] Existing `outputs/` data intact (counts, checksums, names)
- [ ] Secrets rotated; dead code not carried over

## 28. Blockers and Unknowns

| ID | Item | Tag | Resolution |
| --- | --- | --- | --- |
| B0 | Is this the intended repository? The brief assumes Prisma, users, purchases and admin; the audit finds none | BLOCKER | Confirm before any work. If another repo was intended, this plan does not apply |
| D2 | Production host and whether Docker, Supervisor and PostgreSQL are available (shared hosting cannot run workers) | BLOCKER | Infrastructure owner decides before P1 |
| B1 | API contracts are not documented (response shapes, error bodies, status enums) | BLOCKER for exact compatibility | P0 fixtures |
| D1 | Access gate: Nginx basic auth/IP allowlist, app middleware, or none | IMPORTANT | Product owner; needed by P6 |
| D5 | Prompt source: client-supplied (as today) vs server-only; if client-supplied, cap its size and store it per job | IMPORTANT | P0 reading of the ToHTML UI and `deepseek.service.ts` |
| D6 | Match old error shapes exactly (recommended) vs adopt Laravel defaults | IMPORTANT | Recommend exact match; frontend untouched |
| D3 | Import old `outputs/` as archived jobs into the dashboard | OPTIONAL | Product owner |
| D4 | Keep Next.js as the frontend build tool (recommended) vs move to Vite | OPTIONAL | Later, independent of this migration |
| U1 | `pLimit` scope (global vs per job) and which Gemini calls are paced | HIGH RISK unknown | P0 constants |
| U2 | Download readiness rule (`upload` vs `overallStatus`) | HIGH RISK unknown | P0; decide replicate vs fix |
| U3 | Real maximum payload size and PDF sizes | HIGH RISK unknown | P0 measurement |
| U4 | Meaning of `sectionIndex`; behavior of retry on non-failed chunks | IMPORTANT unknown | P0 fixtures |
| U5 | Percent-encoded folder names in `outputs/`; case-insensitive duplicates | IMPORTANT unknown | P0 listing |
| U6 | Existence of `proxy.ts`/middleware, Server Actions, other env var usage | IMPORTANT unknown | P0 greps |
| U7 | Current stable Laravel/PHP and package versions; `ext-intl` availability in the image | IMPORTANT unknown | Resolve at P1 install time |
| U8 | Whether the pages import anything server-only that breaks `output: 'export'` | IMPORTANT unknown | Try the export build in P1 on a branch |
