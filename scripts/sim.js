// Define initial parameters
const totalSupply = 1_000_000_000; // 1 billion tokens
const tokenSaleTokens = 10_000_000; // 10 million tokens for sale
const saleAmountUSDC = 500_000; // 500k USDC
const tokenPrice = saleAmountUSDC / tokenSaleTokens;
const employeeMonthlyUSDC = 5000; // Employee payment in USDC
const minTreasuryReserve = totalSupply * 0.2; // 20% of total supply

// Treasury starts with all tokens minus those sold
let treasuryTokens = totalSupply - tokenSaleTokens;
let TVL = tokenSaleTokens; // Start TVL with all tokens sold in token sale

// Parameters for APY function
const APYFloor = 0.06; // 6% APY floor
const APYMax = 1.0; // Maximum APY 100%
const TVLMin = 1_000_000; // Minimum TVL to define APY scaling
const TVLMax = 1_000_000_000; // Maximum TVL

console.log(`
Total supply =      ${totalSupply}
Token sale amount = ${tokenSaleTokens}
Price =             ${tokenPrice}
Employees =         ${employeeMonthlyUSDC}
                    ${employeeMonthlyUSDC / tokenPrice}
Treasury =          ${treasuryTokens}                    
TVL =               ${TVL}
`);

for (let month = 1; month <= 12; month++) {
  let monthlyDistributedTokens = 0; // Track monthly distribution

  // Calculate APY based on current TVL
  let APY =
    APYFloor +
    (APYMax - APYFloor) *
      (Math.log(TVLMax / (TVL || 1)) / Math.log(TVLMax / TVLMin));

  // Calculate daily rewards for 30 days in the month
  for (let day = 1; day <= 30; day++) {
    let dailyReward = (APY / 365) * TVL;

    if (treasuryTokens >= dailyReward) {
      treasuryTokens -= dailyReward; // Deduct from Treasury
      TVL += dailyReward; // Assume reward gets staked back into TVL
      monthlyDistributedTokens += dailyReward; // Track distribution
    } else {
      console.log(
        "Treasury can't afford daily reward on day " +
          day +
          " of month " +
          month
      );
      break;
    }
  }

  // Calculate and distribute employee payment
  let employeeTokens = employeeMonthlyUSDC / tokenPrice;

  if (treasuryTokens >= employeeTokens) {
    treasuryTokens -= employeeTokens; // Deduct from Treasury
    monthlyDistributedTokens += employeeTokens; // Track distribution
  } else {
    console.log("Treasury can't afford employee payment in month " + month);
    break;
  }

  // Reinvest 10% of the monthly distributed tokens back into staking (TVL)
  let reinvestment = 0.1 * monthlyDistributedTokens;
  TVL += reinvestment; // Add to TVL

  // Display the status at the end of each month
  console.log(`Month ${month}:`);
  console.log(`  APY ${(APY * 100).toFixed(0)}%`);
  console.log(`  Rewards ${monthlyDistributedTokens.toFixed(0)}`);
  console.log(`  Treasury Tokens: ${treasuryTokens.toFixed(0)}`);
  console.log(`  TVL: ${TVL.toFixed(0)}`);
  console.log(`  Reinvested into TVL: ${reinvestment.toFixed(0)}`);

  // Check if Treasury meets minimum reserve
  if (treasuryTokens < minTreasuryReserve) {
    console.log(
      "Treasury has fallen below minimum reserve after month " + month
    );
    break;
  }
}

console.log("Simulation ended.");
