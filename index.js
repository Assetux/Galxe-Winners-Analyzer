import fs from "fs";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { ethers } from "ethers";

/* ================= CONFIG ================= */

const WRITE_EVERY = 5; // write CSV every N wallets

const INPUT_CSV = "example.csv";
const OUTPUT_CSV = "example.updated.csv";

// CHANGE THESE IF NEEDED
const WALLET_COLUMN = "address";    // column with EVM wallet
const WINNER_COLUMN = "winner";     // column containing "winner"

/**
 * Token Address
 * @dev Example, USDT on BNB Smart Chain (56)
 */
const TOKEN_ADDRESS = "0x55d398326f99059ff775485246999027b3197955"; 
const DECIMALS = 18;

/**
 * @dev Uncomment to scan on multiple chains
 */
const CHAINS = {
  // ethereum: {
  //   rpc: "https://eth.merkle.io",
  //   chainId: 1
  // },
  // base: {
  //   rpc: "https://mainnet.base.org/",
  //   chainId: 8453
  // },
  // arbitrum: {
  //   rpc: "https://1rpc.io/arb",
  //   chainId: 42161
  // },
  bsc: {
    rpc: "https://bsc-dataseed.bnbchain.org/",
    chainId: 56
  }
};

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)"
];

/* ========================================== */

function loadCSV() {
  const file = fs.readFileSync(INPUT_CSV);
  return parse(file, {
    columns: true,
    skip_empty_lines: true
  });
}

async function getBalance(chain, wallet) {
  const provider = new ethers.JsonRpcProvider(
    chain.rpc,
    { name: "custom", chainId: chain.chainId }
  );

  const contract = new ethers.Contract(
    TOKEN_ADDRESS,
    ERC20_ABI,
    provider
  );

  const balance = await contract.balanceOf(wallet);

  return Number(ethers.formatUnits(balance, DECIMALS));
}

async function main() {
  const rows = loadCSV();

  const total = rows.length;
  let processed = 0;
  let walletsWithBalanceOver1 = 0;
  let winnerCount = 0;
  let validWallets = 0;

  const startTime = Date.now();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const wallet = row[WALLET_COLUMN];

    processed++;

    // Console status (single line refresh)
    process.stdout.write(
      `\rProcessed: ${processed}/${total} | Remaining: ${total - processed}`
    );

    if (!wallet || !ethers.isAddress(wallet)) {
      row.token = "0";
      continue;
    }

    validWallets++;

    let totalBalance = 0;

    for (const chain of Object.values(CHAINS)) {
      try {
        totalBalance += await getBalance(chain, wallet);
      } catch (e) {
        console.error(
          `\nRPC error on ${chain.name} (${chain.chainId}) for ${wallet}:`,
          e.shortMessage || e.message
        );
      }
    }

    row.token = totalBalance.toFixed(6);


    /**
     * @dev Change 1 to any number to filter balances  
     */
    if (totalBalance > 1) {
      walletsWithBalanceOver1++;
    }

    if (
      row[WINNER_COLUMN] &&
      String(row[WINNER_COLUMN]).toLowerCase().includes("winner")
    ) {
      winnerCount++;
    }

    /* ===== Incremental CSV write ===== */
    if (processed % WRITE_EVERY === 0) {
      fs.writeFileSync(
        OUTPUT_CSV,
        stringify(rows, { header: true })
      );
    }
  }

  /* ===== Final write ===== */
  fs.writeFileSync(
    OUTPUT_CSV,
    stringify(rows, { header: true })
  );

  const percentOver1 =
    validWallets === 0 ? 0 : (walletsWithBalanceOver1 / validWallets) * 100;

  const percentWinners =
    validWallets === 0 ? 0 : (winnerCount / validWallets) * 100;

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n====================================");
  console.log(`Done in ${elapsed}s`);
  console.log(`Total wallets: ${total}`);
  console.log(`Valid wallets: ${validWallets}`);
  console.log(`> 1 token: ${walletsWithBalanceOver1} (${percentOver1.toFixed(2)}%)`);
  console.log(`Winners: ${winnerCount} (${percentWinners.toFixed(2)}%)`);
  console.log(`CSV saved as: ${OUTPUT_CSV}`);
  console.log("====================================");
}

main();
