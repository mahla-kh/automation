import { NextRequest, NextResponse } from "next/server";
import { noteBookService } from "@/server/services/noteBook.service";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            noteBookUrl,
            promptTitle,
            promptText,
            promptType,
            questionsLength,
            qLength,
            batch,
            topics
        } = body;

        if (!noteBookUrl || typeof noteBookUrl !== "string") {
            return NextResponse.json(
                { error: "Notebook URL is required" },
                { status: 400 }
            );
        }

        if (!promptTitle || typeof promptTitle !== "string") {
            return NextResponse.json(
                { error: "A prompt title must be selected" },
                { status: 400 }
            );
        }

        const mode = promptType === "jozve" ? "jozve" : "question";

        if (mode === "jozve") {
            if (!Array.isArray(topics) || topics.length === 0 || topics.every(t => !t || !t.trim())) {
                return NextResponse.json(
                    { error: "At least one valid topic is required for Jozve Mode" },
                    { status: 400 }
                );
            }
        } else {
            const finalQLength = Number(questionsLength ?? qLength ?? 100);
            const finalBatch = Number(batch ?? 15);
            if (isNaN(finalQLength) || finalQLength <= 0 || isNaN(finalBatch) || finalBatch <= 0) {
                return NextResponse.json(
                    { error: "Valid questions length and batch size are required for Question Mode" },
                    { status: 400 }
                );
            }
        }

        const jobData = await noteBookService.start({
            noteBookUrl,
            promptTitle,
            promptText,
            promptType: mode,
            batch: Number(batch ?? 15),
            qLength: Number(questionsLength ?? qLength ?? 100),
            topics: Array.isArray(topics) ? topics.filter(t => t && t.trim()) : undefined
        });

        return NextResponse.json({
            success: true,
            jobId: jobData.jobId
        });
    } catch (error) {
        console.error("Notebook start error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Notebook request failed" },
            { status: 500 }
        );
    }
}