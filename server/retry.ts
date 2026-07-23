import { logger } from "./lib/logger";

type RetryOptions = {

    retries: number;

    delay: number;

    factor: number;

    shouldRetry?: (error: unknown) => boolean;

};

function ShouldRetry(error:unknown):boolean {
 if (!(error instanceof Error)) return false;

    const message = error.message;

    return (
        message.includes("ECONNRESET") ||
        message.includes("UND_ERR_SOCKET") ||
        message.includes("fetch failed") ||
        message.includes("429") ||
        message.includes("500") ||
        message.includes("503")
    );

}


function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function retry<T>(

    task: () => Promise<T>,

    options: Partial<RetryOptions> = {}

): Promise<T> {

    const {

        retries = 3,

        delay = 2000,

        factor = 2,

        shouldRetry = ShouldRetry

    } = options;

    let currentDelay = delay;

    let lastError: unknown;

    for (let attempt = 1; attempt <= retries; attempt++) {

        try {

            return await task();

        }

        catch (error) {

            lastError = error;

            if (!shouldRetry(error)) {
                console.log("Not retrying due to error:", error)
                throw error;

            }

            logger.warn("Retry attempt failed", {

                attempt,
                

                retries,

                delay: currentDelay,

                error

            });

            if (attempt < retries) {

                await sleep(currentDelay);

                currentDelay *= factor;

            }

        }

    }

    throw lastError;

}