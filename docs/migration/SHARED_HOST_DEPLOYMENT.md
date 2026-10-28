# Shared Hosting Deployment Guide â€” Next.js Static Export + Laravel API

**Target Environment:** Conventional PHP/Laravel Shared Hosting (cPanel, DirectAdmin, CloudLinux LVE, Plesk)  
**Supported Database Engines:** MySQL 8.0+, MariaDB 10.6+ (InnoDB), or PostgreSQL 15/16  
**Runtime Requirement:** PHP 8.3 or PHP 8.4 CLI + Web  
**Supervisor / Docker Required:** **NO** (Fully replaced by the bounded, resumable cron runner)

---

## 1. Architectural Overview for Shared Hosting

On shared hosting, root access is unavailable, background daemons (`queue:work`, Supervisor) are killed by process reapers after 30â€“180 seconds, and the public document root is typically hard-wired to `/home/username/public_html/`.

To operate reliably and securely within these constraints, the application uses:
1. **Static Frontend Export (`frontend/out/`):** Deployed directly into `public_html/` to serve `/` and `/tohtml` without any Node.js server.
2. **Backend Code Isolation:** The entire Laravel application, `.env`, logs, and `outputs/` directory reside outside `public_html/` in `/home/username/wepass_app/`.
3. **API Gateway (`public_html/api/`):** A lightweight bootstrap index file and `.htaccess` route all `/api/*` requests to Laravel's request lifecycle.
4. **Resumable Bounded Runner (`automation:process`):** Replaces persistent queue workers. Invoked every minute via cPanel cron, it processes discrete units of work within a configurable budget (default 50s), records atomic leases in the database, and exits cleanly before host execution limits are reached.
5. **Stale Claim Token Protection:** Worker updates and completions are strictly guarded by unique claim tokens (`WHERE id = ? AND claim_token = ?`). If a worker's lease expires and another worker reclaims the work, the stale worker's completion is safely rejected, preventing state corruption.

---

## 2. Shared Hosting Directory Layout

```
/home/username/
â”œâ”€â”€ wepass_app/                              <-- SECURE: Outside public web root
â”‚   â”œâ”€â”€ backend/                             <-- Complete Laravel backend
â”‚   â”‚   â”œâ”€â”€ app/
â”‚   â”‚   â”œâ”€â”€ bootstrap/
â”‚   â”‚   â”œâ”€â”€ config/
â”‚   â”‚   â”œâ”€â”€ database/
â”‚   â”‚   â”œâ”€â”€ routes/
â”‚   â”‚   â”œâ”€â”€ storage/                         <-- Cache, temp PDFs, and logs
â”‚   â”‚   â”‚   â”œâ”€â”€ app/temp/
â”‚   â”‚   â”‚   â”œâ”€â”€ framework/
â”‚   â”‚   â”‚   â””â”€â”€ logs/
â”‚   â”‚   â”œâ”€â”€ vendor/                          <-- Composer packages
â”‚   â”‚   â”œâ”€â”€ artisan
â”‚   â”‚   â””â”€â”€ .env                             <-- SECURE: No HTTP access possible
â”‚   â””â”€â”€ outputs/                             <-- SECURE: Private outputs disk
â”‚       â”œâ”€â”€ 0e27ef05-1b79-40cf-8a06.../
â”‚       â””â”€â”€ tohtml-.../
â”‚
â””â”€â”€ public_html/                             <-- PUBLIC DOCUMENT ROOT
    â”œâ”€â”€ .htaccess                            <-- Apache routing, header forwarding & Basic Auth
    â”œâ”€â”€ index.html                           <-- From frontend/out/index.html (/)
    â”œâ”€â”€ tohtml.html                          <-- From frontend/out/tohtml.html (/tohtml)
    â”œâ”€â”€ tohtml/                              <-- From frontend/out/tohtml/
    â”œâ”€â”€ _next/                               <-- From frontend/out/_next/ (JS/CSS assets)
    â”œâ”€â”€ favicon.ico
    â”‚
    â””â”€â”€ api/                                 <-- LARAVEL API GATEWAY
        â”œâ”€â”€ .htaccess                        <-- Rewrites all /api/* requests
        â””â”€â”€ index.php                        <-- Bootstrapper (loads wepass_app/backend)
```

