export const orgWalletABI = [
  // ── Initializer ───────────────────────────────────────────────────────────
  {
    "type": "function",
    "name": "initialize",
    "inputs": [
      { "name": "_org",   "type": "address", "internalType": "address" },
      { "name": "_owner", "type": "address", "internalType": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  // ── Execution ─────────────────────────────────────────────────────────────
  {
    "type": "function",
    "name": "execute",
    "inputs": [
      { "name": "to",    "type": "address", "internalType": "address" },
      { "name": "value", "type": "uint256", "internalType": "uint256" },
      { "name": "data",  "type": "bytes",   "internalType": "bytes"   }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "executeBatch",
    "inputs": [
      {
        "name": "calls",
        "type": "tuple[]",
        "internalType": "struct IPaymentEngine.Call[]",
        "components": [
          { "name": "to",    "type": "address", "internalType": "address" },
          { "name": "value", "type": "uint256", "internalType": "uint256" },
          { "name": "data",  "type": "bytes",   "internalType": "bytes"   }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  // ── Operator management ───────────────────────────────────────────────────
  {
    "type": "function",
    "name": "authorizeOperator",
    "inputs": [{ "name": "op", "type": "address", "internalType": "address" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "revokeOperator",
    "inputs": [{ "name": "op", "type": "address", "internalType": "address" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  // ── Views ─────────────────────────────────────────────────────────────────
  {
    "type": "function",
    "name": "org",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isOperator",
    "inputs": [{ "name": "op", "type": "address", "internalType": "address" }],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  // ── Events ────────────────────────────────────────────────────────────────
  {
    "type": "event",
    "name": "Executed",
    "inputs": [
      { "name": "to",    "type": "address", "indexed": true  },
      { "name": "value", "type": "uint256", "indexed": false },
      { "name": "data",  "type": "bytes",   "indexed": false }
    ]
  },
  {
    "type": "event",
    "name": "BatchExecuted",
    "inputs": [
      { "name": "count", "type": "uint256", "indexed": false }
    ]
  },
  {
    "type": "event",
    "name": "OperatorAuthorized",
    "inputs": [
      { "name": "op", "type": "address", "indexed": true }
    ]
  },
  {
    "type": "event",
    "name": "OperatorRevoked",
    "inputs": [
      { "name": "op", "type": "address", "indexed": true }
    ]
  }
] as const;
