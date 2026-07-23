import { chromium } from "playwright";

console.log("Login script started");
async function login() {

const context = await chromium.launchPersistentContext(
    "./chrome-profile",
    {
        headless: false,
        executablePath:
            // "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Users\\AsiaLapTop.com\\Desktop\\mahla - Chrome.lnk"
    }
);

    // const context = await browser.newContext();
const page = await context.newPage();

    await page.goto(
"https://google.com", {
  waitUntil: "domcontentloaded",
  timeout: 240000,
}
);

console.log("Login finished?");

await page.waitForTimeout(600000);

await page.pause();

await context.storageState({

path:"auth/auth.json"

});

await context.close();

}

login()