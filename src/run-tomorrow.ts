import { main } from "./order";
import fs from "fs";
import { getRunLogger, closeAllLoggers } from "./logger";
import {
  initTimeSync,
  createTargetTimeUTC8,
  getAdjustedTime,
  getAdjustedDate,
  formatToUTC8,
} from "../utils/timeSync";

// 设置明天下午18:00作为目标时间 (UTC+8)
async function getTomorrowAt18() {
  // 初始化时间同步
  await initTimeSync();

  // 创建UTC+8时区的明天18:00目标时间 (days=1表示明天)
  const targetTime = createTargetTimeUTC8(18, 0, 1);

  // 获取当前校准后的时间
  const now = getAdjustedTime();

  // 日志记录
  const logger = getRunLogger("time");
  logger.info(`当前Binance校准时间: ${formatToUTC8(new Date(now))}`);
  logger.info(`目标执行时间: ${formatToUTC8(targetTime)} (UTC+8)`);

  return targetTime;
}

// 运行下单程序
async function runTomorrow() {
  const logger = getRunLogger("tomorrow");
  try {
    const price = "0.8"; // 明天价格设置为0.8
    const quantity = "5000"; // 数量设置为5000
    const targetTime = await getTomorrowAt18();

    logger.info("======== RED USDT 限价单下单程序（明天） ========");
    logger.info(`设置价格: ${price} USDT`);
    logger.info(`设置数量: ${quantity} RED`);
    logger.info(`目标时间: ${formatToUTC8(targetTime)} (UTC+8)`);
    logger.info(`当前校准时间: ${formatToUTC8(getAdjustedDate())}`);
    logger.info("============================================");

    // 读取所有账户
    const accounts = JSON.parse(fs.readFileSync("./apis.json", "utf-8"));
    logger.info(`准备为 ${accounts.length} 个账号下单`);

    // 执行主程序
    await main(price, targetTime, quantity);
    logger.success("下单程序执行完成");
  } catch (error) {
    logger.error(`运行过程中出错: ${error}`);
  }
}

// 如果直接运行此文件，则执行runTomorrow函数
if (require.main === module) {
  runTomorrow()
    .catch((error) => {
      const logger = getRunLogger("error");
      logger.error(`执行过程中出错: ${error}`);
    })
    .finally(() => {
      // 确保在程序结束时关闭所有日志文件
      closeAllLoggers();
    });
}

export { runTomorrow };
