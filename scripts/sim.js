// Initial parameters
const totalSupply = 1_000_000_000; // 1 billion WLF tokens
const initialAirdrop = 20_000; // Initial airdrop
const tokenSaleGoalUSD = 500_000; // Goal for token sale #0 in USD
const myContributionUSD = 5_000; // Personal contribution to sale
const tokenSalePriceUSD = 0.01; // Price per token in USD for sale
const tokenSaleTokens = 50_000_000; // Total tokens in initial sale, staked for 10 years
const employeeMonthlyUSDC = 2_000; // Monthly employee payment in USDC
var employeeTokenPayment = employeeMonthlyUSDC / tokenSalePriceUSD; // Employee payment in WLF tokens
const minTreasuryReserve = totalSupply * 0.2; // Minimum treasury reserve at 20% of total supply

// Initial treasury and TVL (Total Value Locked) setup
let treasuryTokens = totalSupply - tokenSaleTokens * 2 - initialAirdrop;
let tokensInPool = tokenSaleTokens; // Tokens in pool after sale
let TVL = tokenSaleGoalUSD; // Initial TVL after token sale
let marketCap = 5_000; // Market cap initially equal to TVL

// Simulation parameters
const employeeSellPercentage = 0.5; // Employees sell 50% of token payment each month

console.log(`
Total supply =      ${totalSupply} WLF
Initial Airdrop =   ${initialAirdrop} WLF
Token sale amount = ${tokenSaleTokens} WLF
Token price =       ${tokenSalePriceUSD} USD
Employee monthly payment = ${employeeMonthlyUSDC} USD (${employeeTokenPayment} WLF)
`);
var tokenPrice = marketCap / tokensInPool;

for (let month = 1; month <= 12; month++) {
  // Employee token sale and reinvestment
  const employeeTokensToSell =
    (employeeMonthlyUSDC / tokenPrice) * employeeSellPercentage;

  // Update treasury and pool
  if (treasuryTokens >= employeeTokenPayment) {
    treasuryTokens -= employeeTokenPayment; // Deduct full payment from treasury
    tokensInPool += employeeTokensToSell; // Reinvest unsold portion back into the pool
    marketCap -= employeeMonthlyUSDC * employeeSellPercentage; // Decrease market cap by sale proceeds

    // Recalculate token price after the employee sale and reinvestment
    tokenPrice = marketCap / tokensInPool;

    // Recalculate employee token payment
    employeeTokenPayment = employeeMonthlyUSDC / tokenPrice;
  } else {
    console.log(`Treasury can't afford employee payment in month ${month}`);
    break;
  }

  // Display monthly stats
  console.log(`\nMonth ${month}:`);
  console.log(`  Token Price:        ${tokenPrice} USD`);
  console.log(
    `  Employees Tokens to Sell:     ${employeeTokensToSell.toFixed(0)} WLF`
  );
  console.log(`  Market Cap:         ${marketCap.toFixed(2)} USD`);
  console.log(`  Treasury Tokens:    ${treasuryTokens.toFixed(0)} WLF`);
  console.log(`  Tokens in Pool:     ${tokensInPool.toFixed(0)} WLF`);

  // Check if treasury meets minimum reserve
  if (treasuryTokens < minTreasuryReserve) {
    console.log(
      `\nTreasury has fallen below the minimum reserve after month ${month}.`
    );
    break;
  }
}

console.log("\nSimulation ended.");