---

## 3. Pre-Flight Hosting Provider Checklist

Verify the following capabilities with your hosting provider or via the hosting control panel before proceeding:

| Item | Requirement | Verification Method in cPanel |
|---|---|---|
| **PHP Version** | PHP 8.3 or PHP 8.4 | **MultiPHP Manager** or **Select PHP Version** |
| **Required Extensions** | `pdo_mysql` (or `pdo_pgsql`), `intl`, `bcmath`, `curl`, `openssl`, `zip`, `mbstring`, `fileinfo` | **PHP Extensions / Modules** checklist |
| **CLI Memory Limit** | Minimum 256MB (512MB recommended) | Check `memory_limit` via cPanel Terminal: `php -r "echo ini_get('memory_limit');"` |
| **CLI Execution Time** | Minimum 60â€“120 seconds | Ensure CloudLinux LVE does not kill CLI scripts under 60s |
| **Cron Frequency** | Every 1 minute (`* * * * *`) | Check **Cron Jobs** scheduling interval |
| **Outbound HTTPS** | Port 443 egress open to Google & DeepSeek | Run test in Terminal: `curl -I https://api.deepseek.com` |
| **Database Engine** | MySQL 8.0+ or MariaDB 10.6+ (InnoDB engine) | Check **phpMyAdmin** or **MySQL Databases** |
| **SSH / Terminal** | Access to run Artisan CLI commands | cPanel **Terminal** or SSH access |

> [!IMPORTANT]
> **Hard Execution Limit Warning:** While DeepSeek section chunking (~10â€“20s) and Google Drive downloads (~5s) execute very quickly, a dense or multi-hundred page PDF submitted to Gemini OCR can take 15â€“40 seconds of continuous inference. Ensure your hosting plan allows CLI scripts to run for at least **60 seconds** continuously. If the host terminates processes after 30 seconds, dense PDF OCR requests will fail.

---

## 4. Execution Budget, Timeout, and Lease Relationship

The system guarantees that bounded runner processes exit cleanly before hosting limits. The parameters in `.env` are mathematically calibrated as follows:

```
Hosting Provider CLI Execution Ceiling (e.g., 60s â€“ 120s)
  â””â”€â”€ SHARED_HOST_RUNNER_MAX_TIME (50s)
        â”œâ”€â”€ Drive File Unit Buffer (45s required remaining budget to claim)
        â”‚     â”œâ”€â”€ Drive Download Timeout (30s)
        â”‚     â””â”€â”€ Gemini OCR Timeout (40s)
        â”‚
        â”œâ”€â”€ DeepSeek Unit Buffer (35s required remaining budget to claim)
        â”‚     â””â”€â”€ DeepSeek Chat Timeout (30s)
        â”‚
        â””â”€â”€ Clean Exit Window (When remaining budget < 35s, runner exits cleanly)

SHARED_HOST_LEASE_DURATION (120s)
  â””â”€â”€ Leases are renewed after each completed stage (download -> OCR).
      Leases only expire if a process is hard-killed without cleanup.

DB_QUEUE_RETRY_AFTER (180s)
  â””â”€â”€ Safely exceeds both unit execution time and lease duration to prevent premature re-release.
```

- **Remaining Budget Check:** Before claiming any unit, the runner checks remaining time against `deepseek_unit_buffer` (35s) or `drive_unit_buffer` (45s). If insufficient time remains, it will NOT claim another unit, exiting cleanly with status code 0.
- **Lease Renewal:** For Drive files, completing the download stage extends the lease by another 120s before OCR begins. Legitimate long pipelines will never have their leases expire while actively processing.
- **Stale Claim Rejection:** If an orphaned process attempts to write output after its lease expired and was reassigned, the database update matches 0 rows (`claim_token` check) and is safely rejected.

---

## 5. Step-by-Step Deployment Procedure

### Step 1: Create Database & User
1. Log into cPanel / DirectAdmin.
2. Navigate to **MySQL Databases**.
3. Create a new database: e.g., `username_wepass`.
4. Create a new database user: e.g., `username_wepass_user` with a strong password.
5. Assign the user to the database with **ALL PRIVILEGES**.
6. Verify the collation is set to `utf8mb4_unicode_ci` and the default storage engine is **InnoDB**.

