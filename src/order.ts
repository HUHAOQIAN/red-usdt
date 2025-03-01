import { binanceRequest, BinanceAccountInfo } from "../utils/signature";
import fs from "fs";
import { getOrderLogger, closeAllLoggers } from "./logger";
import {
  getAdjustedTime,
  getAdjustedDate,
  formatToUTC8,
} from "../utils/timeSync";

// 查询当前限价订单
async function queryLimitOrders(account: BinanceAccountInfo) {
  const logger = getOrderLogger("query");
  const endpointPath = "/api/v3/openOrders";
  const method = "GET";
  const timestamp = Date.now().toString();
  const requestBody = {
    symbol: "REDUSDT",
    timestamp: timestamp,
  };
  const params = new URLSearchParams(requestBody);

  logger.info(`${account.name} 查询限价订单`);
  const res = await binanceRequest(account, endpointPath, method, null, params);
  logger.info(`${account.name} 当前限价订单: ${JSON.stringify(res, null, 2)}`);
  return res;
}

// 取消所有限价订单
async function cancelAllLimitOrders(account: BinanceAccountInfo) {
  const logger = getOrderLogger("cancel");
  const endpointPath = "/api/v3/openOrders";
  const method = "DELETE";
  const timestamp = Date.now().toString();
  const requestBody = {
    symbol: "REDUSDT",
    timestamp: timestamp,
  };
  const params = new URLSearchParams(requestBody);

  logger.info(`${account.name} 取消所有限价订单`);
  const res = await binanceRequest(account, endpointPath, method, null, params);
  logger.info(`${account.name} 取消订单结果: ${JSON.stringify(res, null, 2)}`);
  return res;
}

