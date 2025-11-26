/**
 * The log level.
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
  OFF = 5
}

/**
 * The options for the logger.
 */
export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  dateFormat?: boolean;
  transport?: Transport[];
}

/**
 * The transport for the logger.
 */
export interface Transport {
  log(level: LogLevel, message: string): void;
}

/**
 * A transport that logs to the console.
 */
export class ConsoleTransport implements Transport {
  log(level: LogLevel, message: string): void {
    const methods = {
      [LogLevel.DEBUG]: console.debug,
      [LogLevel.INFO]: console.info,
      [LogLevel.WARN]: console.warn,
      [LogLevel.ERROR]: console.error,
      [LogLevel.FATAL]: console.error,
      [LogLevel.OFF]: () => {}
    };
    const method = methods[level] || console.log;
    method(message);
  }
}

/**
 * A logger that can log to multiple transports.
 */
export class Logger {
  protected level: LogLevel;
  protected prefix: string;
  protected dateFormat: boolean;
  protected transports: Transport[];

  /**
   * Creates an instance of the Logger.
   * @param options - The options for the logger.
   */
  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.prefix = options.prefix ?? '';
    this.dateFormat = options.dateFormat ?? true;
    this.transports = options.transport ?? [new ConsoleTransport()];
  }

  /**
   * Sets the log level.
   * @param level - The new log level.
   * @returns The logger instance.
   */
  public setLevel(level: LogLevel): this {
    this.level = level;
    return this;
  }

  /**
   * Sets the prefix for log messages.
   * @param prefix - The new prefix.
   * @returns The logger instance.
   */
  public setPrefix(prefix: string): this {
    this.prefix = prefix;
    return this;
  }

  /**
   * Adds a transport to the logger.
   * @param transport - The transport to add.
   * @returns The logger instance.
   */
  public addTransport(transport: Transport): this {
    this.transports.push(transport);
    return this;
  }

  /**
   * Formats a log message.
   * @param level - The log level.
   * @param message - The message to format.
   * @returns The formatted message.
   */
  protected formatMessage(level: LogLevel, message: string): string {
    const levelNames = {
      [LogLevel.DEBUG]: 'DEBUG',
      [LogLevel.INFO]: 'INFO',
      [LogLevel.WARN]: 'WARN',
      [LogLevel.ERROR]: 'ERROR',
      [LogLevel.FATAL]: 'FATAL',
      [LogLevel.OFF]: 'OFF'
    };

    let formattedMessage = '';

    if (this.dateFormat) {
      formattedMessage += `[${new Date().toLocaleString()}] `;
    }

    formattedMessage += `[${levelNames[level] || 'UNKNOWN'}] `;

    if (this.prefix) {
      formattedMessage += `[${this.prefix}] `;
    }

    formattedMessage += message;

    return formattedMessage;
  }

  /**
   * Logs a message.
   * @param level - The log level.
   * @param message - The message to log.
   * @param args - Additional arguments to log.
   */
  protected log(level: LogLevel, message: string | Error, ...args: any[]): void {
    if (level < this.level) {
      return;
    }

    let finalMessage: string;

    if (message instanceof Error) {
      finalMessage = `${message.message}\n${message.stack}`;
    } else {
      finalMessage = message;
    }

    if (args.length > 0) {
      finalMessage += ' ' + args.map(arg => {
        if (arg == null || arg == undefined) {
          return arg + '';
        } else if (arg instanceof Error || (arg.stack && arg.message)) {
          return `${arg.message}\n${arg.stack}`;
        } else if (typeof arg === 'object') {
          return JSON.stringify(arg);
        }
        return String(arg);
      }).join(' ');
    }

    const formattedMessage = this.formatMessage(level, finalMessage);

    this.transports.forEach(transport => {
      transport.log(level, formattedMessage);
    });
  }

  /**
   * Checks if the debug log level is enabled.
   * @returns True if the debug log level is enabled, false otherwise.
   */
  public isEnableDebug() {
    return this.level <= LogLevel.DEBUG;
  }

  /**
   * Logs a debug message.
   * @param message - The message to log.
   * @param args - Additional arguments to log.
   */
  public debug(message: string | Error, ...args: any[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  /**
   * Checks if the info log level is enabled.
   * @returns True if the info log level is enabled, false otherwise.
   */
  public isEnableInfo() {
    return this.level <= LogLevel.INFO;
  }

  /**
   * Logs an info message.
   * @param message - The message to log.
   * @param args - Additional arguments to log.
   */
  public info(message: string | Error, ...args: any[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  /**
   * Logs a warning message.
   * @param message - The message to log.
   * @param args - Additional arguments to log.
   */
  public warn(message: string | Error, ...args: any[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  /**
   * Logs an error message.
   * @param message - The message to log.
   * @param args - Additional arguments to log.
   */
  public error(message: string | Error, ...args: any[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }

  /**
   * Logs a fatal message.
   * @param message - The message to log.
   * @param args - Additional arguments to log.
   */
  public fatal(message: string | Error, ...args: any[]): void {
    this.log(LogLevel.FATAL, message, ...args);
  }

  /**
   * Creates a child logger.
   * @param name - The name of the child logger.
   * @param options - The options for the child logger.
   * @returns The child logger.
   */
  public createChild(name: string, options: Partial<LoggerOptions> = {}): Logger {
    const childPrefix = this.prefix ? `${this.prefix}.${name}` : name;
    
    return new Logger({
      level: options.level || this.level,
      prefix: childPrefix,
      dateFormat: options.dateFormat !== undefined ? options.dateFormat : this.dateFormat,
      transport: options.transport || this.transports
    });
  }
}

const Log = new Logger();

export default Log;
