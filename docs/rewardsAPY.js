// Constants
const MAX_APY = 80; // Maximum APY (80%)
const MIN_APY = 6; // Minimum APY (6%)
const SCALE = 1e18; // Scaling factor for precision

/**
 * @notice Calculate APY based on TVL and Total Supply
 * @param {number} tvl - The Total Value Locked (amount staked)
 * @param {number} totalSupply - The total token supply
 * @return {number} The calculated APY in percentage (not scaled)
 */
function calculateAPY(tvl, totalSupply) {
  if (tvl === 0 || totalSupply === 0) {
    return MAX_APY; // Return MAX_APY if no TVL
  }

  // Fraction of total supply that is staked
  const stakingRatio = tvl / totalSupply;

  // Use an exponential decay formula to calculate APY
  // APY = MIN_APY + (MAX_APY - MIN_APY) * e^(-k * stakingRatio)
  // Here, `k` is a constant controlling the decay rate
  const k = 5; // Adjust this constant to fit the curve
  const exponent = -k * stakingRatio; // -k * stakingRatio
  const decayFactor = Math.exp(exponent); // e^(-k * stakingRatio)

  // Calculate APY
  const apy = MIN_APY + (MAX_APY - MIN_APY) * decayFactor;

  return apy; // Return APY in percentage
}

// Example Usage
const tvl = 1000000000; // Example TVL
const totalSupply = 1000000000; // Example Total Supply

const apy = calculateAPY(tvl, totalSupply);
console.log(`APY: ${apy.toFixed(2)}%`);
