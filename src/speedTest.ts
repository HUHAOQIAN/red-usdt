import { binanceRequest, BinanceAccountInfo } from "../utils/signature";
import fs from "fs";
import { order, cancelAllLimitOrders, queryLimitOrders } from "./order";
import { getTestLogger, closeAllLoggers, createTestLogger } from "./logger";
import {
  getAdjustedTime,
  getAdjustedDate,
  formatToUTC8,
  createTargetTimeUTC8,
  initTimeSync,
} from "../utils/timeSync";
import crypto from "crypto";
import axios from "axios";

// 查询持仓 - 获取账户资产
async function queryHoldings(account: BinanceAccountInfo) {
  const logger = getTestLogger("queryHoldings");
  const endpointPath = "/api/v3/account";
  const method = "GET";
  const timestamp = Date.now().toString();
  const requestBody = {
    timestamp: timestamp,
  };
  const params = new URLSearchParams(requestBody);

  try {
    logger.info(`${account.name} 查询账户资产中...`);
    const res = await binanceRequest(
      account,
      endpointPath,
      method,
      null,
      params
    );

    // 过滤出RED和USDT余额
    const redBalance = res.balances.find((b: any) => b.asset === "RED");
    const usdtBalance = res.balances.find((b: any) => b.asset === "USDT");

    logger.info(`${account.name} 资产情况:`);
    logger.info(
      `  RED: ${redBalance ? redBalance.free : 0} (可用), ${
        redBalance ? redBalance.locked : 0
      } (锁定)`
    );
    logger.info(
      `  USDT: ${usdtBalance ? usdtBalance.free : 0} (可用), ${
        usdtBalance ? usdtBalance.locked : 0
      } (锁定)`
    );

    return {
      RED: redBalance || { asset: "RED", free: "0", locked: "0" },
      USDT: usdtBalance || { asset: "USDT", free: "0", locked: "0" },
    };
  } catch (error) {
    logger.error(`${account.name} 查询资产失败: ${error.message}`);
    return { RED: null, USDT: null };
  }
}

function getAccounts(accountIndex?: number): BinanceAccountInfo[] {
  const accounts: BinanceAccountInfo[] = JSON.parse(
    fs.readFileSync("./apis.json", "utf-8")
  );
  if (
    accountIndex !== undefined &&
    accountIndex >= 0 &&
    accountIndex < accounts.length
  ) {
    return [accounts[accountIndex]];
  }
  return accounts;
}

// 预热连接
async function warmupConnection(account: BinanceAccountInfo) {
  const logger = getTestLogger("warmup");
  logger.info(`${account.name} 预热Binance API连接...`);
  try {
    await binanceRequest(account, "/api/v3/time", "GET", null, null);
    logger.info(`${account.name} 预热连接成功`);
  } catch (error) {
    logger.error(`${account.name} 预热连接失败: ${error.message}`);
  }
}

