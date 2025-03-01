import axios from "axios";
import { getSystemLogger } from "../src/logger";

// 时间偏差值，单位：毫秒
let timeOffset = 0;

/**
 * 获取Binance服务器时间
 * @returns 服务器时间戳（毫秒）
 */
export async function getBinanceServerTime(): Promise<number> {
  const logger = getSystemLogger();
  try {
    const response = await axios.get("https://api.binance.com/api/v3/time");
    const serverTime = response.data.serverTime;

    // 计算服务器时间与本地时间的偏差
    const localTime = Date.now();
    timeOffset = serverTime - localTime;

    // 创建UTC+8时区的时间格式化选项
    const options = {
      timeZone: "Asia/Shanghai",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    };

    // 获取格式化后的UTC+8时间字符串
    const serverTimeUTC8 = new Date(serverTime).toLocaleString(
      "zh-CN",
      options as Intl.DateTimeFormatOptions
    );
    const localTimeUTC8 = new Date(localTime).toLocaleString(
      "zh-CN",
      options as Intl.DateTimeFormatOptions
    );

    logger.info(
      `Binance服务器时间 (UTC): ${new Date(serverTime).toISOString()}`
    );
    logger.info(`Binance服务器时间 (UTC+8): ${serverTimeUTC8}`);
    logger.info(`本地时间 (UTC): ${new Date(localTime).toISOString()}`);
    logger.info(`本地时间 (UTC+8): ${localTimeUTC8}`);
    logger.info(`时间偏差: ${timeOffset}毫秒`);

    return serverTime;
  } catch (error) {
    logger.error(`获取Binance服务器时间失败: ${error.message}`);
    throw error;
  }
}

/**
 * 获取当前准确时间（已校准偏差）
 * @returns 校准后的时间戳（毫秒）
 */
export function getAdjustedTime(): number {
  return Date.now() + timeOffset;
}

/**
 * 获取校准后的Date对象
 * @returns 校准后的Date对象
 */
export function getAdjustedDate(): Date {
  return new Date(getAdjustedTime());
}

/**
 * 格式化Date对象为UTC+8时区的显示字符串
 * @param date 日期对象
 * @returns 格式化后的UTC+8时区字符串
 */
export function formatToUTC8(date: Date): string {
  const options = {
    timeZone: "Asia/Shanghai",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  };

  return date.toLocaleString("zh-CN", options as Intl.DateTimeFormatOptions);
}

/**
 * 创建指定小时、分钟的UTC+8目标时间
 * @param hours 小时 (0-23)
 * @param minutes 分钟 (0-59)
 * @param days 距今天的天数，0表示今天，1表示明天，以此类推
 * @returns 目标时间的Date对象
 */
export function createTargetTimeUTC8(
  hours: number,
  minutes: number,
  days: number = 0
): Date {
  // 获取当前校准时间
  const now = getAdjustedDate();

  // 创建目标Date对象
  const targetDate = new Date(now);

  // 计算UTC+8时区与本地时区的偏差（小时）
  // 获取本地时区偏移量（分钟）
  const localOffset = targetDate.getTimezoneOffset();
  // UTC+8的偏移量为-480分钟 (-8小时)
  const targetOffset = -480;
  // 计算本地时区到UTC+8的偏移小时数
  const offsetHours = (targetOffset - localOffset) / 60;

  // 设置目标时间，考虑时区差异
  targetDate.setHours(hours - offsetHours);
  targetDate.setMinutes(minutes);
  targetDate.setSeconds(0);
  targetDate.setMilliseconds(0);

  // 如果需要，调整到未来的某一天
  if (days > 0) {
    targetDate.setDate(targetDate.getDate() + days);
  }

  // 判断是否需要调整到明天
  const nowTime = now.getTime();
  if (days === 0 && nowTime > targetDate.getTime()) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  return targetDate;
}

/**
 * 初始化时间同步（在程序启动时调用一次）
 */
export async function initTimeSync(): Promise<void> {
  const logger = getSystemLogger();
  try {
    await getBinanceServerTime();

    // 输出当前UTC+8时间，用于确认
    const now = getAdjustedDate();
    logger.info(`当前UTC+8时间: ${formatToUTC8(now)}`);

    // 输出系统时区信息
    const tzOffset = now.getTimezoneOffset();
    logger.info(`系统时区偏移: ${tzOffset}分钟 (${tzOffset / -60}小时)`);
  } catch (error) {
    logger.error(`时间同步初始化失败: ${error.message}`);
    throw error;
  }
}
