import { logger } from "@/server/lib/logger";
import { Page } from "playwright-core";
import { expect } from "playwright/test";
const ADD_SOURCE_DIALOG = "add-sources-dialog"
const CREATE_BTN_SELECTOR = 'button[aria-label="Add source"]';
const ADDFILE_BTN_SELECTOR = "button[xapscottyuploadertrigger]";

export async function uploadToNotebook(page: Page, outputName: string): Promise<void> {

    await page.waitForSelector(CREATE_BTN_SELECTOR, { timeout: 30_000 });
    // await page.fill(CHAT_INPUT_SELECTOR, prompt);
    const CRbtn = page.locator(CREATE_BTN_SELECTOR);
    const addSourceDialog = page.locator(ADD_SOURCE_DIALOG);
    if(!addSourceDialog.isVisible()) {
        await expect(CRbtn).toBeEnabled({
            timeout: 120000,
        });
        await CRbtn.click();
    }
    const ADDbtn = page.locator(ADDFILE_BTN_SELECTOR);


    const fileChooserPromise = page.waitForEvent('filechooser');

await ADDbtn.click();

const fileChooser = await fileChooserPromise;

await fileChooser.setFiles(`output/${outputName}/01_raw.md`);
    await page.click(CREATE_BTN_SELECTOR);

    logger.info("Source added to notebook");
}