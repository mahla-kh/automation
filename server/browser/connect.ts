import { Page, Locator ,Browser,BrowserContext } from "playwright";
import { logger } from "../lib/logger";
import { chromium, expect } from "playwright/test";
// import { Browser, chromium, expect } from "playwright/test";
import { browserManager } from "./browserManager";

const CDP_ENDPOINT = process.env.CHROME_CDP_ENDPOINT ?? "http://localhost:9222";

let browserPromise: Promise<Browser> | null = null;
/**
 * Retrieves a new Page from the managed persistent browser context.
 * Note: Callers should prefer using `browserManager.withPage(fn)` for automatic
 * concurrency control and guaranteed page cleanup.
 */
async function getBrowser(): Promise<Browser> {
    if (browserPromise) {
        return browserPromise;
    }
    const connectionPromise = chromium.connectOverCDP(CDP_ENDPOINT);
    browserPromise = connectionPromise;

    try {
        const browser = await connectionPromise;

        browser.on("disconnected", () => {
            // Reset only if this is still the active connection.
            if (browserPromise === connectionPromise) {
                browserPromise = null;
            }

            logger.warn("Chrome CDP connection disconnected");
        });

        logger.info("Connected to existing Chrome via CDP", {
            endpoint: CDP_ENDPOINT,
        });

        return browser;
    } catch (error) {
        // Allow a future call to retry the connection.
        if (browserPromise === connectionPromise) {
            browserPromise = null;
        }

        logger.error("Failed to connect to Chrome via CDP", {
            endpoint: CDP_ENDPOINT,
            error,
        });

        throw error;
    }
}

// export async function connectChrome(): Promise<Page> {
//     const browser = await getBrowser();

//     const contexts: BrowserContext[] = browser.contexts();
//     const context = contexts[0];

//     if (!context) {
//         throw new Error(
//             "No existing Chrome browser context found. " +
//             "Start Chrome with the configured remote debugging port."
//         );
//     }

//     const page = await context.newPage();

//     logger.info("New tab created in existing Chrome profile", {
//         endpoint: CDP_ENDPOINT,
//     });

//     return page;
// }
export async function connectChrome(): Promise<Page> {
    return browserManager.newPage();
}

// NOTE: NotebookLM's DOM is not versioned/public — these selectors are best
// guesses and WILL need to be confirmed/updated against the live page
// (inspect notebooklm.google.com and adjust before relying on this in prod).
const CHAT_INPUT_SELECTOR = "textarea[aria-label='Query box']";
const SEND_BUTTON_SELECTOR = "button[aria-label='Submit']:not([disabled])";
const STOP_GENERATING_SELECTOR = "button[aria-label='Stop generating']";
const RESPONSE_DOC_SELECTOR = "labs-tailwind-doc-viewer";
const COPY_BUTTON_SELECTOR = 'button[aria-label="Copy model response to clipboard"]';

export async function sendPromptToPage(page: Page, prompt: string): Promise<number> {
    await page.waitForSelector(CHAT_INPUT_SELECTOR, { timeout: 30_000 });
    const input = page.locator(CHAT_INPUT_SELECTOR);

    await expect(input).toBeEnabled({ timeout: 120_000 });
    await expect(input).toBeEditable({ timeout: 30_000 });

    // Snapshot the baseline count of response elements BEFORE submitting this turn
    const initialCount = await page.locator(RESPONSE_DOC_SELECTOR).count();

    await input.fill(prompt);

    const submitBtn = page.locator(SEND_BUTTON_SELECTOR);
    await expect(submitBtn).toBeEnabled({ timeout: 15_000 });
    await submitBtn.click();

    logger.info("Prompt sent to NotebookLM", {
        promptLength: prompt.length,
        expectedTurnIndex: initialCount,
    });

    return initialCount;
}


/**
 * Waits for any in-flight response generation to complete before attempting extraction.
 */
async function waitForResponseGenerationToFinish(page: Page): Promise<void> {
    const stopGenLocator = page.locator(STOP_GENERATING_SELECTOR);
    const isGenerating = await stopGenLocator.isVisible().catch(() => false);
    if (isGenerating) {
        logger.info("Active generation detected, waiting for completion");
    }
    await expect(stopGenLocator).toBeHidden({ timeout: 180_000 });
    await expect(page.locator(CHAT_INPUT_SELECTOR)).toBeEditable({ timeout: 180_000 });
}

async function installClipboardCapture(page: Page): Promise<void> {
    await page.evaluate(() => {
        const w = window as any;
        if (w.__nlmClipInstalled) return;
        w.__nlmClipInstalled = true;
        w.__nlmCaptured = null;
        const clip = navigator.clipboard;
        const origWriteText = clip.writeText?.bind(clip);
        const origWrite = clip.write?.bind(clip);
        clip.writeText = async (text: string) => {
            w.__nlmCaptured = text;
            try { await origWriteText?.(text); } catch {}
        };
        clip.write = async (items: ClipboardItem[]) => {
            for (const item of items) {
                if (item.types.includes("text/plain")) {
                    w.__nlmCaptured = await (await item.getType("text/plain")).text();
                }
            }
            try { await origWrite?.(items); } catch {}
        };
    });
}

