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

// 设置今天下午18:00作为目标时间 (UTC+8)
async function getTodayAt18() {
  // 初始化时间同步
  await initTimeSync();

  // 创建UTC+8时区的今天18:00目标时间
  const targetTime = createTargetTimeUTC8(18, 0, 0);

  // 获取当前校准后的时间
  const now = getAdjustedTime();

  // 日志记录
  const logger = getRunLogger("time");
  logger.info(`当前Binance校准时间: ${formatToUTC8(new Date(now))}`);
  logger.info(`目标执行时间: ${formatToUTC8(targetTime)} (UTC+8)`);

  // 这里不需要额外检查，因为createTargetTimeUTC8函数已经处理了时间调整
  // 如果有警告日志，就记录一下更详细的信息
  if (targetTime.getTime() > now + 24 * 60 * 60 * 1000) {
    logger.info(`已经自动调整为明天的目标时间: ${formatToUTC8(targetTime)}`);
  }

  // 显示等待时间
  const waitTimeSeconds = Math.floor((targetTime.getTime() - now) / 1000);
  const waitTimeHours = Math.floor(waitTimeSeconds / 3600);
  const waitTimeMinutes = Math.floor((waitTimeSeconds % 3600) / 60);
  logger.info(`距离执行时间还有: ${waitTimeHours}小时${waitTimeMinutes}分钟`);

  return targetTime;
}

// 运行下单程序
async function run() {
  const logger = getRunLogger("today");
  try {
    const price = "0.6"; // 价格设置为0.6
    const quantity = "4990"; // 数量设置为5000
    const targetTime = await getTodayAt18();

    logger.info("======== RED USDT 限价单下单程序 ========");
    logger.info(`设置价格: ${price} USDT`);
    logger.info(`设置数量: ${quantity} RED`);
    logger.info(`目标时间: ${formatToUTC8(targetTime)} (UTC+8)`);
    logger.info(`当前校准时间: ${formatToUTC8(getAdjustedDate())}`);
    logger.info("=======================================");

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

// 如果直接运行此文件，则执行run函数
if (require.main === module) {
  run()
    .catch((error) => {
      const logger = getRunLogger("error");
      logger.error(`执行过程中出错: ${error}`);
    })
    .finally(() => {
      // 确保在程序结束时关闭所有日志文件
      closeAllLoggers();
    });
}

export { run };
