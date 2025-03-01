import { main } from "./order";
import fs from "fs";

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
      console.error("没有找到有效账号");
      return;
    }

    console.log("\n======== RED USDT 限价单测试程序 ========");
    console.log(`设置价格: ${price} USDT`);
    console.log(`设置数量: ${quantity} RED`);
    console.log(`测试账号数量: ${accounts.length}`);
    console.log(
      `目标时间: ${targetTime.toLocaleString()} (当前时间 + ${delaySeconds}秒)`
    );
    console.log("==========================================");

    // 执行主程序
    await main(price, targetTime, quantity, accounts);
    console.log("\n测试完成!");
  } catch (error) {
    console.error("测试过程中出错:", error);
  }
}

// 主函数 - 解析命令行参数
async function start() {
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
    } else if (args[i] === "--quantity" && i + 1 < args.length) {
      options.quantity = args[i + 1];
      i++;
    } else if (args[i] === "--delay" && i + 1 < args.length) {
      options.delaySeconds = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === "--account" && i + 1 < args.length) {
      options.accountIndex = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === "--help") {
      showHelp();
      return;
    }
  }

  // 运行测试
  await runTest(options);
}

// 显示帮助信息
function showHelp() {
  console.log("使用方法:");
  console.log("  ts-node src/run-test.ts [选项]");
  console.log("\n可用选项:");
  console.log("  --price <价格>      - 设置买入价格 (默认: 0.6)");
  console.log("  --quantity <数量>   - 设置买入数量 (默认: 100)");
  console.log("  --delay <秒数>      - 设置延迟执行的秒数 (默认: 30)");
  console.log(
    "  --account <账号索引> - 指定使用特定账号索引 (默认: 使用所有账号)"
  );
  console.log("  --help              - 显示帮助信息");
  console.log("\n示例:");
  console.log("  测试所有账号, 价格0.8, 数量200, 延迟10秒:");
  console.log(
    "  ts-node src/run-test.ts --price 0.8 --quantity 200 --delay 10"
  );
  console.log("\n  测试第0个账号, 价格0.7:");
  console.log("  ts-node src/run-test.ts --account 0 --price 0.7");
}

// 如果直接运行此文件，则执行start函数
if (require.main === module) {
  start().catch(console.error);
}

export { runTest };
