import { useReadContract, useChainId } from 'wagmi';
import { getAddress } from '@/contracts/addresses';

// Uniswap V3 Factory addresses per chain
const UNISWAP_V3_FACTORY: Record<number, `0x${string}`> = {
  11155111: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c', // Sepolia
};

const POOL_FEE = 500; // 0.05%

const factoryAbi = [
  {
    name: 'getPool',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'fee', type: 'uint24' },
    ],
    outputs: [{ name: 'pool', type: 'address' }],
  },
] as const;

const poolAbi = [
  {
    name: 'slot0',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'observationIndex', type: 'uint16' },
      { name: 'observationCardinality', type: 'uint16' },
      { name: 'observationCardinalityNext', type: 'uint16' },
      { name: 'feeProtocol', type: 'uint8' },
      { name: 'unlocked', type: 'bool' },
    ],
  },
] as const;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Returns the live Uniswap V3 WLF/USDT price in human USDT (e.g. 0.001 = $0.001).
 * Refreshes every 30 seconds. Returns null while loading or on unsupported chain.
 */
export function useWLFPrice(): number | null {
  const chainId = useChainId();
  const factoryAddress = UNISWAP_V3_FACTORY[chainId];
  const usdtAddress = getAddress(chainId, 'USDT');
  const wlfAddress = getAddress(chainId, 'WerewolfToken');

  // Sort tokens: Uniswap V3 requires token0 < token1 by address
  const sorted = usdtAddress && wlfAddress
    ? (usdtAddress.toLowerCase() < wlfAddress.toLowerCase()
      ? { token0: usdtAddress, token1: wlfAddress, usdtIsToken0: true }
      : { token0: wlfAddress, token1: usdtAddress, usdtIsToken0: false })
    : null;

  const { data: poolAddress } = useReadContract({
    address: factoryAddress,
    abi: factoryAbi,
    functionName: 'getPool',
    args: sorted ? [sorted.token0, sorted.token1, POOL_FEE] : undefined,
    query: { enabled: !!factoryAddress && !!sorted },
  });

  const validPool = poolAddress && poolAddress !== ZERO_ADDRESS
    ? poolAddress as `0x${string}`
    : undefined;

  const { data: slot0 } = useReadContract({
    address: validPool,
    abi: poolAbi,
    functionName: 'slot0',
    query: {
      enabled: !!validPool,
      refetchInterval: 30_000,
    },
  });

  if (!slot0 || !sorted) return null;

  try {
    const sqrtP = slot0[0]; // sqrtPriceX96 as BigInt
    if (sqrtP === 0n) return null;

    // sqrtPriceX96 = sqrt(token1_raw / token0_raw) * 2^96
    // price (token1_raw per token0_raw) = sqrtP^2 / 2^192
    //
    // Case: USDT=token0 (6 dec), WLF=token1 (18 dec)
    //   USDT_per_WLF (human) = 2^192 / sqrtP^2 / 10^12
    //   As raw USDT (×10^6): 2^192 * 10^6 / (sqrtP^2 * 10^12) = 2^192 / (sqrtP^2 * 10^6)
    //   Equivalently: usdtRaw = 2^192 * 10^18 / sqrtP^2  (then divide by 10^6 for float)
    //
    // Case: WLF=token0 (18 dec), USDT=token1 (6 dec)
    //   USDT_per_WLF (human) = sqrtP^2 * 10^12 / 2^192
    //   As raw USDT: sqrtP^2 * 10^18 / 2^192  (then divide by 10^6 for float)

    let usdtRaw: bigint;
    if (sorted.usdtIsToken0) {
      usdtRaw = (2n ** 192n * 10n ** 18n) / (sqrtP * sqrtP);
    } else {
      usdtRaw = (sqrtP * sqrtP * 10n ** 18n) / 2n ** 192n;
    }

    return Number(usdtRaw) / 1e6;
  } catch {
    return null;
  }
}
