import { initTimeSync } from "../utils/timeSync";
import {
  testConsecutiveOrders,
  testOrderPerformance,
  testOrderPerformanceOptimized,
  testNonBlockingOrders,
  processCommandLineArgs,
} from "./speedTest";
import { closeAllLoggers } from "./logger";

// 主函数：根据参数运行不同的测试
async function main() {
  await processCommandLineArgs();
}

// 运行连续下单测试
async function runConsecutiveTest(args: string[]) {
  const accountIndex = args[0] ? parseInt(args[0]) : undefined;
  const price = args[1] || "0.6";
  const quantity = args[2] || "100";
  const orderCount = args[3] ? parseInt(args[3]) : 10;
  const targetHour = args[4] ? parseInt(args[4]) : new Date().getHours();
  const targetMinute = args[5]
    ? parseInt(args[5])
    : new Date().getMinutes() + 1;

  console.log("开始连续下单测试:");
  console.log(
    `账号索引: ${accountIndex !== undefined ? accountIndex : "所有账号"}`
  );
  console.log(`价格: ${price} USDT`);
  console.log(`数量: ${quantity} RED`);
  console.log(`订单数量: ${orderCount}`);
  console.log(
    `目标时间: ${targetHour}:${
      targetMinute < 10 ? "0" + targetMinute : targetMinute
    } (UTC+8)`
  );

  await testConsecutiveOrders(
    accountIndex,
    price,
    quantity,
    orderCount,
    targetHour,
    targetMinute
  );
}

// 运行性能测试
async function runPerformanceTest(args: string[]) {
  const accountIndex = args[0] ? parseInt(args[0]) : undefined;
  const price = args[1] || "0.9";
  const quantity = args[2] || "100";
  const durationMs = args[3] ? parseInt(args[3]) : 100;
  const targetHour = args[4] ? parseInt(args[4]) : new Date().getHours();
  const targetMinute = args[5]
    ? parseInt(args[5])
    : new Date().getMinutes() + 1;

  console.log("开始标准性能测试:");
  console.log(
    `账号索引: ${accountIndex !== undefined ? accountIndex : "所有账号"}`
  );
  console.log(`价格: ${price} USDT`);
  console.log(`数量: ${quantity} RED`);
  console.log(`持续时间: ${durationMs}ms`);
  console.log(
    `目标时间: ${targetHour}:${
      targetMinute < 10 ? "0" + targetMinute : targetMinute
    } (UTC+8)`
  );

  await testOrderPerformance(
    accountIndex,
    price,
    quantity,
    durationMs,
    targetHour,
    targetMinute
  );
}

// 运行优化版性能测试
async function runOptimizedTest(args: string[]) {
  const accountIndex = args[0] ? parseInt(args[0]) : undefined;
  const price = args[1] || "0.9";
  const quantity = args[2] || "100";
  const durationMs = args[3] ? parseInt(args[3]) : 100;
  const targetHour = args[4] ? parseInt(args[4]) : new Date().getHours();
  const targetMinute = args[5]
    ? parseInt(args[5])
    : new Date().getMinutes() + 1;

  console.log("开始优化版性能测试:");
  console.log(
    `账号索引: ${accountIndex !== undefined ? accountIndex : "所有账号"}`
  );
  console.log(`价格: ${price} USDT`);
  console.log(`数量: ${quantity} RED`);
  console.log(`持续时间: ${durationMs}ms`);
  console.log(
    `目标时间: ${targetHour}:${
      targetMinute < 10 ? "0" + targetMinute : targetMinute
    } (UTC+8)`
  );

  await testOrderPerformanceOptimized(
    accountIndex,
    price,
    quantity,
    durationMs,
    targetHour,
    targetMinute
  );
}

// 显示帮助信息
function showHelp() {
  console.log(`
RED-USDT下单速度测试工具

用法:
  npx ts-node src/run-speed-test.ts <命令> [参数]

命令:
  consecutive  连续成功下单测试 - 测试下单成功的速度和时间精度
               参数: [账号索引] [价格] [数量] [订单数量] [小时] [分钟]
               
  performance  标准性能测试 - 测试在指定时间内能发出多少订单
               参数: [账号索引] [价格] [数量] [持续时间ms] [小时] [分钟]
               
  optimized    优化版性能测试 - 使用直接API调用测试最大QPS
               参数: [账号索引] [价格] [数量] [持续时间ms] [小时] [分钟]
               
  help         显示此帮助信息

示例:
  # 在下一分钟连续下10笔0.6的订单
  npx ts-node src/run-speed-test.ts consecutive 0 0.6 100 10
  
  # 在11:20测试单个账号下100ms内能发出多少笔订单
  npx ts-node src/run-speed-test.ts performance 0 0.9 100 100 11 20
  
  # 在11:20使用优化版测试单个账号下200ms内能发出多少笔订单
  npx ts-node src/run-speed-test.ts optimized 0 0.9 100 200 11 20
`);
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}

export { main };
