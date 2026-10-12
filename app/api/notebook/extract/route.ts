import { NextRequest, NextResponse } from "next/server";
import { browserManager } from "@/server/browser/browserManager";
import { extractAllResponses } from "@/server/browser/connect";
import { logger } from "@/server/lib/logger";

function isValidNotebookUrl(url: string): boolean {
    return true
    // try {
    //     const parsed = new URL(url);
    //     return (
    //         parsed.hostname.includes("notebooklm.google") &&
    //         parsed.pathname.includes("/notebook/")
    //     );
    // } catch {
    //     return false;
    // }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { noteBookUrl } = body;

        if (!noteBookUrl || typeof noteBookUrl !== "string") {
            return NextResponse.json(
                { error: "NotebookLM URL is required." },
                { status: 400 }
            );
        }

        const trimmedUrl = noteBookUrl.trim();
        if (!isValidNotebookUrl(trimmedUrl)) {
            return NextResponse.json(
                { error: "Invalid NotebookLM URL. Expected format: https://notebooklm.google.com/notebook/..." },
                { status: 400 }
            );
        }

        logger.info("Starting standalone NotebookLM answer extraction", { url: trimmedUrl });

        const result = await browserManager.withPage(async (page) => {
            logger.info("Navigating to NotebookLM notebook for extraction", { url: trimmedUrl });
            await page.goto(trimmedUrl, { timeout: 180_000 });

            return await extractAllResponses(page);
        });

        if (result.count === 0) {
            return NextResponse.json({
                success: true,
                count: 0,
                responses: [],
                mergedText: "",
                message: "No NotebookLM responses were found."
            });
        }

        return NextResponse.json({
            success: true,
            count: result.count,
            responses: result.responses,
            mergedText: result.mergedText
        });

    } catch (error) {
        logger.error("Standalone NotebookLM extraction failed", { error });
        const message = error instanceof Error ? error.message : "Failed to extract answers from NotebookLM";
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
