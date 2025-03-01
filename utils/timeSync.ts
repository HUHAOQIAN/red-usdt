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

    logger.info(`Binance服务器时间: ${new Date(serverTime).toISOString()}`);
    logger.info(`本地时间: ${new Date(localTime).toISOString()}`);
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
 * 创建指定小时、分钟的UTC+8目标时间
 * @param hours 小时 (0-23)
 * @param minutes 分钟 (0-59)
 * @param days 距今天的天数，0表示今天，1表示明天，以此类推
 * @returns 目标时间的时间戳（毫秒）
 */
export function createTargetTimeUTC8(
  hours: number,
  minutes: number,
  days: number = 0
): Date {
  // 获取当前准确时间
  const now = getAdjustedDate();

  // 创建今天的UTC+8目标时间
  const targetDate = new Date(now);

  // 调整到UTC+8时区（提前8小时，因为JS的Date对象是基于本地时区的）
  targetDate.setHours(hours);
  targetDate.setMinutes(minutes);
  targetDate.setSeconds(0);
  targetDate.setMilliseconds(0);

  // 如果需要，调整到未来的某一天
  if (days > 0) {
    targetDate.setDate(targetDate.getDate() + days);
  } else if (days === 0 && now.getTime() > targetDate.getTime()) {
    // 如果今天的目标时间已经过了，调整到明天
    targetDate.setDate(targetDate.getDate() + 1);
  }

  return targetDate;
}

/**
 * 初始化时间同步（在程序启动时调用一次）
 */
export async function initTimeSync(): Promise<void> {
  await getBinanceServerTime();
}
