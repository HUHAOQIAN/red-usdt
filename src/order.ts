import { binanceRequest, BinanceAccountInfo } from "../utils/signature";
import fs from "fs";

// 查询当前限价订单
async function queryLimitOrders(account: BinanceAccountInfo) {
  const endpointPath = "/api/v3/openOrders";
  const method = "GET";
  const timestamp = Date.now().toString();
  const requestBody = {
    symbol: "REDUSDT",
    timestamp: timestamp,
  };
  const params = new URLSearchParams(requestBody);

  console.log(`${account.name} 查询限价订单`);
  const res = await binanceRequest(account, endpointPath, method, null, params);
  console.log(`${account.name} 当前限价订单:`, JSON.stringify(res, null, 2));
  return res;
}

// 取消所有限价订单
async function cancelAllLimitOrders(account: BinanceAccountInfo) {
  const endpointPath = "/api/v3/openOrders";
  const method = "DELETE";
  const timestamp = Date.now().toString();
  const requestBody = {
    symbol: "REDUSDT",
    timestamp: timestamp,
  };
  const params = new URLSearchParams(requestBody);

  console.log(`${account.name} 取消所有限价订单`);
  const res = await binanceRequest(account, endpointPath, method, null, params);
  console.log(`${account.name} 取消订单结果:`, JSON.stringify(res, null, 2));
  return res;
}

// 下单方法
async function order(
  account: BinanceAccountInfo,
  price: string,
  quantity: string = "5000"
) {
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
    console.log(
      `${account.name} 开始下单，价格: ${price} USDT，数量: ${quantity} RED`
    );
    const res = await binanceRequest(
      account,
      endpointPath,
      method,
      null,
      params
    );
    console.log(`${account.name} 下单成功，订单ID: ${res.orderId}`);
    return { success: true, data: res };
  } catch (error) {
    console.error(`${account.name} 下单失败:`, error.message);
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
  let orderResult = { success: false };

  // 如果当前时间已经超过结束时间，则不再尝试
  if (Date.now() > endTime) {
    console.log(`${account.name} 已超过下单时间窗口，停止尝试`);
    return false;
  }

  while (!orderResult.success && Date.now() <= endTime) {
    orderResult = await order(account, price, quantity);

    if (!orderResult.success) {
      // 如果是API错误且不是"不在交易时间"错误，则等待短暂时间后重试
      await new Promise((resolve) => setTimeout(resolve, 50)); // 200ms延迟，避免频繁请求
    }
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
  // 如果未提供账户，从配置文件加载
  if (!accounts) {
    accounts = JSON.parse(fs.readFileSync("./apis.json", "utf-8"));
  }

  console.log(`使用价格: ${price} USDT，数量: ${quantity} RED`);
  console.log(`目标时间: ${targetTime.toLocaleString()}`);

  // 计算开始时间（目标时间前10秒）
  const startTime = targetTime.getTime() - 10 * 1000;
  // 设置结束时间窗口（比如尝试30秒）
  const endTime = targetTime.getTime() + 20 * 1000;

  console.log(`开始尝试时间: ${new Date(startTime).toLocaleString()}`);

  // 等待直到开始时间
  const timeUntilStart = startTime - Date.now();
  if (timeUntilStart > 0) {
    console.log(`等待 ${Math.floor(timeUntilStart / 1000)} 秒后开始下单`);
    await new Promise((resolve) => setTimeout(resolve, timeUntilStart));
  }

  console.log("开始执行下单!");

  // 并行执行所有账号的下单
  let orderPromises = [];
  for (const account of accounts) {
    orderPromises.push(tryOrderUntilSuccess(account, price, endTime, quantity));
  }

  await Promise.all(orderPromises);
  console.log("所有账号下单任务完成");
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

  const targetTime = new Date(targetTimeStr);
  main(price, targetTime, quantity).catch(console.error);
}
