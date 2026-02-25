// Contract addresses per chain ID.
// Local (Anvil, chainId 31337): update after each `forge script script/Deploy.s.sol --broadcast`
//   by reading script/output/deployed-addresses.txt
// Sepolia (chainId 11155111): update after Sepolia deployment

export const ADDRESSES: Record<number, Record<string, `0x${string}`>> = {
  31337: {
    WerewolfToken: "0x0165878A594ca255338adfa4d48449f69242Eb8F",
    Treasury:      "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    TimeLock:      "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    Staking:       "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318",
    DAO:           "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e",
    TokenSale:     "0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82",
    USDT:          "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  },
  11155111: {
    WerewolfToken: "0x998abeb3E57409262aE5b751f60747921B33613E",
    Treasury:      "0x1613beB3B2C4f22Ee086B2b38C1476A3cE7f78E8",
    TimeLock:      "0xf5059a5D33d5853360D16C683c16e67980206f36",
    Staking:       "0x99bbA657f2BbC93c02D617f8bA121cB8Fc104Acf",
    DAO:           "0x8f86403A4DE0BB5791fa46B8e795C547942fE4Cf",
    TokenSale:     "0x5eb3Bc0a489C5A8288765d2336659EbCA68FCd00",
    USDT:          "0xc3e53F4d16Ae77Db1c982e75a937B9f60FE63690",
  },
};

/** Returns contract address for the given chain, or undefined if not configured. */
export function getAddress(chainId: number | undefined, name: string): `0x${string}` | undefined {
  if (!chainId) return undefined;
  return ADDRESSES[chainId]?.[name];
}