// 下单方法
async function order(
  account: BinanceAccountInfo,
  price: string,
  quantity: string = "5000"
) {
  const logger = getOrderLogger("place");
  const endpointPath = "/api/v3/order";
  const method = "POST";
  const timestamp = Date.now().toString();
  const requestBody = {
    symbol: "REDUSDT",
    side: "BUY",
    type: "LIMIT",
    timeInForce: "GTC",
    quantity: quantity, // 现在从参数中获取数量
    price: price, // 动态设置价格
    timestamp: timestamp,
  };
  const params = new URLSearchParams(requestBody);

  try {
    logger.info(
      `${account.name} 开始下单，价格: ${price} USDT，数量: ${quantity} RED`
    );
    const res = await binanceRequest(
      account,
      endpointPath,
      method,
      null,
      params
    );
    logger.success(`${account.name} 下单成功，订单ID: ${res.orderId}`);
    return { success: true, data: res };
  } catch (error) {
    logger.error(`${account.name} 下单失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// 尝试下单直到成功
async function tryOrderUntilSuccess(
  account: BinanceAccountInfo,
  price: string,
  endTime: number,
  quantity: string = "5000"
) {
  const logger = getOrderLogger("retry");
  let orderResult = { success: false };

  // 如果当前时间已经超过结束时间，则不再尝试 - 使用校准后的时间
  if (getAdjustedTime() > endTime) {
    logger.warn(`${account.name} 已超过下单时间窗口，停止尝试`);
    return false;
  }

  logger.info(
    `${account.name} 开始重试下单，截止时间: ${formatToUTC8(
      new Date(endTime)
    )} (UTC+8)`
  );

  while (!orderResult.success && getAdjustedTime() <= endTime) {
    orderResult = await order(account, price, quantity);

    if (!orderResult.success) {
      // 如果是API错误且不是"不在交易时间"错误，则等待短暂时间后重试
      await new Promise((resolve) => setTimeout(resolve, 50)); // 50ms延迟，避免频繁请求
      logger.info(`${account.name} 下单失败，重试中...`);
    }
  }

  if (orderResult.success) {
    logger.success(`${account.name} 最终下单成功`);
  } else {
    logger.error(`${account.name} 在截止时间内未能成功下单`);
  }

  return orderResult.success;
}

// 主函数
async function main(
  price: string,
  targetTime: Date,
  quantity: string = "5000",
  accounts: BinanceAccountInfo[] = null
) {
  const logger = getOrderLogger("main");

  // 如果未提供账户，从配置文件加载
  if (!accounts) {
    accounts = JSON.parse(fs.readFileSync("./apis.json", "utf-8"));
  }

  logger.info(`使用价格: ${price} USDT，数量: ${quantity} RED`);
  logger.info(`目标时间: ${formatToUTC8(targetTime)} (UTC+8)`);
  logger.info(`当前校准时间: ${formatToUTC8(getAdjustedDate())}`);
  logger.info(`账户数量: ${accounts.length}`);

  // 计算开始时间（目标时间前10秒）
  const startTime = targetTime.getTime() - 10 * 1000;
  // 设置结束时间窗口（比如尝试30秒）
  const endTime = targetTime.getTime() + 20 * 1000;

  logger.info(`开始尝试时间: ${formatToUTC8(new Date(startTime))} (UTC+8)`);
  logger.info(`结束时间窗口: ${formatToUTC8(new Date(endTime))} (UTC+8)`);

  // 等待直到开始时间，使用校准后的时间
  const timeUntilStart = startTime - getAdjustedTime();
  if (timeUntilStart > 0) {
    const waitSeconds = Math.floor(timeUntilStart / 1000);
    const waitHours = Math.floor(waitSeconds / 3600);
    const waitMinutes = Math.floor((waitSeconds % 3600) / 60);
    const waitRemainingSeconds = waitSeconds % 60;

    logger.info(
      `等待 ${waitSeconds} 秒后开始下单 (${waitHours}小时${waitMinutes}分${waitRemainingSeconds}秒)`
    );

    // 如果等待时间大于1小时，每小时输出一次等待状态
    if (waitSeconds > 3600) {
      const intervalId = setInterval(() => {
        const remainingTime = startTime - getAdjustedTime();
        if (remainingTime <= 0) {
          clearInterval(intervalId);
          return;
        }

        const remainingSeconds = Math.floor(remainingTime / 1000);
        const remainingHours = Math.floor(remainingSeconds / 3600);
        const remainingMinutes = Math.floor((remainingSeconds % 3600) / 60);
        const remainingRemainingSeconds = remainingSeconds % 60;

        logger.info(
          `剩余等待时间: ${remainingHours}小时${remainingMinutes}分${remainingRemainingSeconds}秒`
        );
      }, 3600 * 1000); // 每小时输出一次

      // 确保在定时器完成前不会退出
      const waitPromise = new Promise((resolve) =>
        setTimeout(resolve, timeUntilStart)
      );
      await waitPromise;

      // 清除计时器，防止资源泄漏
      clearInterval(intervalId);
    } else {
      // 等待时间不长，直接等待
      await new Promise((resolve) => setTimeout(resolve, timeUntilStart));
    }
  }

  logger.info("开始执行下单!");

  // 并行执行所有账号的下单
  let orderPromises = [];
  for (const account of accounts) {
    orderPromises.push(tryOrderUntilSuccess(account, price, endTime, quantity));
  }

  await Promise.all(orderPromises);
  logger.success("所有账号下单任务完成");
}

// 导出方法供其他模块使用
export {
  main,
  queryLimitOrders,
  cancelAllLimitOrders,
  order,
  tryOrderUntilSuccess,
};

// 如果直接运行此文件，则执行main函数
if (require.main === module) {
  const logger = getOrderLogger("cli");
  // 获取命令行参数
  const args = process.argv.slice(2);
  let price,
    targetTimeStr,
    quantity = "5000";

  // 检查命令行参数
  if (args.length >= 2) {
    price = args[0];
    targetTimeStr = args[1];
    if (args.length >= 3) {
      quantity = args[2];
    }
  } else {
    // 使用默认值
    price = "0.6"; // 默认价格为0.6
    const defaultTime = new Date();
    defaultTime.setHours(18, 0, 0, 0);
    // 如果当前时间已经过了18:00，调整为明天的18:00
    if (Date.now() > defaultTime.getTime()) {
      defaultTime.setDate(defaultTime.getDate() + 1);
    }
    targetTimeStr = defaultTime.toISOString();
  }

  logger.info(
    `启动命令行模式，参数: 价格=${price}, 时间=${targetTimeStr}, 数量=${quantity}`
  );
  const targetTime = new Date(targetTimeStr);
  main(price, targetTime, quantity)
    .catch((error) => {
      logger.error(`执行过程中出错: ${error}`);
    })
    .finally(() => {
      // 确保在程序结束时关闭所有日志文件
      closeAllLoggers();
    });
}
