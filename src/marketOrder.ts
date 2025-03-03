import fs from "fs";
import {
  binanceRequest,
  BinanceAccountInfo,
  createSignature,
} from "../utils/signature";
import {
  order,
  // tryOrderUntilSuccess 已废弃
  placeOrdersNonBlocking,
  batchPlaceOrdersNonBlocking,
  cancelAllLimitOrders,
  warmupConnection,
} from "./order";
import { getOrderLogger } from "./logger";

const logger = getOrderLogger("market-order");

/**
 * 在市场上成交的下单函数，使用非阻塞方式
 * @param price 价格
 * @param targetTime 目标时间
 * @param quantity 数量
 * @param accounts 账号数组，默认为null（将从配置文件加载）
 * @param duration 持续下单时间，默认3000ms
 * @param startOffset 提前开始时间，默认1000ms
 * @param symbol 交易对，默认REDUSDT
 * @param side 交易方向，默认SELL卖出
 */
export async function marketOrder(
  price: string,
  targetTime: Date,
  quantity: string = "10",
  accounts: BinanceAccountInfo[] = null,
  duration: number = 3000,
  startOffset: number = 1000,
  symbol: string = "REDUSDT",
  side: string = "SELL"
) {
  // 如果未提供账号，则从配置中获取
  if (!accounts) {
    try {
      accounts = JSON.parse(fs.readFileSync("./apis.json", "utf-8"));
      logger.info(`已加载 ${accounts.length} 个账号`);
    } catch (error) {
      logger.error("无法读取账号信息", error);
      return;
    }
  }

  // 显示下单信息
  logger.info("=== 市场订单功能 - 使用非阻塞极速下单 ===");
  logger.info(`交易对: ${symbol}`);
  logger.info(`方向: ${side === "SELL" ? "卖出" : "买入"}`);
  logger.info(`价格: ${price} USDT`);
  logger.info(`数量: ${quantity}`);
  logger.info(`目标时间: ${targetTime.toLocaleString()}`);
  logger.info(`账号数量: ${accounts.length}`);
  logger.info(`下单持续时间: ${duration}ms`);
  logger.info(`提前开始时间: ${startOffset}ms`);

  // 预热连接
  logger.info("预热连接中...");
  for (const account of accounts) {
    await warmupConnection(account);
  }

  // 取消所有挂单
  logger.info("取消现有挂单...");
  for (const account of accounts) {
    await cancelAllLimitOrders(account);
  }

  // 使用非阻塞批量下单
  logger.info("准备开始下单...");
  const results = await batchPlaceOrdersNonBlocking(
    accounts,
    price,
    targetTime,
    duration,
    startOffset,
    quantity,
    true, // 启用预热
    [30, 15, 5], // 标准预热间隔
    symbol,
    side
  );

  // 结果统计
  const totalRequests = results.reduce(
    (sum, result) => sum + result.requestCount,
    0
  );
  const avgQps =
    results.reduce((sum, result) => sum + result.qps, 0) / results.length;

  logger.info("=== 市场订单执行完成 ===");
  logger.info(`总发送请求数: ${totalRequests}`);
  logger.info(`平均每账号QPS: ${avgQps.toFixed(2)}`);
  logger.info(`系统总QPS: ${Math.round(totalRequests / (duration / 1000))}`);

  return results;
}
