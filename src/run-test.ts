import { main } from "./order";
import fs from "fs";
import { getRunLogger, closeAllLoggers } from "./logger";

// 获取特定账号或所有账号
function getAccounts(accountIndex?: number) {
  const accounts = JSON.parse(fs.readFileSync("./apis.json", "utf-8"));

  if (accountIndex !== undefined) {
    if (accountIndex < 0 || accountIndex >= accounts.length) {
      console.error(
        `错误: 账号索引 ${accountIndex} 超出范围 (0-${accounts.length - 1})`
      );
      return [];
    }
    return [accounts[accountIndex]];
  }

  return accounts;
}

// 运行测试函数 - 完全自定义时间、价格和数量
async function runTest(options: {
  price?: string;
  quantity?: string;
  delaySeconds?: number;
  accountIndex?: number;
}) {
  const logger = getRunLogger("test");
  try {
    // 设置默认值
    const price = options.price || "0.6";
    const quantity = options.quantity || "100";
    const delaySeconds = options.delaySeconds || 30;

    // 设置目标时间为当前时间加上指定的延迟秒数
    const targetTime = new Date(Date.now() + delaySeconds * 1000);

    // 获取账号
    const accounts = getAccounts(options.accountIndex);
    if (accounts.length === 0) {
      logger.error("没有找到有效账号");
      return;
    }

    logger.info("\n======== RED USDT 限价单测试程序 ========");
    logger.info(`设置价格: ${price} USDT`);
    logger.info(`设置数量: ${quantity} RED`);
    logger.info(`测试账号数量: ${accounts.length}`);
    logger.info(
      `目标时间: ${targetTime.toLocaleString()} (当前时间 + ${delaySeconds}秒)`
    );
    logger.info("==========================================");

    // 执行主程序
    await main(price, targetTime, quantity, accounts);
    logger.success("\n测试完成!");
  } catch (error) {
    logger.error(`测试过程中出错: ${error}`);
  }
}

// 主函数 - 解析命令行参数
async function start() {
  const logger = getRunLogger("start");
  try {
    const args = process.argv.slice(2);
    let options: {
      price?: string;
      quantity?: string;
      delaySeconds?: number;
      accountIndex?: number;
    } = {};

    // 解析参数
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--price" && i + 1 < args.length) {
        options.price = args[i + 1];
        i++;
        logger.info(`设置价格: ${options.price}`);
      } else if (args[i] === "--quantity" && i + 1 < args.length) {
        options.quantity = args[i + 1];
        i++;
        logger.info(`设置数量: ${options.quantity}`);
      } else if (args[i] === "--delay" && i + 1 < args.length) {
        options.delaySeconds = parseInt(args[i + 1]);
        i++;
        logger.info(`设置延迟秒数: ${options.delaySeconds}`);
      } else if (args[i] === "--account" && i + 1 < args.length) {
        options.accountIndex = parseInt(args[i + 1]);
        i++;
        logger.info(`设置账号索引: ${options.accountIndex}`);
      } else if (args[i] === "--help") {
        showHelp();
        return;
      }
    }

    logger.info("准备运行测试...");
    // 运行测试
    await runTest(options);
  } catch (error) {
    logger.error(`启动测试过程中出错: ${error}`);
  }
}

// 显示帮助信息
function showHelp() {
  const logger = getRunLogger("help");
  logger.info("使用方法:");
  logger.info("  ts-node src/run-test.ts [选项]");
  logger.info("\n可用选项:");
  logger.info("  --price <价格>      - 设置买入价格 (默认: 0.6)");
  logger.info("  --quantity <数量>   - 设置买入数量 (默认: 100)");
  logger.info("  --delay <秒数>      - 设置延迟执行的秒数 (默认: 30)");
  logger.info(
    "  --account <账号索引> - 指定使用特定账号索引 (默认: 使用所有账号)"
  );
  logger.info("  --help              - 显示帮助信息");
  logger.info("\n示例:");
  logger.info("  测试所有账号, 价格0.8, 数量200, 延迟10秒:");
  logger.info(
    "  ts-node src/run-test.ts --price 0.8 --quantity 200 --delay 10"
  );
  logger.info("\n  测试第0个账号, 价格0.7:");
  logger.info("  ts-node src/run-test.ts --account 0 --price 0.7");
}

// 如果直接运行此文件，则执行start函数
if (require.main === module) {
  start()
    .catch((error) => {
      const logger = getRunLogger("error");
      logger.error(`执行过程中出错: ${error}`);
    })
    .finally(() => {
      // 确保在程序结束时关闭所有日志文件
      closeAllLoggers();
    });
}

export { runTest };