---

### Step 2: Upload Application Files
1. In your user home directory (`/home/username/`), create the folder `wepass_app`.
2. Upload the `backend/` directory to `/home/username/wepass_app/backend/`.
3. Upload existing historical outputs to `/home/username/wepass_app/outputs/`.
4. Verify directory permissions:
   ```bash
   chmod -R 755 /home/username/wepass_app/backend
   chmod -R 775 /home/username/wepass_app/backend/storage
   chmod -R 775 /home/username/wepass_app/backend/bootstrap/cache
   chmod -R 775 /home/username/wepass_app/outputs
   ```

---

### Step 3: Deploy Frontend Static Assets to `public_html/`
1. On your local build machine, ensure `frontend/out/` is generated:
   ```bash
   cd frontend
   npm run build
   ```
2. Upload the contents of `frontend/out/` directly into `/home/username/public_html/`:
   - `index.html`
   - `tohtml.html`
   - `tohtml/`
   - `_next/`
   - `favicon.ico`, `file.svg`, `globe.svg`, etc.

---

### Step 4: Configure the Public API Gateway
1. Inside `public_html/`, create the folder `api`:
   ```bash
   mkdir -p /home/username/public_html/api
   ```
2. Create `/home/username/public_html/api/index.php`:
   ```php
   <?php

   use Illuminate\Http\Request;

   define('LARAVEL_START', microtime(true));

   // Adjust username to your actual cPanel username
   $appPath = '/home/username/wepass_app/backend';

   // Maintenance mode check
   if (file_exists($maintenance = $appPath.'/storage/framework/maintenance.php')) {
       require $maintenance;
   }

   // Autoloader & Bootstrap
   require $appPath.'/vendor/autoload.php';
   $app = require_once $appPath.'/bootstrap/app.php';

   $app->handleRequest(Request::capture());
   ```

3. Create `/home/username/public_html/api/.htaccess`:
   ```apache
   <IfModule mod_rewrite.c>
       RewriteEngine On
       RewriteCond %{REQUEST_FILENAME} !-f
       RewriteCond %{REQUEST_FILENAME} !-d
       RewriteRule ^ index.php [L]
   </IfModule>
   ```

4. Create or update the root `/home/username/public_html/.htaccess`:
   ```apache
   # Pass Authorization header to FastCGI/PHP-FPM
   SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1

   # Deny direct access to sensitive files
   <FilesMatch "^\.(env|git|ht)">
       Require all denied
   </FilesMatch>

   # Enable URL rewriting
   <IfModule mod_rewrite.c>
       RewriteEngine On
       RewriteBase /

       # Exclude /api/* from frontend rewrite rules
       RewriteRule ^api(/.*)?$ - [L]

       # Serve static files if they exist
       RewriteCond %{REQUEST_FILENAME} -f [OR]
       RewriteCond %{REQUEST_FILENAME} -d
       RewriteRule ^ - [L]

       # Clean URL for /tohtml route (supports both /tohtml and /tohtml/)
       RewriteCond %{DOCUMENT_ROOT}/tohtml.html -f
       RewriteRule ^tohtml/?$ tohtml.html [L]
        RewriteCond %{DOCUMENT_ROOT}/process.html -f
        RewriteRule ^process(/.*)?$ process.html [L]
        RewriteCond %{DOCUMENT_ROOT}/login.html -f
        RewriteRule ^login/?$ login.html [L]
        RewriteCond %{DOCUMENT_ROOT}/admin/users.html -f
        RewriteRule ^admin/users/?$ admin/users.html [L]

       # Fallback to index.html for client-side routing
       RewriteRule ^ index.html [L]
   </IfModule>

   # Gzip / Brotli compression for static export
   <IfModule mod_deflate.c>
       AddOutputFilterByType DEFLATE text/html text/plain text/css application/javascript application/json
   </IfModule>

   # Access Gate: HTTP Basic Auth (Protects internal operator tool)
   AuthType Basic
   AuthName "WePass Internal Automation"
   AuthUserFile /home/username/.htpasswd
   Require valid-user
   ```

