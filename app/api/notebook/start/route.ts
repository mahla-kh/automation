import { NextRequest, NextResponse } from "next/server";
import { noteBookService } from "@/server/services/noteBook.service";
import { resolveStartpoint, resolveQuestionsLength } from "@/server/services/batchRanges";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            noteBookUrl,
            subject,
            folderName,
            promptTitle,
            promptText,
            promptType,
            questionsLength,
            qLength,
            batch,
            startpoint,
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
        let finalQLength = 0;
        let finalStartpoint = 1;

        if (mode === "jozve") {
            if (!Array.isArray(topics) || topics.length === 0 || topics.every(t => !t || !t.trim())) {
                return NextResponse.json(
                    { error: "At least one valid topic is required for Jozve Mode" },
                    { status: 400 }
                );
            }
        } else {
            try {
                finalQLength = resolveQuestionsLength(questionsLength ?? qLength);
            } catch (err) {
                return NextResponse.json(
                    { error: err instanceof Error ? err.message : String(err) },
                    { status: 400 }
                );
            }
            const finalBatch = Number(batch ?? 15);
            if (isNaN(finalBatch) || finalBatch <= 0) {
                return NextResponse.json(
                    { error: "Valid batch size is required for Question Mode" },
                    { status: 400 }
                );
            }
            try {
                finalStartpoint = resolveStartpoint(startpoint);
            } catch (err) {
                return NextResponse.json(
                    { error: err instanceof Error ? err.message : String(err) },
                    { status: 400 }
                );
            }
        }

        const jobData = await noteBookService.start({
            noteBookUrl,
            subject: typeof subject === "string" ? subject.trim() : undefined,
            folderName: typeof folderName === "string" ? folderName.trim() : undefined,
            promptTitle,
            promptText,
            promptType: mode,
            batch: Number(batch ?? 15),
            qLength: finalQLength,
            startpoint: finalStartpoint,
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