// 测试1：连续成功下单测试 - 在指定时间连续下10笔0.6的限价单并查询持仓
async function testConsecutiveOrders(
  accountIndex?: number,
  price: string = "0.6",
  quantity: string = "10",
  orderCount: number = 10,
  targetHour: number = new Date().getHours(),
  targetMinute: number = new Date().getMinutes() + 1
) {
  const logger = createTestLogger("consecutiveOrders");
  logger.info("===== 连续成功下单测试开始 =====");
  logger.info(`参数: 价格=${price}, 数量=${quantity}, 订单数=${orderCount}`);

  const accounts = getAccounts(accountIndex);
  if (accounts.length === 0) {
    logger.error("没有找到可用账号");
    return;
  }

  // 使用第一个账号进行测试
  const account = accounts[0];
  logger.info(`使用账号: ${account.name}`);

  // 创建目标时间 (下一分钟)
  const targetTime = createTargetTimeUTC8(targetHour, targetMinute);
  const targetTimeMs = targetTime.getTime();
  logger.info(`目标时间: ${formatToUTC8(targetTime)} (UTC+8)`);
  logger.info(`当前校准时间: ${formatToUTC8(getAdjustedDate())}`);

  // 预热连接
  await warmupConnection(account);

  // 计算等待时间
  const timeUntilTarget = targetTimeMs - getAdjustedTime();
  if (timeUntilTarget > 0) {
    logger.info(`等待 ${timeUntilTarget / 1000} 秒后开始下单...`);
    await new Promise((resolve) => setTimeout(resolve, timeUntilTarget));
  }

  // 开始记录时间
  const startTime = getAdjustedTime();
  logger.info(`开始下单时间: ${formatToUTC8(new Date(startTime))} (微秒级)`);

  // 存储所有订单结果
  const orderResults = [];

  // 连续下单
  for (let i = 0; i < orderCount; i++) {
    const orderResult = await order(account, price, quantity);
    const orderTime = getAdjustedTime();
    const elapsedMs = orderTime - startTime;

    if (orderResult.success) {
      logger.success(
        `订单 #${i + 1} 成功, 耗时: ${elapsedMs}毫秒, 订单ID: ${
          orderResult.data.orderId
        }, 订单时间: ${orderResult.data.time}`
      );
      orderResults.push({
        index: i + 1,
        success: true,
        orderId: orderResult.data.orderId,
        elapsed: elapsedMs,
        orderTime: orderResult.data.time,
        raw: orderResult.data,
      });
    } else {
      logger.error(
        `订单 #${i + 1} 失败, 耗时: ${elapsedMs}毫秒, 错误: ${
          orderResult.error
        }`
      );
      orderResults.push({
        index: i + 1,
        success: false,
        elapsed: elapsedMs,
        error: orderResult.error,
      });
    }
  }

  const endTime = getAdjustedTime();
  const totalElapsed = endTime - startTime;
  logger.info(
    `测试完成, 总耗时: ${totalElapsed}毫秒, 平均每单: ${
      totalElapsed / orderCount
    }毫秒`
  );

  // 查询持仓
  logger.info("查询当前持仓情况...");
  await queryHoldings(account);

  // 查询当前挂单
  logger.info("查询当前挂单情况...");
  const openOrders = await queryLimitOrders(account);

  // 只有当有活跃订单时才取消
  if (openOrders && openOrders.length > 0) {
    logger.info(`发现 ${openOrders.length} 个活跃订单，正在取消...`);
    await cancelAllLimitOrders(account);
  } else {
    logger.info("没有活跃订单需要取消");
  }

  // 输出统计结果
  logger.info("===== 测试结果统计 =====");
  const successCount = orderResults.filter((r) => r.success).length;
  logger.info(
    `成功订单数: ${successCount}/${orderCount} (${(
      (successCount / orderCount) *
      100
    ).toFixed(2)}%)`
  );

  if (successCount > 0) {
    // 分析微秒级时间戳
    const orderTimes = orderResults
      .filter((r) => r.success && r.orderTime)
      .map((r) => r.orderTime);

    if (orderTimes.length > 0) {
      const minTime = Math.min(...orderTimes);
      const maxTime = Math.max(...orderTimes);
      const timeSpan = maxTime - minTime;

      logger.info(`首单时间戳: ${minTime} 微秒`);
      logger.info(`末单时间戳: ${maxTime} 微秒`);
      logger.info(`时间跨度: ${timeSpan} 微秒`);
      logger.info(`平均每单间隔: ${timeSpan / (orderTimes.length - 1)} 微秒`);
    }
  }

  logger.info("===== 连续成功下单测试结束 =====");
  return orderResults;
}