5. Generate the `.htpasswd` credentials via cPanel **Directory Privacy** or via terminal:
   ```bash
   htpasswd -c /home/username/.htpasswd operator_username
   ```

---

### Step 5: Configure `.env` on Server
Inside `/home/username/wepass_app/backend/.env`, configure:

```ini
APP_NAME="WePass Automation"
APP_ENV=production
APP_KEY=base64:YOUR_GENERATED_APP_KEY_HERE
APP_DEBUG=false
APP_URL=https://your-domain.com

LOG_CHANNEL=daily
LOG_LEVEL=info

# Database Configuration (MySQL on Shared Host)
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=username_wepass
DB_USERNAME=username_wepass_user
DB_PASSWORD="your-strong-password"

# Queue & Cache Drivers
CACHE_STORE=database
QUEUE_CONNECTION=database
SESSION_DRIVER=database
FILESYSTEM_DISK=local

# Output Storage (Private disk outside public web root)
OUTPUTS_PATH=/home/username/wepass_app/outputs

# Automation API Credentials
GEMINI_API_KEY=AIzaSy...your-gemini-key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_MIN_INTERVAL_MS=10000

DEEPSEEK_API_KEY=sk-...your-deepseek-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_MAX_TOKENS=8192

GOOGLE_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Shared Hosting Bounded Runner & Timeout Limits
SHARED_HOST_RUNNER_MAX_TIME=50
SHARED_HOST_SAFETY_BUFFER=10
SHARED_HOST_MAX_UNITS_PER_RUN=10
SHARED_HOST_LEASE_DURATION=120
SHARED_HOST_STALE_THRESHOLD=180
SHARED_HOST_GEMINI_TIMEOUT=40
SHARED_HOST_DEEPSEEK_TIMEOUT=30
SHARED_HOST_DRIVE_TIMEOUT=30
SHARED_HOST_DEEPSEEK_UNIT_BUFFER=35
SHARED_HOST_DRIVE_UNIT_BUFFER=45
SHARED_HOST_HTTP_RETRIES=1
SHARED_HOST_MAX_CHUNK_ATTEMPTS=3
SHARED_HOST_MAX_FILE_ATTEMPTS=3
DB_QUEUE_RETRY_AFTER=180

# Initial Super Admin Provisioning (Required for Seeding)
SUPER_ADMIN_NAME="Super Administrator"
SUPER_ADMIN_EMAIL="admin@wepass.ir"
SUPER_ADMIN_PASSWORD="YourStrongSuperAdminPasswordHere!"

# Stateful Authentication / Session Security (HTTPS in production)
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax
SANCTUM_STATEFUL_DOMAINS=your-domain.com
```

---

### Step 6: Run Migrations & Cache Configuration
Open the cPanel Terminal or SSH:
```bash
cd /home/username/wepass_app/backend

# Generate application key if empty
php artisan key:generate

# Execute database migrations
php artisan migrate --force

# Provision initial Super Admin account idempotently
php artisan db:seed --class=SuperAdminSeeder --force

# Optimize Laravel configuration and route caches
php artisan config:cache
php artisan route:cache
```

---

### Step 7: Configure the Cron Job
In cPanel, open **Cron Jobs**.

Add the following 1-minute cron command for automation processing, and an hourly cron command for the 2-day file retention cleanup:

`	ext
0 * * * * /usr/local/bin/php /home/username/wepass_app/backend/artisan automation:cleanup-expired >> /home/username/wepass_app/backend/storage/logs/cleanup.log 2>&1
`

And the 1-minute runner:
```text
* * * * * /usr/local/bin/php /home/username/wepass_app/backend/artisan automation:process --max-time=50 --max-units=10 >> /home/username/wepass_app/backend/storage/logs/cron.log 2>&1
```

