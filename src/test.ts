import { binanceRequest, BinanceAccountInfo } from "../utils/signature";
import fs from "fs";
import {
  order,
  cancelAllLimitOrders,
  main as orderMain,
  tryOrderUntilSuccess,
  queryLimitOrders,
} from "./order";

// 查询持仓 - 获取账户资产
async function queryHoldings(account: BinanceAccountInfo) {
  const endpointPath = "/api/v3/account";
  const method = "GET";
  const timestamp = Date.now().toString();
  const requestBody = {
    timestamp: timestamp,
  };
  const params = new URLSearchParams(requestBody);

  try {
    console.log(`${account.name} 查询账户资产中...`);
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

    console.log(`${account.name} 资产情况:`);
    console.log(
      `  RED: ${redBalance ? redBalance.free : 0} (可用), ${
        redBalance ? redBalance.locked : 0
      } (锁定)`
    );
    console.log(
      `  USDT: ${usdtBalance ? usdtBalance.free : 0} (可用), ${
        usdtBalance ? usdtBalance.locked : 0
      } (锁定)`
    );

    return {
      RED: redBalance || { asset: "RED", free: "0", locked: "0" },
      USDT: usdtBalance || { asset: "USDT", free: "0", locked: "0" },
    };
  } catch (error) {
    console.error(`${account.name} 查询资产失败:`, error.message);
    return {
      RED: { asset: "RED", free: "0", locked: "0" },
      USDT: { asset: "USDT", free: "0", locked: "0" },
    };
  }
}

