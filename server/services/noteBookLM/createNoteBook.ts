import { logger } from "@/server/lib/logger";
import { Page } from "playwright-core";
import { expect } from "playwright/test";

const CREATE_BTN_SELECTOR = "button[aria-label='Create new notebook']";

export async function createNoteBook(page: Page): Promise<void> {

    await page.waitForSelector(CREATE_BTN_SELECTOR, { timeout: 30_000 });
    // await page.fill(CHAT_INPUT_SELECTOR, prompt);
    const btn = page.locator(CREATE_BTN_SELECTOR);

await expect(btn).toBeEnabled({
    timeout: 120000,
});

await btn.click();
    await page.click(CREATE_BTN_SELECTOR);

    logger.info("note book created");
}