// 测试2：极限下单性能测试 - 在100ms内连续下失败订单
async function testOrderPerformance(
  accountIndex?: number,
  price: string = "0.9", // 使用较高价格确保下单失败
  quantity: string = "100",
  durationMs: number = 100, // 测试持续时间
  targetHour: number = new Date().getHours(),
  targetMinute: number = new Date().getMinutes() + 1
) {
  const logger = createTestLogger("performanceTest");
  logger.info("===== 极限下单性能测试开始 =====");
  logger.info(
    `参数: 价格=${price}, 数量=${quantity}, 持续时间=${durationMs}毫秒`
  );

  const accounts = getAccounts(accountIndex);
  if (accounts.length === 0) {
    logger.error("没有找到可用账号");
    return;
  }

  // 使用第一个账号进行测试
  const account = accounts[0];
  logger.info(`使用账号: ${account.name}`);

  // 创建目标时间 (下一分钟)
  const targetTime = createTargetTimeUTC8(targetHour, targetMinute);
  const targetTimeMs = targetTime.getTime();
  logger.info(`目标时间: ${formatToUTC8(targetTime)} (UTC+8)`);
  logger.info(`当前校准时间: ${formatToUTC8(getAdjustedDate())}`);

  // 预热连接
  await warmupConnection(account);

  // 计算等待时间
  const timeUntilTarget = targetTimeMs - getAdjustedTime();
  if (timeUntilTarget > 0) {
    logger.info(`等待 ${timeUntilTarget / 1000} 秒后开始下单...`);
    await new Promise((resolve) => setTimeout(resolve, timeUntilTarget));
  }

  // 开始记录时间
  const startTime = getAdjustedTime();
  logger.info(`开始下单时间: ${formatToUTC8(new Date(startTime))} (微秒级)`);

  // 记录下单次数
  let orderCount = 0;
  let successCount = 0;
  const endTime = startTime + durationMs;

  // 不等待响应，连续发送下单请求
  while (getAdjustedTime() < endTime) {
    orderCount++;
    // 不等待响应，直接发送下一个请求
    order(account, price, quantity)
      .then((result) => {
        if (result.success) {
          successCount++;
          logger.success(
            `订单 #${orderCount} 成功, 订单ID: ${result.data.orderId}`
          );
        }
      })
      .catch((error) => {
        // 忽略错误，继续发送下一个请求
      });
  }

  const actualEndTime = getAdjustedTime();
  const totalElapsed = actualEndTime - startTime;
  logger.info(`测试完成, 总耗时: ${totalElapsed}毫秒`);
  logger.info(`发送订单请求数: ${orderCount}`);
  logger.info(
    `每秒请求数 (QPS): ${Math.round(orderCount / (totalElapsed / 1000))}`
  );

  // 等待所有请求完成
  logger.info("等待所有请求完成...");
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // 查询当前挂单并取消
  logger.info("查询并取消所有挂单...");
  const openOrders = await queryLimitOrders(account);

  // 只有当有活跃订单时才取消
  if (openOrders && openOrders.length > 0) {
    logger.info(`发现 ${openOrders.length} 个活跃订单，正在取消...`);
    await cancelAllLimitOrders(account);
  } else {
    logger.info("没有活跃订单需要取消");
  }

  logger.info("===== 极限下单性能测试结束 =====");
  return { orderCount, successCount, elapsedTime: totalElapsed };
}

