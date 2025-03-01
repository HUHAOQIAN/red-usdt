import { main } from "./order";
import fs from "fs";

// 设置明天下午18:00作为目标时间
function getTomorrowAt18() {
  const targetTime = new Date();
  // 设置为明天
  targetTime.setDate(targetTime.getDate() + 1);
  targetTime.setHours(18, 0, 0, 0); // 设置为18:00 (UTC+8)
  return targetTime;
}

// 运行下单程序
async function runTomorrow() {
  try {
    const price = "0.8"; // 明天价格设置为0.8
    const quantity = "5000"; // 数量设置为5000
    const targetTime = getTomorrowAt18();

    console.log("======== RED USDT 限价单下单程序（明天） ========");
    console.log(`设置价格: ${price} USDT`);
    console.log(`设置数量: ${quantity} RED`);
    console.log(`目标时间: ${targetTime.toLocaleString()}`);
    console.log("============================================");

    // 读取所有账户
    const accounts = JSON.parse(fs.readFileSync("./apis.json", "utf-8"));
    console.log(`准备为 ${accounts.length} 个账号下单`);

    // 执行主程序
    await main(price, targetTime, quantity);
  } catch (error) {
    console.error("运行过程中出错:", error);
  }
}

// 如果直接运行此文件，则执行runTomorrow函数
if (require.main === module) {
  runTomorrow().catch(console.error);
}

export { runTomorrow };
