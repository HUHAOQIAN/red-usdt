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
  quantity: string = "5000",
  symbol: string = "REDUSDT",
  side: string = "SELL"
) {
  const logger = getOrderLogger("place");
  const endpointPath = "/api/v3/order";
  const method = "POST";
  const timestamp = Date.now().toString();
  const requestBody = {
    symbol: symbol,
    side: side,
    type: "LIMIT",
    timeInForce: "GTC",
    quantity: quantity, // 现在从参数中获取数量
    price: price, // 动态设置价格
    timestamp: timestamp,
  };
  const params = new URLSearchParams(requestBody);

  try {
    logger.info(
      `${account.name} 开始${
        side === "SELL" ? "卖出" : "买入"
      }，${symbol}，价格: ${price} USDT，数量: ${quantity}`
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

/**
 * 尝试下单直到成功 - 废弃方法
 * @deprecated 此方法已废弃，请使用placeOrdersNonBlocking代替
 */
async function tryOrderUntilSuccess(
  account: BinanceAccountInfo,
  price: string,
  endTime: number,
  quantity: string = "5000"
) {
  const logger = getOrderLogger(account.name);

  logger.warn(
    "警告：您正在使用已废弃的tryOrderUntilSuccess方法，此方法将在未来版本中移除"
  );
  logger.warn(
    "建议使用非阻塞方法placeOrdersNonBlocking或batchPlaceOrdersNonBlocking代替"
  );

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
      // await new Promise((resolve) => setTimeout(resolve, 10)); // 50ms延迟，避免频繁请求
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

/**
 * 主要的下单函数，支持调度多个账号同时在指定时间下单
 * 使用非阻塞方式进行下单，不等待响应
 * @param price 价格
 * @param targetTime 目标时间
 * @param quantity 数量
 * @param accounts 账号数组
 * @param duration 持续下单时间(毫秒)
 * @param startOffset 提前开始时间(毫秒)
 * @param preWarmTimes 预热时间点数组，单位为秒
 * @param symbol 交易对，默认REDUSDT
 * @param side 交易方向，默认SELL卖出
 */
async function main(
  price: string,
  targetTime: Date,
  quantity: string = "5000",
  accounts: BinanceAccountInfo[] = null,
  duration: number = 3000,
  startOffset: number = 1000,
  preWarmTimes: number[] = [30, 15, 5],
  symbol: string = "REDUSDT",
  side: string = "SELL"
) {
  const logger = getOrderLogger("main");

  // 如果未提供账号，则从配置中获取所有账号
  if (!accounts) {
    accounts = JSON.parse(fs.readFileSync("./apis.json", "utf-8"));
    logger.info(`已加载 ${accounts.length} 个账号`);
  }

  const now = Date.now();
  const targetMs = targetTime.getTime();
  const timeUntilStart = targetMs - now;

  if (timeUntilStart <= 0) {
    logger.error("目标时间已经过去，无法执行");
    return;
  }

  // 展示倒计时信息
  logger.info(`目标下单时间: ${targetTime.toLocaleString()}`);
  logger.info(`当前服务器时间: ${new Date().toLocaleString()}`);
  logger.info(`距离目标时间还有 ${timeUntilStart / 1000} 秒`);
  logger.info(`交易对: ${symbol}`);
  logger.info(`方向: ${side === "SELL" ? "卖出" : "买入"}`);
  logger.info(`价格: ${price} USDT, 数量: ${quantity}`);
  logger.info(
    `将使用非阻塞下单方法，提前 ${startOffset}ms 开始，持续 ${duration}ms`
  );
  logger.info(
    `预热计划: 在目标时间前 ${preWarmTimes.join(", ")} 秒各进行一次预热`
  );

  // 如果距离开始时间还早，则显示倒计时
  if (timeUntilStart > 10000) {
    // 每5秒显示一次倒计时
    const intervalId = setInterval(() => {
      const remaining = targetMs - Date.now();
      logger.info(
        `距离目标时间还有 ${(remaining / 1000).toFixed(2)} 秒, 将使用 ${
          accounts.length
        } 个账号`
      );
    }, 5000);

    // 确保在定时器完成前不会退出
    const waitPromise = new Promise((resolve) =>
      setTimeout(resolve, timeUntilStart - 5000)
    );
    await waitPromise;

    // 清除计时器，防止资源泄漏
    clearInterval(intervalId);
  } else {
    // 等待时间不长，直接等待
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, timeUntilStart - 5000))
    );
  }

  logger.info("准备开始非阻塞下单!");

  // 使用批量非阻塞下单方法
  const results = await batchPlaceOrdersNonBlocking(
    accounts,
    price,
    targetTime,
    duration,
    startOffset,
    quantity,
    true, // 启用预热
    preWarmTimes,
    symbol,
    side
  );

  // 汇总结果
  const totalRequests = results.reduce(
    (sum, result) => sum + result.requestCount,
    0
  );
  const avgQps =
    results.reduce((sum, result) => sum + result.qps, 0) / results.length;

  logger.success("所有账号下单任务完成");
  logger.info(`总发送请求数: ${totalRequests}`);
  logger.info(`平均每账号QPS: ${avgQps.toFixed(2)}`);
  logger.info(`系统总QPS: ${Math.round(totalRequests / (duration / 1000))}`);
}

// 新的预热连接方法 - 支持多次预热
async function preWarmConnections(
  account: BinanceAccountInfo,
  targetTime: Date,
  preWarmTimes: number[] = [30, 15, 5] // 默认在30秒、15秒和5秒前预热
) {
  const logger = getOrderLogger("preWarm");
  const targetMs = targetTime.getTime();

  // 设置预热计划
  const warmupPlans = preWarmTimes.map((seconds) => {
    return {
      seconds,
      timeMs: targetMs - seconds * 1000,
    };
  });

  // 记录预热计划
  logger.info(`${account.name} 设置了${warmupPlans.length}次连接预热:`);
  warmupPlans.forEach((plan) => {
    logger.info(
      `- 目标时间前${plan.seconds}秒 (${formatToUTC8(new Date(plan.timeMs))})`
    );
  });

  // 执行预热
  for (const plan of warmupPlans) {
    const waitTime = plan.timeMs - getAdjustedTime();

    if (waitTime <= 0) {
      // 如果已经过了预热时间，立即预热
      logger.info(`${account.name} 立即执行目标时间前${plan.seconds}秒的预热`);
      await warmupConnection(account);
    } else {
      // 等待到预热时间
      logger.info(
        `${account.name} 等待${waitTime / 1000}秒后执行目标时间前${
          plan.seconds
        }秒的预热`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      logger.info(`${account.name} 执行目标时间前${plan.seconds}秒的预热`);
      await warmupConnection(account);
    }
  }

  logger.info(`${account.name} 完成所有预热连接`);
  return true;
}

// 不等待响应的下单方法 - 极速版
async function placeOrdersNonBlocking(
  account: BinanceAccountInfo,
  price: string,
  targetTime: Date,
  duration: number = 3000, // 默认持续下单3秒
  startOffset: number = 1000, // 默认提前1秒开始
  quantity: string = "5000",
  preWarm: boolean = true, // 是否启用预热
  preWarmTimes: number[] = [30, 15, 5], // 预热时间配置
  symbol: string = "REDUSDT",
  side: string = "SELL"
) {
  const logger = getOrderLogger("nonBlocking");

  // 计算开始和结束时间
  const targetTimeMs = targetTime.getTime();
  const startTimeMs = targetTimeMs - startOffset;
  const endTimeMs = targetTimeMs + duration;

  logger.info(`${account.name} 配置非阻塞下单:`);
  logger.info(`- 目标时间: ${formatToUTC8(targetTime)} (UTC+8)`);
  logger.info(
    `- 开始时间: ${formatToUTC8(new Date(startTimeMs))} (UTC+8) [提前${
      startOffset / 1000
    }秒]`
  );
  logger.info(
    `- 结束时间: ${formatToUTC8(new Date(endTimeMs))} (UTC+8) [持续${
      duration / 1000
    }秒]`
  );
  logger.info(`- 交易对: ${symbol}`);
  logger.info(`- 方向: ${side === "SELL" ? "卖出" : "买入"}`);
  logger.info(`- 价格: ${price} USDT, 数量: ${quantity}`);

  // 执行预热
  if (preWarm) {
    await preWarmConnections(account, targetTime, preWarmTimes);
  }

  // 等待到开始时间
  const waitTime = startTimeMs - getAdjustedTime();
  if (waitTime > 0) {
    logger.info(`${account.name} 等待${waitTime / 1000}秒后开始下单`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  // 开始时间
  const actualStartTime = getAdjustedTime();
  logger.info(
    `${account.name} 开始非阻塞下单，实际开始时间: ${formatToUTC8(
      new Date(actualStartTime)
    )} (UTC+8)`
  );

  // 记录请求计数
  let requestCount = 0;

  // 不等待响应，持续发送请求直到结束时间
  while (getAdjustedTime() <= endTimeMs) {
    // 不使用await，直接发送请求并忽略响应
    order(account, price, quantity, symbol, side)
      .then((result) => {
        if (result.success) {
          logger.success(
            `${account.name} 下单成功，订单ID: ${result.data.orderId}, 时间: ${result.data.time}`
          );
          return true;
        }
      })
      .catch((e) => {
        // 忽略错误，继续发送请求
      });

    requestCount++;
  }

  // 结束时间
  const actualEndTime = getAdjustedTime();
  const elapsedMs = actualEndTime - actualStartTime;

  logger.info(`${account.name} 完成非阻塞下单`);
  logger.info(
    `- 实际开始时间: ${formatToUTC8(new Date(actualStartTime))} (UTC+8)`
  );
  logger.info(
    `- 实际结束时间: ${formatToUTC8(new Date(actualEndTime))} (UTC+8)`
  );
  logger.info(`- 总耗时: ${elapsedMs}毫秒`);
  logger.info(`- 发送请求数: ${requestCount}`);
  logger.info(
    `- 每秒请求数 (QPS): ${Math.round(requestCount / (elapsedMs / 1000))}`
  );

  return {
    success: true,
    requestCount,
    elapsedMs,
    qps: Math.round(requestCount / (elapsedMs / 1000)),
  };
}

// 批量执行非阻塞下单 - 对多个账号并行执行
async function batchPlaceOrdersNonBlocking(
  accounts: BinanceAccountInfo[],
  price: string,
  targetTime: Date,
  duration: number = 3000,
  startOffset: number = 1000,
  quantity: string = "5000",
  preWarm: boolean = true,
  preWarmTimes: number[] = [30, 15, 5],
  symbol: string = "REDUSDT",
  side: string = "SELL"
) {
  const logger = getOrderLogger("batchNonBlocking");

  logger.info(`开始为${accounts.length}个账号执行批量非阻塞下单`);
  logger.info(`- 目标时间: ${formatToUTC8(targetTime)} (UTC+8)`);
  logger.info(`- 交易对: ${symbol}`);
  logger.info(`- 方向: ${side === "SELL" ? "卖出" : "买入"}`);
  logger.info(`- 价格: ${price} USDT, 数量: ${quantity}`);

  // 并行执行所有账号的非阻塞下单
  const promises = [];

  for (const account of accounts) {
    promises.push(
      placeOrdersNonBlocking(
        account,
        price,
        targetTime,
        duration,
        startOffset,
        quantity,
        preWarm,
        preWarmTimes,
        symbol,
        side
      )
    );
  }

  // 等待所有账号完成下单
  const results = await Promise.all(promises);

  // 统计结果
  const totalRequests = results.reduce(
    (sum, result) => sum + result.requestCount,
    0
  );
  const avgQps =
    results.reduce((sum, result) => sum + result.qps, 0) / results.length;

  logger.info(`批量非阻塞下单完成`);
  logger.info(`- 总请求数: ${totalRequests}`);
  logger.info(`- 平均每账号QPS: ${avgQps.toFixed(2)}`);
  logger.info(`- 系统总QPS: ${Math.round(totalRequests / (duration / 1000))}`);

  return results;
}

// 预热连接
async function warmupConnection(account: BinanceAccountInfo) {
  const logger = getOrderLogger("warmup");

  try {
    logger.info(`${account.name} 预热Binance API连接...`);
    // 使用time接口预热
    const timeResult = await binanceRequest(
      account,
      "/api/v3/time",
      "GET",
      null,
      null
    );
    logger.info(
      `${account.name} 预热连接成功，服务器时间: ${timeResult.serverTime}`
    );
    return true;
  } catch (error) {
    logger.error(`${account.name} 预热连接失败: ${error.message}`);
    return false;
  }
}

// 当前文件是在node.js环境运行的，导出必要的函数
export {
  queryLimitOrders,
  cancelAllLimitOrders,
  order,
  main,
  preWarmConnections,
  placeOrdersNonBlocking,
  batchPlaceOrdersNonBlocking,
  warmupConnection,
  /**
   * @deprecated 此方法已废弃，请使用placeOrdersNonBlocking或batchPlaceOrdersNonBlocking代替
   */
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
