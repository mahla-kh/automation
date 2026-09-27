import path from "path";
import readline from "readline";
import { chromium } from "playwright";

async function login(): Promise<void> {
    const rawDir = process.env.CHROME_USER_DATA_DIR || "./chrome-profile";
    const userDataDir = path.isAbsolute(rawDir) ? rawDir : path.resolve(process.cwd(), rawDir);
    const executablePath = process.env.CHROME_EXECUTABLE_PATH || undefined;

    console.log("\n========================================================");
    console.log("🚀 STARTING INTERACTIVE SETUP / LOGIN MODE");
    console.log(`📁 User Data Directory: ${userDataDir}`);
    console.log("========================================================\n");

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        executablePath,
        viewport: { width: 1280, height: 800 },
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-blink-features=AutomationControlled",
            "--no-first-run",
            "--no-default-browser-check"
        ]
    });

    const page = context.pages()[0] ?? (await context.newPage());

    console.log("🌐 Navigating to Google NotebookLM...");
    await page.goto("https://notebooklm.google.com", {
        waitUntil: "domcontentloaded",
        timeout: 120_000
    });

    console.log("\n--------------------------------------------------------");
    console.log("👉 ACTION REQUIRED:");
    console.log("   1. Log into your Google Account in the opened browser.");
    console.log("   2. Complete any 2FA or security challenges manually.");
    console.log("   3. Verify you can view your NotebookLM home page.");
    console.log("   4. Return here and press [ENTER] to save and exit.");
    console.log("--------------------------------------------------------\n");

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    await new Promise<void>((resolve) => {
        rl.question("Press [ENTER] after you have successfully logged in... ", () => {
            rl.close();
            resolve();
        });
    });

    console.log("\n💾 Saving authenticated browser profile and closing...");
    await context.close();

    console.log("✅ Profile successfully saved to:", userDataDir);
    console.log("🎉 You can now run the application in normal/headless automation mode!\n");
}

login().catch((err) => {
    console.error("❌ Login setup failed:", err);
    process.exit(1);
});