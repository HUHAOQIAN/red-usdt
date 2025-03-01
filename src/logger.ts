import fs from "fs";
import path from "path";

/**
 * 日志类型枚举
 */
enum LogType {
  ORDER = "order", // 订单相关操作
  TEST = "test", // 测试相关操作
  RUN = "run", // 运行脚本相关操作
  SYSTEM = "system", // 系统操作
}

/**
 * 日志管理器 - 单例模式
 */
class LogManager {
  private static instance: LogManager;
  private loggers: Map<string, Logger> = new Map();

  private constructor() {}

  /**
   * 获取日志管理器实例
   */
  public static getInstance(): LogManager {
    if (!LogManager.instance) {
      LogManager.instance = new LogManager();
    }
    return LogManager.instance;
  }

  /**
   * 获取指定类型的日志记录器
   * @param type 日志类型
   */
  public getLogger(type: LogType): Logger {
    if (!this.loggers.has(type)) {
      this.loggers.set(type, new Logger(type));
    }
    return this.loggers.get(type) as Logger;
  }

  /**
   * 关闭所有日志记录器
   */
  public closeAll() {
    this.loggers.forEach((logger) => logger.close());
    this.loggers.clear();
  }
}

/**
 * 简单的日志类，将日志输出到控制台和文件
 */
class Logger {
  private logFile: string;
  private logStream: fs.WriteStream | null = null;
  private readonly type: string;

  /**
   * 创建一个日志记录器
   * @param type 日志类型
   */
  constructor(type: string) {
    this.type = type;

    // 确保日志目录存在
    const logDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // 设置日志文件路径 - 使用当天日期作为文件名的一部分
    const dateStr = this.getDateString();
    this.logFile = path.join(logDir, `${type}_${dateStr}.log`);

    // 打开文件流
    this.openLogStream();
  }

  /**
   * 打开日志文件流
   */
  private openLogStream() {
    try {
      this.logStream = fs.createWriteStream(this.logFile, { flags: "a" });
      this.info(`====== 日志会话开始 ======`);
    } catch (error) {
      console.error(`无法创建日志文件: ${error}`);
    }
  }

  /**
   * 获取当前日期字符串(YYYYMMDD)
   */
  private getDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}${month}${day}`;
  }

  /**
   * 获取当前时间戳字符串
   */
  private getTimeString(): string {
    const now = new Date();
    return now.toISOString();
  }

  /**
   * 写入日志
   * @param level 日志级别
   * @param message 日志消息
   * @param module 模块名称
   */
  private log(level: string, message: string | any, module?: string) {
    const timeStr = this.getTimeString();
    const logMessage =
      typeof message === "string" ? message : JSON.stringify(message, null, 2);

    const modulePrefix = module ? `[${module}] ` : "";
    const formattedMessage = `[${timeStr}] [${level}] ${modulePrefix}${logMessage}`;

    // 输出到控制台
    console.log(formattedMessage);

    // 写入文件
    if (this.logStream) {
      this.logStream.write(formattedMessage + "\n");
    }
  }

  /**
   * 记录信息日志
   * @param message 日志消息
   * @param module 模块名称
   */
  info(message: string | any, module?: string) {
    this.log("INFO", message, module);
  }

  /**
   * 记录警告日志
   * @param message 日志消息
   * @param module 模块名称
   */
  warn(message: string | any, module?: string) {
    this.log("WARN", message, module);
  }

  /**
   * 记录错误日志
   * @param message 日志消息
   * @param module 模块名称
   */
  error(message: string | any, module?: string) {
    this.log("ERROR", message, module);
  }

  /**
   * 记录成功日志
   * @param message 日志消息
   * @param module 模块名称
   */
  success(message: string | any, module?: string) {
    this.log("SUCCESS", message, module);
  }

  /**
   * 关闭日志文件
   */
  close() {
    if (this.logStream) {
      this.info(`====== 日志会话结束 ======`);
      this.logStream.end();
      this.logStream = null;
    }
  }
}

// 导出日志类型
export { LogType };

/**
 * 获取订单操作日志记录器
 * @param module 可选的模块名，用于在日志中标识不同的子模块
 */
export function getOrderLogger(module?: string): Logger {
  const logger = LogManager.getInstance().getLogger(LogType.ORDER);
  return {
    info: (message: string | any) => logger.info(message, module),
    warn: (message: string | any) => logger.warn(message, module),
    error: (message: string | any) => logger.error(message, module),
    success: (message: string | any) => logger.success(message, module),
    close: () => {}, // 不再每次调用都关闭日志
  } as Logger;
}

/**
 * 获取测试操作日志记录器
 * @param module 可选的模块名，用于在日志中标识不同的测试方法
 */
export function getTestLogger(module?: string): Logger {
  const logger = LogManager.getInstance().getLogger(LogType.TEST);
  return {
    info: (message: string | any) => logger.info(message, module),
    warn: (message: string | any) => logger.warn(message, module),
    error: (message: string | any) => logger.error(message, module),
    success: (message: string | any) => logger.success(message, module),
    close: () => {}, // 不再每次调用都关闭日志
  } as Logger;
}

/**
 * 获取运行脚本日志记录器
 * @param module 可选的模块名，用于在日志中标识不同的运行脚本
 */
export function getRunLogger(module?: string): Logger {
  const logger = LogManager.getInstance().getLogger(LogType.RUN);
  return {
    info: (message: string | any) => logger.info(message, module),
    warn: (message: string | any) => logger.warn(message, module),
    error: (message: string | any) => logger.error(message, module),
    success: (message: string | any) => logger.success(message, module),
    close: () => {}, // 不再每次调用都关闭日志
  } as Logger;
}

/**
 * 获取系统日志记录器
 */
export function getSystemLogger(): Logger {
  return LogManager.getInstance().getLogger(LogType.SYSTEM);
}

/**
 * 关闭所有日志记录器 - 应用程序退出前调用
 */
export function closeAllLoggers() {
  LogManager.getInstance().closeAll();
}

// 兼容旧代码的API
export function createLogger(name: string): Logger {
  if (name.startsWith("order")) {
    return getOrderLogger(name);
  } else if (name.startsWith("test")) {
    return getTestLogger(name);
  } else if (name.startsWith("run")) {
    return getRunLogger(name);
  } else {
    return getSystemLogger();
  }
}

export function createTestLogger(methodName: string): Logger {
  return getTestLogger(methodName);
}

export function createRunLogger(): Logger {
  return getRunLogger();
}

// 为了兼容性，保留默认导出
export default Logger;
