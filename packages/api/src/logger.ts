/**
 * Simple structured logger for the API package
 * Can be extended with proper logging services (e.g., Sentry, DataDog) in the future
 */

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

export class Logger {
  constructor(private context: string) {}

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      context: this.context,
      message,
      ...(meta && { meta }),
    };
    console.log(JSON.stringify(logEntry));
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.log(LogLevel.DEBUG, message, meta);
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.log(LogLevel.INFO, message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.log(LogLevel.WARN, message, meta);
  }

  error(message: string, meta?: Record<string, unknown>) {
    this.log(LogLevel.ERROR, message, meta);
  }
}
