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

const COPY_BUTTON_LABEL = "Copy model response to clipboard";
const COPY_BUTTON_NAME = /copy model response to clipboard/i;

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
 * Scopes to the ancestor turn container of a given response and locates its unique Copy button.
 */
async function getCopyButtonForResponse(
    response: Locator,
    index: number
): Promise<Locator> {
    const turn = response.locator(
        `xpath=ancestor-or-self::*[.//button[contains(@aria-label,"${COPY_BUTTON_LABEL}")]][1]`
    );

    const buttons = turn.getByRole("button", {
        name: COPY_BUTTON_NAME,
    });

    const n = await buttons.count();

    if (n !== 1) {
        throw new Error(
            `Expected exactly 1 Copy button for response #${index + 1}, found ${n}. ` +
            `The turn wrapper scoping needs adjusting.`
        );
    }

    return buttons;
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

/**
 * Copies the canonical Markdown of a specific response using NotebookLM's Copy button
 * with a sentinel clipboard verification protocol.
 */
async function copyResponseMarkdown(
    page: Page,
    targetResponse: Locator,
    index: number
): Promise<string> {
    const copyButton = await getCopyButtonForResponse(targetResponse, index);

    await copyButton.waitFor({ state: "attached", timeout: 15_000 });
    await copyButton.scrollIntoViewIfNeeded().catch(() => {});

    const sentinel = `__NLM_SENTINEL_${Date.now()}_${index}__`;

    // 1. Write unique sentinel to clipboard before clicking Copy
    await page.evaluate((s) => navigator.clipboard.writeText(s), sentinel);

    // 2. Click the response's Copy button
    await copyButton.click();

    // 3. Poll clipboard until content changes from sentinel
    const POLL_INTERVAL_MS = 200;
    const MAX_POLL_ATTEMPTS = 50; // Up to 10 seconds

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        await page.waitForTimeout(POLL_INTERVAL_MS);

        const clipboardContent = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");

        if (clipboardContent && clipboardContent !== sentinel) {
            // Insignificant line-ending normalization without altering Markdown content
            return clipboardContent.replace(/\r\n/g, "\n").replace(/\n$/, "");
        }
    }

    throw new Error("Clipboard did not change after clicking Copy button (timed out waiting for copied text)");
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
    const markdown = await copyResponseMarkdown(page, targetResponse, turnIndex);

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
    logger.info("Starting extraction of all responses from NotebookLM");

    // 1. Wait for NotebookLM interface to load
    await page.waitForSelector(CHAT_INPUT_SELECTOR, { timeout: 45_000 }).catch(() => {
        logger.warn("Chat input selector not found within initial timeout, checking for response elements");
    });

    // 2. Wait for any in-flight response generation
    await waitForResponseGenerationToFinish(page);

    const responseLocator = page.locator(RESPONSE_DOC_SELECTOR);
    const count = await responseLocator.count();

    logger.info(`Detected ${count} response elements in NotebookLM`);

    if (count === 0) {
        return {
            responses: [],
            mergedText: "",
            count: 0
        };
    }

    const responses: string[] = [];

    for (let i = 0; i < count; i++) {
        const targetResponse = responseLocator.nth(i);

        try {
            await targetResponse.waitFor({ state: "attached", timeout: 15_000 });

            // Ensure generation is complete before extracting this turn
            await waitForResponseGenerationToFinish(page);

            const markdown = await copyResponseMarkdown(page, targetResponse, i);

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