// 进一步优化的性能测试版本 - 使用更高效的方式发送请求
async function testOrderPerformanceOptimized(
  accountIndex?: number,
  price: string = "0.9", // 使用较高价格确保下单失败
  quantity: string = "100",
  durationMs: number = 100, // 测试持续时间
  targetHour: number = new Date().getHours(),
  targetMinute: number = new Date().getMinutes() + 1
) {
  const logger = createTestLogger("optimizedTest");
  logger.info("===== 优化版极限下单性能测试开始 =====");
  logger.info(
    `参数: 价格=${price}, 数量=${quantity}, 持续时间=${durationMs}毫秒`
  );

  const accounts = getAccounts(accountIndex);
  if (accounts.length === 0) {
    logger.error("没有找到可用账号");
    return;
  }

  // 使用第一个账号进行测试
  const account = accounts[0];
  logger.info(`使用账号: ${account.name}`);

  // 创建目标时间 (下一分钟)
  const targetTime = createTargetTimeUTC8(targetHour, targetMinute);
  const targetTimeMs = targetTime.getTime();
  logger.info(`目标时间: ${formatToUTC8(targetTime)} (UTC+8)`);
  logger.info(`当前校准时间: ${formatToUTC8(getAdjustedDate())}`);

  // 预热连接
  await warmupConnection(account);

  // 计算等待时间
  const timeUntilTarget = targetTimeMs - getAdjustedTime();
  if (timeUntilTarget > 0) {
    logger.info(`等待 ${timeUntilTarget / 1000} 秒后开始下单...`);
    await new Promise((resolve) => setTimeout(resolve, timeUntilTarget));
  }

  // 开始记录时间
  const startTime = getAdjustedTime();
  logger.info(`开始下单时间: ${formatToUTC8(new Date(startTime))} (微秒级)`);

  // 记录下单次数
  let orderCount = 0;
  const endTimeMs = startTime + durationMs;

  // 预先创建请求参数
  const headers = {
    "X-MBX-APIKEY": account.apiKey,
    "X-MBX-TIME-UNIT": "MICROSECOND",
  };

  // 创建一个函数来生成签名
  const createOrderParams = () => {
    const timestamp = Date.now().toString();
    const params = new URLSearchParams({
      symbol: "REDUSDT",
      side: "BUY",
      type: "LIMIT",
      timeInForce: "GTC",
      quantity: quantity,
      price: price,
      timestamp: timestamp,
    });

    // 创建签名
    const signature = crypto
      .createHmac("sha256", account.secretKey)
      .update(params.toString())
      .digest("hex");

    params.append("signature", signature);
    return params.toString();
  };

  // 使用axios的非阻塞模式，持续发送请求直到时间到
  const baseURL = "https://api4.binance.com";
  const endpointPath = "/api/v3/order";
  const axiosInstance = axios.create({
    baseURL,
    headers,
    timeout: 3000, // 3秒超时
  });

  // 不等待响应或错误处理，持续发送请求直到时间到
  while (getAdjustedTime() <= endTimeMs) {
    // 优化版：直接使用axios发送请求，不等待响应
    const url = `${baseURL}${endpointPath}?${createOrderParams()}`;

    axiosInstance.post(url).catch(() => {}); // 忽略所有错误

    orderCount++;
  }

  const actualEndTime = getAdjustedTime();
  const totalElapsed = actualEndTime - startTime;
  logger.info(`测试完成, 总耗时: ${totalElapsed}毫秒`);
  logger.info(`发送订单请求数: ${orderCount}`);
  logger.info(
    `每秒请求数 (QPS): ${Math.round(orderCount / (totalElapsed / 1000))}`
  );

  // 等待所有请求完成
  logger.info("等待所有请求完成...");
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // 查询当前挂单并取消
  logger.info("查询并取消所有挂单...");
  const openOrders = await queryLimitOrders(account);

  // 只有当有活跃订单时才取消
  if (openOrders && openOrders.length > 0) {
    logger.info(`发现 ${openOrders.length} 个活跃订单，正在取消...`);
    await cancelAllLimitOrders(account);
  } else {
    logger.info("没有活跃订单需要取消");
  }

  logger.info("===== 优化版极限下单性能测试结束 =====");
  return { orderCount, elapsedTime: totalElapsed };
}

// 命令行参数处理
async function processCommandLineArgs() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log("请提供测试命令: consecutive | performance | optimized");
    return;
  }

  try {
    // 初始化时间同步
    await initTimeSync();

    if (command === "consecutive") {
      // 连续成功下单测试
      const accountIndex = args[1] ? parseInt(args[1]) : undefined;
      const price = args[2] || "0.6";
      const quantity = args[3] || "100";
      const orderCount = args[4] ? parseInt(args[4]) : 10;

      await testConsecutiveOrders(accountIndex, price, quantity, orderCount);
    } else if (command === "performance") {
      // 极限下单性能测试
      const accountIndex = args[1] ? parseInt(args[1]) : undefined;
      const price = args[2] || "0.9";
      const quantity = args[3] || "100";
      const durationMs = args[4] ? parseInt(args[4]) : 100;

      await testOrderPerformance(accountIndex, price, quantity, durationMs);
    } else if (command === "optimized") {
      // 优化版极限下单性能测试
      const accountIndex = args[1] ? parseInt(args[1]) : undefined;
      const price = args[2] || "0.9";
      const quantity = args[3] || "100";
      const durationMs = args[4] ? parseInt(args[4]) : 100;

      await testOrderPerformanceOptimized(
        accountIndex,
        price,
        quantity,
        durationMs
      );
    } else {
      console.log("未知命令，请使用: consecutive | performance | optimized");
    }
  } catch (error) {
    console.error("执行测试时出错:", error);
  } finally {
    closeAllLoggers();
  }
}

// 如果直接运行此文件
if (require.main === module) {
  processCommandLineArgs();
}

export {
  testConsecutiveOrders,
  testOrderPerformance,
  testOrderPerformanceOptimized,
  warmupConnection,
  queryHoldings,
};
