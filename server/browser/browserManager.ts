import path from "path";
import { chromium, BrowserContext, Page } from "playwright";
import { logger } from "../lib/logger";

class AsyncMutex {
    private mutex = Promise.resolve();

    async lock(): Promise<() => void> {
        let unlock!: () => void;
        const nextPromise = new Promise<void>((resolve) => {
            unlock = resolve;
        });
        const currentPromise = this.mutex;
        this.mutex = this.mutex.then(() => nextPromise);
        await currentPromise;
        return unlock;
    }
}

class BrowserManager {
    private context: BrowserContext | null = null;
    private launchPromise: Promise<BrowserContext> | null = null;
    private mutex = new AsyncMutex();
    private isShuttingDown = false;

    constructor() {
        this.registerShutdownHooks();
    }

    private getUserDataDir(): string {
        const rawDir = process.env.CHROME_USER_DATA_DIR || "./chrome-profile";
        return path.isAbsolute(rawDir) ? rawDir : path.resolve(/*turbopackIgnore: true*/ process.cwd(), rawDir);
    }

    private isHeadless(): boolean {
        return process.env.CHROME_HEADLESS === "true";
    }

    /**
     * Retrieves or initializes the persistent browser context.
     * Automatically recovers if the context was closed or crashed.
     */
    async getContext(): Promise<BrowserContext> {
        if (this.isShuttingDown) {
            throw new Error("BrowserManager is currently shutting down.");
        }

        if (this.context) {
            return this.context;
        }

        if (this.launchPromise) {
            return this.launchPromise;
        }

        this.launchPromise = this.initContext();
        try {
            this.context = await this.launchPromise;
            return this.context;
        } finally {
            this.launchPromise = null;
        }
    }

    private async initContext(): Promise<BrowserContext> {
        const userDataDir = this.getUserDataDir();
        const headless = this.isHeadless();
        const executablePath = process.env.CHROME_EXECUTABLE_PATH || undefined;

        logger.info("Launching persistent browser context", {
            userDataDir,
            headless,
            hasCustomExecutable: Boolean(executablePath)
        });

        const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath,
    viewport: null,
    permissions: ["clipboard-read", "clipboard-write"],
    args: [
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-dev-shm-usage",
    ],
});

        context.on("close", () => {
            logger.warn("Persistent browser context was closed.");
            this.context = null;
        });

        return context;
    }

    /**
     * Executes a given task with an isolated page under a sequential lock.
     * Ensures the page is always closed and the lock released.
     */
    async withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
        const unlock = await this.mutex.lock();
        let page: Page | null = null;
        try {
            const ctx = await this.getContext();
            page = await ctx.newPage();
            return await fn(page);
        } finally {
            if (page) {
                await page.close().catch((err) => {
                    logger.warn("Error closing page in withPage", { error: err });
                });
            }
            unlock();
        }
    }

    /**
     * Creates a new page from the persistent context.
     * Callers must ensure `await page.close()` when finished.
     */
    async newPage(): Promise<Page> {
        const ctx = await this.getContext();
        return ctx.newPage();
    }

    /**
     * Gracefully closes the persistent browser context and releases lockfiles.
     */
    async close(): Promise<void> {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;

        if (this.context) {
            logger.info("Closing persistent browser context gracefully...");
            try {
                await this.context.close();
            } catch (err) {
                logger.warn("Error during browser context shutdown", { error: err });
            } finally {
                this.context = null;
                this.isShuttingDown = false;
            }
        }
    }

    private registerShutdownHooks(): void {
        const handleExit = async (signal: string) => {
            logger.info(`Received ${signal}. Cleaning up browser context...`);
            await this.close();
        };

        if (typeof process !== "undefined") {
            process.once("SIGINT", () => void handleExit("SIGINT"));
            process.once("SIGTERM", () => void handleExit("SIGTERM"));
        }
    }
}

export const browserManager = new BrowserManager();