async function waitForStableCount(page: Page, selector: string, stableMs = 1500, maxMs = 30_000): Promise<number> {
    const start = Date.now();
    let last = -1;
    let lastChange = Date.now();
    while (Date.now() - start < maxMs) {
        const n = await page.locator(selector).count();
        if (n !== last) { last = n; lastChange = Date.now(); }
        else if (n > 0 && Date.now() - lastChange >= stableMs) return n;
        await page.waitForTimeout(300);
    }
    return last < 0 ? 0 : last;
}

async function copyResponseMarkdown(page: Page, copyButton: Locator, index: number): Promise<string> {
    await page.evaluate(() => { (window as any).__nlmCaptured = null; });
    await copyButton.scrollIntoViewIfNeeded().catch(() => {});
    await copyButton.click({ timeout: 10_000 });
    try {
        await page.waitForFunction(() => (window as any).__nlmCaptured !== null, undefined, { timeout: 10_000 });
    } catch {
        throw new Error(`Copy click on response #${index + 1} did not write to the clipboard`);
    }
    const text: string = await page.evaluate(() => (window as any).__nlmCaptured);
    return text.replace(/\r\n/g, "\n").replace(/\n$/, "");
}

export async function getAnswer(page: Page, expectedTurnIndex?: number): Promise<string> {
    const responseLocator = page.locator(RESPONSE_DOC_SELECTOR);

    // If no turn index is explicitly provided, target the most recent response
    let turnIndex = expectedTurnIndex;
    if (turnIndex === undefined) {
        const count = await responseLocator.count();
        turnIndex = Math.max(0, count - 1);
    }

    const targetResponse = responseLocator.nth(turnIndex);

    logger.info("Waiting for NotebookLM response", { turnIndex });

    // 1. Wait for the specific response container for this turn to mount in DOM
    await targetResponse.waitFor({ state: "attached", timeout: 60_000 });

    // 2. Wait for generation completion signals
    await waitForResponseGenerationToFinish(page);

    // 3. Copy canonical markdown
    await installClipboardCapture(page);
    const markdown = await copyResponseMarkdown(page, page.locator(COPY_BUTTON_SELECTOR).nth(turnIndex), turnIndex);

    if (!markdown || markdown.length === 0) {
        logger.error("NotebookLM returned empty answer", { turnIndex });
        throw new Error(`NotebookLM returned an empty response for turn index ${turnIndex}`);
    }

    logger.info("Answer retrieved successfully", {
        turnIndex,
        length: markdown.length,
    });

    return markdown;
}

export interface ExtractionResult {
    responses: string[];
    mergedText: string;
    count: number;
}

/**
 * Formats an array of response texts with clear response boundaries.
 */
export function formatMergedResponses(responses: string[]): string {
    return responses
        .map((resp, idx) => `========================================\nCut ${idx + 1}\n========================================\n\n${resp}`)
        .join("\n\n");
}

/**
 * Standalone extraction workflow helper:
 * Finds all NotebookLM responses in the page, waits for each response's generation
 * to settle, extracts each response's Markdown via the Copy button, and merges them.
 */
export async function extractAllResponses(page: Page): Promise<ExtractionResult> {
    await page.bringToFront().catch(() => {});
    logger.info("Starting extraction of all responses from NotebookLM");

    // 1. Wait for NotebookLM interface to load
    await page.waitForSelector(CHAT_INPUT_SELECTOR, { timeout: 45_000 }).catch(() => {
        logger.warn("Chat input selector not found within initial timeout, checking for response elements");
    });
    await page.locator(COPY_BUTTON_SELECTOR).first().waitFor({ state: "attached", timeout: 30_000 }).catch(() => logger.warn("No copy button appeared within 30s"));

    // 2. Wait for any in-flight response generation
    await waitForResponseGenerationToFinish(page);

    const count = await waitForStableCount(page, COPY_BUTTON_SELECTOR);
    logger.info(`Detected ${count} copy buttons (responses)`);

    if (count === 0) {
        logger.warn("Zero responses", { url: page.url(), title: await page.title().catch(() => ""), docViewers: await page.locator(RESPONSE_DOC_SELECTOR).count(), viewport: page.viewportSize() });
        return {
            responses: [],
            mergedText: "",
            count: 0
        };
    }

    await installClipboardCapture(page);
    const buttons = page.locator(COPY_BUTTON_SELECTOR);
    const responses: string[] = [];

    for (let i = 0; i < count; i++) {
        try {
            const markdown = await copyResponseMarkdown(page, buttons.nth(i), i);

            if (markdown.length > 0) {
                responses.push(markdown);
            } else {
                logger.warn(`Response at index ${i} was empty after copying`);
            }
        } catch (err) {
            logger.error(`Failed to extract response at index ${i}`, { error: err });
            throw new Error(`Failed to extract response #${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    const mergedText = formatMergedResponses(responses);

    logger.info(`Successfully extracted ${responses.length} responses`, {
        totalCharacters: mergedText.length
    });

    return {
        responses,
        mergedText,
        count: responses.length
    };
}

