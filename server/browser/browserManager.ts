// import path from "path";
// import { chromium, BrowserContext, Page } from "playwright";
// import { logger } from "../lib/logger";

// class AsyncMutex {
//     private mutex = Promise.resolve();

//     async lock(): Promise<() => void> {
//         let unlock!: () => void;
//         const nextPromise = new Promise<void>((resolve) => {
//             unlock = resolve;
//         });
//         const currentPromise = this.mutex;
//         this.mutex = this.mutex.then(() => nextPromise);
//         await currentPromise;
//         return unlock;
//     }
// }

// class BrowserManager {
//     private context: BrowserContext | null = null;
//     private launchPromise: Promise<BrowserContext> | null = null;
//     private mutex = new AsyncMutex();
//     private isShuttingDown = false;

//     constructor() {
//         this.registerShutdownHooks();
//     }

//     private getUserDataDir(): string {
//         const rawDir = process.env.CHROME_USER_DATA_DIR || "./chrome-profile";
//         return path.isAbsolute(rawDir) ? rawDir : path.resolve(/*turbopackIgnore: true*/ process.cwd(), rawDir);
//     }

//     private isHeadless(): boolean {
//         return process.env.CHROME_HEADLESS === "true";
//     }

//     /**
//      * Retrieves or initializes the persistent browser context.
//      * Automatically recovers if the context was closed or crashed.
//      */
//     async getContext(): Promise<BrowserContext> {
//         if (this.isShuttingDown) {
//             throw new Error("BrowserManager is currently shutting down.");
//         }

//         if (this.context) {
//             return this.context;
//         }

//         if (this.launchPromise) {
//             return this.launchPromise;
//         }

//         this.launchPromise = this.initContext();
//         try {
//             this.context = await this.launchPromise;
//             return this.context;
//         } finally {
//             this.launchPromise = null;
//         }
//     }

//     private async initContext(): Promise<BrowserContext> {
//         const userDataDir = this.getUserDataDir();
//         const headless = this.isHeadless();
//         const executablePath = process.env.CHROME_EXECUTABLE_PATH || undefined;

//         logger.info("Launching persistent browser context", {
//             userDataDir,
//             headless,
//             hasCustomExecutable: Boolean(executablePath)
//         });

//         const context = await chromium.launchPersistentContext(userDataDir, {
//     headless: false,
//     executablePath,
//     viewport: null,
//     permissions: ["clipboard-read", "clipboard-write"],
//     args: [
//         "--no-first-run",
//         "--no-default-browser-check",
//         "--disable-dev-shm-usage",
//     ],
// });

//         context.on("close", () => {
//             logger.warn("Persistent browser context was closed.");
//             this.context = null;
//         });

//         return context;
//     }

//     /**
//      * Executes a given task with an isolated page under a sequential lock.
//      * Ensures the page is always closed and the lock released.
//      */
//     async withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
//         const unlock = await this.mutex.lock();
//         let page: Page | null = null;
//         try {
//             const ctx = await this.getContext();
//             page = await ctx.newPage();
//             return await fn(page);
//         } finally {
//             if (page) {
//                 await page.close().catch((err) => {
//                     logger.warn("Error closing page in withPage", { error: err });
//                 });
//             }
//             unlock();
//         }
//     }

//     /**
//      * Creates a new page from the persistent context.
//      * Callers must ensure `await page.close()` when finished.
//      */
//     async newPage(): Promise<Page> {
//         const ctx = await this.getContext();
//         return ctx.newPage();
//     }

//     /**
//      * Gracefully closes the persistent browser context and releases lockfiles.
//      */
//     async close(): Promise<void> {
//         if (this.isShuttingDown) return;
//         this.isShuttingDown = true;

//         if (this.context) {
//             logger.info("Closing persistent browser context gracefully...");
//             try {
//                 await this.context.close();
//             } catch (err) {
//                 logger.warn("Error during browser context shutdown", { error: err });
//             } finally {
//                 this.context = null;
//                 this.isShuttingDown = false;
//             }
//         }
//     }

//     private registerShutdownHooks(): void {
//         const handleExit = async (signal: string) => {
//             logger.info(`Received ${signal}. Cleaning up browser context...`);
//             await this.close();
//         };

//         if (typeof process !== "undefined") {
//             process.once("SIGINT", () => void handleExit("SIGINT"));
//             process.once("SIGTERM", () => void handleExit("SIGTERM"));
//         }
//     }
// }

