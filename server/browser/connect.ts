import { Page } from "playwright";
import { logger } from "../lib/logger";
import { expect } from "playwright/test";
import { browserManager } from "./browserManager";

/**
 * Retrieves a new Page from the managed persistent browser context.
 * Note: Callers should prefer using `browserManager.withPage(fn)` for automatic
 * concurrency control and guaranteed page cleanup.
 */
export async function connectChrome(): Promise<Page> {
    return browserManager.newPage();
}


// NOTE: NotebookLM's DOM is not versioned/public — these selectors are best
// guesses and WILL need to be confirmed/updated against the live page
// (inspect notebooklm.google.com and adjust before relying on this in prod).
const CHAT_INPUT_SELECTOR = "textarea[aria-label='Query box']";
const SEND_BUTTON_SELECTOR = "button[aria-label='Submit']:not([disabled])";
// const SEND_BUTTON_SELECTOR = "button[type='Submit']";
// const LAST_RESPONSE_SELECTOR = "labs-tailwind-doc-viewer:last-of-type";

export async function sendPromptToPage(page: Page, prompt: string): Promise<void> {

    await page.waitForSelector(CHAT_INPUT_SELECTOR, { timeout: 30_000 });
    // await page.fill(CHAT_INPUT_SELECTOR, prompt);
    const input = page.locator(CHAT_INPUT_SELECTOR);

await expect(input).toBeEnabled({
    timeout: 120000,
});

await input.fill(prompt);
    await page.click(SEND_BUTTON_SELECTOR);

    logger.info("Prompt sent to NotebookLM", { promptLength: prompt.length });
}

// export async function getAnswer(page: Page): Promise<string> {
//     const LAST_RESPONSE_SELECTOR = "mat-card-content :last-of-type";
//     // const STOP_GENERATING_SELECTOR = "button[aria-label='Stop generating']";
//     const DISABLED_BTN_SELECTOR = "button[mat-ripple-loader-disabled]";

//     // ۱. منتظر بمان تا دکمه disabled تولید ظاهر شود (نشانه اتمام تولید)
//     await page.waitForSelector(DISABLED_BTN_SELECTOR, { timeout: 180_000 });

//     // ۴. دریافت متن آخرین پاسخ
//     const lastResponse = page.locator(LAST_RESPONSE_SELECTOR).last();
//     const text = await lastResponse.innerText();

//     logger.info("Answer retrieved", { length: text.length });
//     return text;
// }

export async function getAnswer(page: Page): Promise<string> {
    const LAST_RESPONSE_SELECTOR = "labs-tailwind-doc-viewer:last-of-type";
    // سلکتور دقیق دکمه‌ای که حین تولید پاسخ به "Stop" تبدیل می‌شود
    const STOP_GENERATING_SELECTOR = "button[aria-label='Stop generating']";

    // ۱. اول مطمئن شو تولید واقعاً شروع شده (دکمه Stop ظاهر شده)
    await page.waitForSelector(STOP_GENERATING_SELECTOR, { timeout: 30_000 });

    // ۲. بعد منتظر بمان همان دکمه از DOM حذف/غیرفعال شود (پایان تولید)
    await page.waitForSelector(STOP_GENERATING_SELECTOR, {
        state: "detached", // یا "hidden"
        timeout: 180_000,
    });

    // ۳. برای اطمینان بیشتر، تثبیت متن را هم چک کن (polling)
    const lastResponse = page.locator(LAST_RESPONSE_SELECTOR).last();
    let prevText = "";
    for (let i = 0; i < 5; i++) {
        const current = await lastResponse.innerText();
        if (current === prevText && current.length > 0) break;
        prevText = current;
        await page.waitForTimeout(700);
    }

    logger.info("Answer retrieved", { length: prevText.length });
    return prevText;
}

// import { promises as fs } from "fs";
// import path from "path";

export async function exportAnswers(
    page: Page,
): Promise<string> {

    const SELECTOR = "labs-tailwind-doc-viewer";

    await page.waitForSelector(SELECTOR);

    const texts = await page.locator(SELECTOR).allInnerTexts();

    const cleaned = texts
        .map(t => t.trim())
        .filter(Boolean)
        .join("\n\n----------------------------------------\n\n");

    // await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // await fs.writeFile(outputPath, cleaned, "utf8");

    console.log(`Saved ${texts.length} items to `);
    return cleaned;
}