export const payrollExecutorABI = [
  // ── Immediate pay ─────────────────────────────────────────────────────────
  {
    "type": "function",
    "name": "payEmployee",
    "inputs": [
      { "name": "employee",  "type": "address", "internalType": "address" },
      { "name": "companyId", "type": "uint96",  "internalType": "uint96"  }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "payEmployees",
    "inputs": [
      { "name": "companyId", "type": "uint96", "internalType": "uint96" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "payEmployeesBatch",
    "inputs": [
      { "name": "companyId",  "type": "uint96",  "internalType": "uint96"  },
      { "name": "fromIndex",  "type": "uint256", "internalType": "uint256" },
      { "name": "toIndex",    "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "payEmployeeWithTokens",
    "inputs": [
      { "name": "employee",   "type": "address", "internalType": "address" },
      { "name": "companyId",  "type": "uint96",  "internalType": "uint96"  },
      { "name": "usdtAmount", "type": "uint256", "internalType": "uint256" },
      { "name": "wlfToken",   "type": "address", "internalType": "address" },
      { "name": "wlfAmount",  "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  // ── Queue system ──────────────────────────────────────────────────────────
  {
    "type": "function",
    "name": "queuePayroll",
    "inputs": [
      { "name": "companyId", "type": "uint96", "internalType": "uint96" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "executeQueue",
    "inputs": [
      { "name": "companyId", "type": "uint96", "internalType": "uint96" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "executeQueueBatch",
    "inputs": [
      { "name": "companyId", "type": "uint96",  "internalType": "uint96"  },
      { "name": "fromIndex", "type": "uint256", "internalType": "uint256" },
      { "name": "toIndex",   "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "cancelQueue",
    "inputs": [
      { "name": "companyId", "type": "uint96", "internalType": "uint96" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  // ── Views ─────────────────────────────────────────────────────────────────
  {
    "type": "function",
    "name": "getQueue",
    "inputs": [
      { "name": "companyId", "type": "uint96", "internalType": "uint96" }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct PayrollExecutor.CompanyQueue",
        "components": [
          {
            "name": "payments",
            "type": "tuple[]",
            "internalType": "struct PayrollExecutor.QueuedPayment[]",
            "components": [
              { "name": "employee",  "type": "address", "internalType": "address" },
              { "name": "grossUSDT", "type": "uint256", "internalType": "uint256" },
              { "name": "feeUSDT",   "type": "uint256", "internalType": "uint256" },
              { "name": "netUSDT",   "type": "uint256", "internalType": "uint256" }
            ]
          },
          { "name": "snapshotTimestamp", "type": "uint256", "internalType": "uint256" },
          { "name": "executedCount",     "type": "uint256", "internalType": "uint256" },
          { "name": "active",            "type": "bool",    "internalType": "bool"    }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hasActiveQueue",
    "inputs": [
      { "name": "companyId", "type": "uint96", "internalType": "uint96" }
    ],
    "outputs": [
      { "name": "", "type": "bool", "internalType": "bool" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "companiesHouse",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "admin",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "paused",
    "inputs": [],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  // ── Admin ──────────────────────────────────────────────────────────────────
  {
    "type": "function",
    "name": "setAdmin",
    "inputs": [
      { "name": "_admin", "type": "address", "internalType": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "pause",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "unpause",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  // ── Events ────────────────────────────────────────────────────────────────
  {
    "type": "event",
    "name": "PayrollQueued",
    "inputs": [
      { "name": "companyId",          "type": "uint96",  "indexed": true  },
      { "name": "snapshotTimestamp",  "type": "uint256", "indexed": false },
      { "name": "employeeCount",      "type": "uint256", "indexed": false },
      { "name": "totalGross",         "type": "uint256", "indexed": false }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PayrollExecuted",
    "inputs": [
      { "name": "companyId",     "type": "uint96",  "indexed": true  },
      { "name": "executedCount", "type": "uint256", "indexed": false },
      { "name": "totalNet",      "type": "uint256", "indexed": false }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PayrollQueueCancelled",
    "inputs": [
      { "name": "companyId", "type": "uint96", "indexed": true }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PaymentSkipped",
    "inputs": [
      { "name": "companyId", "type": "uint96",  "indexed": true },
      { "name": "employee",  "type": "address", "indexed": true }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Paused",
    "inputs": [{ "name": "account", "type": "address", "indexed": false }]
  },
  {
    "type": "event",
    "name": "Unpaused",
    "inputs": [{ "name": "account", "type": "address", "indexed": false }]
  }
] as const;
