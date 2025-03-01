import { main } from "./order";
import fs from "fs";

// 设置今天下午18:00作为目标时间
function getTodayAt18() {
  const targetTime = new Date();
  targetTime.setHours(18, 0, 0, 0); // 设置为今天18:00 (UTC+8)

  // 如果当前时间已经过了18:00，提醒用户
  if (Date.now() > targetTime.getTime()) {
    console.log("警告: 当前时间已经过了今天的18:00，将使用明天的18:00");
    targetTime.setDate(targetTime.getDate() + 1);
  }

  return targetTime;
}

// 运行下单程序
async function run() {
  try {
    const price = "0.6"; // 价格设置为0.6
    const quantity = "5000"; // 数量设置为5000
    const targetTime = getTodayAt18();

    console.log("======== RED USDT 限价单下单程序 ========");
    console.log(`设置价格: ${price} USDT`);
    console.log(`设置数量: ${quantity} RED`);
    console.log(`目标时间: ${targetTime.toLocaleString()}`);
    console.log("=======================================");

    // 读取所有账户
    const accounts = JSON.parse(fs.readFileSync("./apis.json", "utf-8"));
    console.log(`准备为 ${accounts.length} 个账号下单`);

    // 执行主程序
    await main(price, targetTime, quantity);
  } catch (error) {
    console.error("运行过程中出错:", error);
  }
}

// 如果直接运行此文件，则执行run函数
if (require.main === module) {
  run().catch(console.error);
}

export { run };
