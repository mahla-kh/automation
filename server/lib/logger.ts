type LogLevel = "INFO" | "WARN" | "ERROR";

function log(level: LogLevel, message: string, data?: unknown) {
  const time = new Date().toISOString();

  console.log(
    `[${time}] [${level}] ${message}`,
    data ?? ""
  );
}

export const logger = {

  info(message: string, data?: unknown) {
    log("INFO", message, data);
  },

  warn(message: string, data?: unknown) {
    log("WARN", message, data);
  },

  error(message: string, data?: unknown) {
    log("ERROR", message, data);
  }

}