// 获取账号
function getAccounts(accountIndex?: number): BinanceAccountInfo[] {
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

// 简化版测试脚本 - 主要测试功能

// 测试下单
async function testPlaceOrder(
  accountIndex?: number,
  quantity: string = "100",
  price: string = "0.6"
) {
  console.log("\n========== 测试下单 ==========");
  const accounts = getAccounts(accountIndex);

  for (const account of accounts) {
    console.log(`\n===== ${account.name} 开始下单测试 =====`);
    console.log(`价格: ${price} USDT, 数量: ${quantity} RED`);

    try {
      const result = await order(account, price, quantity);
      if (result.success) {
        console.log(`${account.name} 下单成功! 订单ID: ${result.data.orderId}`);
      } else {
        console.log(`${account.name} 下单失败: ${result.error}`);
      }
    } catch (error) {
      console.error(`${account.name} 下单过程中出错:`, error);
    }
  }
}

// 测试查询订单
async function testQueryOrders(accountIndex?: number) {
  console.log("\n========== 测试查询限价订单 ==========");
  const accounts = getAccounts(accountIndex);

  for (const account of accounts) {
    console.log(`\n===== ${account.name} 查询限价订单 =====`);
    try {
      await queryLimitOrders(account);
    } catch (error) {
      console.error(`${account.name} 查询限价订单失败:`, error);
    }
  }
}

// 测试取消订单
async function testCancelOrders(accountIndex?: number) {
  console.log("\n========== 测试取消限价订单 ==========");
  const accounts = getAccounts(accountIndex);

  for (const account of accounts) {
    console.log(`\n===== ${account.name} 取消限价订单 =====`);
    try {
      await cancelAllLimitOrders(account);
    } catch (error) {
      console.error(`${account.name} 取消限价订单失败:`, error);
    }
  }
}

// 测试查询资产
async function testQueryHoldings(accountIndex?: number) {
  console.log("\n========== 测试查询资产 ==========");
  const accounts = getAccounts(accountIndex);

  for (const account of accounts) {
    console.log(`\n===== ${account.name} 查询资产 =====`);
    try {
      await queryHoldings(account);
    } catch (error) {
      console.error(`${account.name} 查询资产失败:`, error);
    }
  }
}

// 测试主方法
async function testMainFunction(
  accountIndex?: number,
  quantity: string = "100",
  price: string = "0.6"
) {
  console.log("\n========== 测试主函数 ==========");
  const accounts = getAccounts(accountIndex);

  if (accounts.length === 0) {
    return;
  }

  // 设置测试目标时间为当前时间后30秒
  const targetTime = new Date(Date.now() + 30 * 1000);

  // 显示传入的参数值，确保使用正确的参数
  console.log("使用以下参数进行测试:");
  console.log(`价格: ${price} USDT`);
  console.log(`数量: ${quantity} RED`);
  console.log(`测试时间: ${targetTime.toLocaleString()} (当前时间 + 30秒)`);
  console.log(`账号数量: ${accounts.length}`);

  try {
    // 确保使用传入的参数调用主函数
    await orderMain(price, targetTime, quantity, accounts);
    console.log("主函数测试完成");
  } catch (error) {
    console.error("主函数测试失败:", error);
  }
}

// 全流程测试
async function testFullProcess(
  accountIndex?: number,
  quantity: string = "100",
  price: string = "0.6"
) {
  console.log("\n========== 开始全流程测试 ==========");
  const accounts = getAccounts(accountIndex);

  if (accounts.length === 0) {
    return;
  }

  console.log(`测试账号数量: ${accounts.length}`);

  // 1. 先测试下单
  await testPlaceOrder(accountIndex, quantity, price);

  // 2. 查询订单
  await testQueryOrders(accountIndex);

  // 3. 查询资产
  await testQueryHoldings(accountIndex);

  // 4. 取消订单
  await testCancelOrders(accountIndex);

  console.log("\n========== 全流程测试完成 ==========");
}

// 主函数 - 解析命令行参数
async function main() {
  const args = process.argv.slice(2);
  let accountIndex: number | undefined = undefined;
  let quantity = "100";
  let price = "0.6";
  let command = "full";

  // 解析参数
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--account" && i + 1 < args.length) {
      accountIndex = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === "--quantity" && i + 1 < args.length) {
      quantity = args[i + 1];
      i++;
    } else if (args[i] === "--price" && i + 1 < args.length) {
      price = args[i + 1];
      i++;
      // 增加日志，确认参数已经被正确解析
      console.log(`已设置价格为: ${price}`);
    } else if (args[i] === "--command" && i + 1 < args.length) {
      command = args[i + 1];
      i++;
    } else if (args[i] === "--help") {
      command = "help";
    }
  }

  // 执行对应命令
  switch (command) {
    case "order":
      await testPlaceOrder(accountIndex, quantity, price);
      break;
    case "query":
      await testQueryOrders(accountIndex);
      break;
    case "cancel":
      await testCancelOrders(accountIndex);
      break;
    case "holdings":
      await testQueryHoldings(accountIndex);
      break;
    case "main":
      // 确保正确的参数传递给testMainFunction
      console.log(`准备测试主函数，使用价格: ${price}, 数量: ${quantity}`);
      await testMainFunction(accountIndex, quantity, price);
      break;
    case "full":
      await testFullProcess(accountIndex, quantity, price);
      break;
    case "help":
    default:
      console.log("使用方法:");
      console.log(
        "  ts-node src/test.ts [--command <命令>] [--account <账号索引>] [--quantity <数量>] [--price <价格>]"
      );
      console.log("\n可用命令:");
      console.log("  order    - 测试下单功能");
      console.log("  query    - 测试查询限价订单");
      console.log("  cancel   - 测试取消限价订单");
      console.log("  holdings - 测试查询资产");
      console.log("  main     - 测试主函数");
      console.log("  full     - 执行全流程测试（默认）");
      console.log("  help     - 显示帮助信息");
      console.log("\n参数说明:");
      console.log(
        "  --account <索引>   - 指定测试账号索引 (可选，默认测试所有账号)"
      );
      console.log("  --quantity <数量>  - 指定购买数量 (可选，默认100)");
      console.log("  --price <价格>     - 指定购买价格 (可选，默认0.6)");
      break;
  }
}

// 如果直接运行此文件，则执行main函数
if (require.main === module) {
  main().catch(console.error);
}

export {
  testPlaceOrder,
  testQueryOrders,
  testCancelOrders,
  testQueryHoldings,
  testMainFunction,
  testFullProcess,
};