// export const browserManager = new BrowserManager();


import {
    chromium,
    Browser,
    BrowserContext,
    Page,
} from "playwright";
import { logger } from "../lib/logger";

class AsyncMutex {
    private mutex = Promise.resolve();

    async lock(): Promise<() => void> {
        let unlock!: () => void;

        const nextPromise = new Promise<void>((resolve) => {
            unlock = resolve;
        });

        const currentPromise = this.mutex;
        this.mutex = currentPromise.then(() => nextPromise);

        await currentPromise;
        return unlock;
    }
}

class BrowserManager {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;

    private connectionPromise: Promise<BrowserContext> | null = null;
    private mutex = new AsyncMutex();
    private isShuttingDown = false;

    private readonly cdpEndpoint =
        process.env.CHROME_CDP_ENDPOINT ??
        "http://127.0.0.1:9222";

    constructor() {
        this.registerShutdownHooks();
    }

    /**
     * Connects to an already-running Chrome instance.
     * Never launches a new browser or creates a new profile.
     */
    async getContext(): Promise<BrowserContext> {
        if (this.isShuttingDown) {
            throw new Error("BrowserManager is shutting down.");
        }

        if (
            this.browser?.isConnected() &&
            this.context
        ) {
            return this.context;
        }

        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        const promise = this.connectToChrome();
        this.connectionPromise = promise;

        try {
            return await promise;
        } finally {
            if (this.connectionPromise === promise) {
                this.connectionPromise = null;
            }
        }
    }

    private async connectToChrome(): Promise<BrowserContext> {
        logger.info("Connecting to existing Chrome via CDP", {
            endpoint: this.cdpEndpoint,
        });

        let browser: Browser;

        try {
            browser = await chromium.connectOverCDP(
                this.cdpEndpoint
            );
        } catch (error) {
            logger.error("Could not connect to Chrome via CDP", {
                endpoint: this.cdpEndpoint,
                error,
            });

            throw new Error(
                `Cannot connect to Chrome at ${this.cdpEndpoint}. ` +
                "Start Chrome with --remote-debugging-port=9222 first."
            );
        }

        const context = browser.contexts()[0];

        if (!context) {
            await browser.close().catch(() => {});

            throw new Error(
                "Chrome is connected, but no existing browser context was found."
            );
        }

        this.browser = browser;
        this.context = context;

        browser.on("disconnected", () => {
            logger.warn("Chrome CDP connection disconnected");

            if (this.browser === browser) {
                this.browser = null;
                this.context = null;
            }
        });

        context.on("close", () => {
            logger.warn("Chrome browser context was closed");

            if (this.context === context) {
                this.context = null;
                this.browser = null;
            }
        });

        logger.info("Connected to existing Chrome profile", {
            endpoint: this.cdpEndpoint,
            existingPages: context.pages().map((page) => page.url()),
        });

        return context;
    }

    /**
     * Creates a tab in the already-running Chrome profile.
     */
    async newPage(): Promise<Page> {
        const context = await this.getContext();
        return context.newPage();
    }

    /**
     * Executes tasks sequentially and closes only the created tab.
     */
    async withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
        const unlock = await this.mutex.lock();
        let page: Page | null = null;

        try {
            page = await this.newPage();
            return await fn(page);
        } finally {
            if (page) {
                await page.close().catch((error) => {
                    logger.warn("Could not close automation tab", {
                        error,
                    });
                });
            }

            unlock();
        }
    }

    /**
     * Disconnects Playwright without explicitly closing the user's Chrome.
     */
    async close(): Promise<void> {
        if (this.isShuttingDown) return;

        this.isShuttingDown = true;

        try {
            const browser = this.browser;

            this.browser = null;
            this.context = null;

            if (browser?.isConnected()) {
                logger.info("Disconnecting Playwright from Chrome");
                await browser.close();
            }
        } catch (error) {
            logger.warn("Error disconnecting from Chrome", { error });
        } finally {
            this.connectionPromise = null;
            this.isShuttingDown = false;
        }
    }

    private registerShutdownHooks(): void {
        const handleExit = async (signal: string) => {
            logger.info(`Received ${signal}. Disconnecting from Chrome...`);
            await this.close();
        };

        process.once("SIGINT", () => void handleExit("SIGINT"));
        process.once("SIGTERM", () => void handleExit("SIGTERM"));
    }
}

export const browserManager = new BrowserManager();