*(Note: Replace `/usr/local/bin/php` with your hosting provider's actual PHP 8.3/8.4 binary path, e.g. `/usr/bin/ea-php83` or `/opt/cpanel/ea-php84/root/usr/bin/php`).*

To check your exact PHP CLI path in cPanel Terminal, run:
```bash
which php
```

> [!TIP]
> **Why Direct Invocation is Recommended over `schedule:run` on Shared Hosting:**  
> Laravel's `schedule:run withoutOverlapping()` relies on file or database cache locks. If a previous cron process was killed mid-execution by the hosting provider's process reaper, cache mutex locks can remain stuck for hours.  
> Direct invocation of `automation:process` eliminates this failure mode: it uses **database row-level leases** (`lockForUpdate()` and `claim_expires_at`), allowing expired leases to be automatically reclaimed by subsequent runs without manual cache clearing.

---

## 6. Post-Deployment Verification

### 1. Web & API Health Check
Open your browser and navigate to:
- `https://your-domain.com/` â€” Prompts for HTTP Basic Auth, then displays the WePass Pipeline UI.
- `https://your-domain.com/tohtml` â€” Displays the ToHTML Booklet Synthesis UI.
- `https://your-domain.com/api/pipelines/status` â€” Returns `{"error": "Job not found"}` with HTTP 404.

### 2. Output Data Verification
Verify that the 420 existing output files survived file transfer without alteration:
```bash
cd /home/username/wepass_app/backend
php -r '
$candidates = [
    $argv[1] ?? null,
    __DIR__ . "/docs/migration/outputs-manifest.json",
    dirname(__DIR__) . "/docs/migration/outputs-manifest.json",
];
$manifestPath = null;
foreach ($candidates as $c) {
    if ($c && file_exists($c)) { $manifestPath = $c; break; }
}
if (!$manifestPath) {
    echo "Manifest file not found. Provide path as: php script.php /path/to/outputs-manifest.json\n";
    exit(1);
}
$manifest = json_decode(file_get_contents($manifestPath), true);
$root = getenv("OUTPUTS_PATH") ?: dirname(__DIR__) . "/outputs";
$checked = 0; $failed = 0;
foreach ($manifest["files"] as $f) {
    $p = $root . "/" . $f["path"];
    if (!file_exists($p) || hash_file("sha256", $p) !== $f["sha256"]) {
        $failed++;
    } else {
        $checked++;
    }
}
echo "Checked: $checked, Failures: $failed\n";
'
```

### 3. Staging Concurrency & Database Verification (MySQL / MariaDB)
To verify that your hosting account's MySQL database handles concurrent work claims safely without duplicate processing:
1. Insert two test chunks or files in `pending` status.
2. In two separate cPanel Terminal tabs, simultaneously execute:
   ```bash
   php artisan automation:process --max-time=30 --queue=tohtml
   ```
3. Inspect `storage/logs/cron.log` and verify:
   - Worker 1 claims chunk 1.
   - Worker 2 skips chunk 1 (`lockForUpdate()`) and claims chunk 2.
   - Zero duplicate claims, zero deadlocks.

### 4. End-to-End Pipeline Smoke Test
1. On `https://your-domain.com/`, submit a Google Drive test folder URL containing 1â€“2 PDF files.
2. Observe polling:
   - Status changes from `pending` -> `in_progress`.
   - On the next cron minute (or immediate CLI run `php artisan automation:process`), file stages transition from `download` -> `ocr` -> `upload`.
   - On completion, download the result and verify the text output.
3. On `https://your-domain.com/tohtml`, submit a small 2-section text input.
4. Verify chunk synthesis, individual download, and merged download.

---

## 7. Backup, Restore, and Rollback Procedures

### Backup Procedure
1. **Database:**
   Export database dump via cPanel **Backup Wizard** or CLI:
   ```bash
   mysqldump -u username_wepass_user -p username_wepass > /home/username/wepass_backup_$(date +%Y%m%d).sql
   ```
2. **Outputs Directory:**
   ```bash
   tar -czvf /home/username/outputs_backup_$(date +%Y%m%d).tar.gz -C /home/username/wepass_app outputs
   ```

### Rollback Procedure
If a rollback is required:
1. Re-upload previous build artifacts to `/home/username/wepass_app/backend`.
2. Restore database:
   ```bash
   mysql -u username_wepass_user -p username_wepass < /home/username/wepass_backup_YYYYMMDD.sql
   ```
3. Clear caches:
   ```bash
   php artisan config:clear
   php artisan route:clear
   php artisan cache:clear
   ```


