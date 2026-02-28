export const treasuryABI = [
  {
    "type": "function",
    "name": "setSwapRouter",
    "inputs": [
      { "name": "_router", "type": "address", "internalType": "address" },
      { "name": "_usdt",   "type": "address", "internalType": "address" },
      { "name": "_fee",    "type": "uint24",  "internalType": "uint24"  }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "buybackWLF",
    "inputs": [
      { "name": "usdtAmount", "type": "uint256", "internalType": "uint256" },
      { "name": "minWLFOut",  "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [{ "name": "wlfReceived", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "swapRouter",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "usdtToken",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "buybackPoolFee",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint24", "internalType": "uint24" }],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "WLFBuyback",
    "inputs": [
      { "name": "usdtSpent",    "type": "uint256", "indexed": false },
      { "name": "wlfReceived",  "type": "uint256", "indexed": false }
    ]
  }
] as const;
