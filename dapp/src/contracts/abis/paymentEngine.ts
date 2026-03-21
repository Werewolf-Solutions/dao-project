// PaymentType enum: 0=PAYROLL, 1=SUBSCRIPTION, 2=COMMISSION, 3=REVENUE_SHARE
export const paymentEngineABI = [
  // ── Edge management ───────────────────────────────────────────────────────
  {
    "type": "function",
    "name": "addEdge",
    "inputs": [
      { "name": "from",      "type": "address", "internalType": "address" },
      { "name": "to",        "type": "address", "internalType": "address" },
      { "name": "pType",     "type": "uint8",   "internalType": "enum IPaymentEngine.PaymentType" },
      { "name": "rateUSDT",  "type": "uint96",  "internalType": "uint96"  },
      { "name": "period",    "type": "uint48",  "internalType": "uint48"  },
      { "name": "companyId", "type": "uint96",  "internalType": "uint96"  }
    ],
    "outputs": [{ "name": "edgeId", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "removeEdge",
    "inputs": [{ "name": "edgeId", "type": "uint256", "internalType": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  // ── Settlement ────────────────────────────────────────────────────────────
  {
    "type": "function",
    "name": "settleEdges",
    "inputs": [
      { "name": "edgeIds", "type": "uint256[]", "internalType": "uint256[]" },
      { "name": "asOf",    "type": "uint48",    "internalType": "uint48"    }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "triggerCommission",
    "inputs": [
      { "name": "edgeId",     "type": "uint256", "internalType": "uint256" },
      { "name": "saleAmount", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setRevenueRecipients",
    "inputs": [
      { "name": "edgeId",     "type": "uint256",    "internalType": "uint256"   },
      { "name": "recipients", "type": "address[]",  "internalType": "address[]" },
      { "name": "bps",        "type": "uint16[]",   "internalType": "uint16[]"  }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  // ── Admin config ──────────────────────────────────────────────────────────
  {
    "type": "function",
    "name": "setOracle",
    "inputs": [{ "name": "_oracle", "type": "address", "internalType": "address" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setAdmin",
    "inputs": [{ "name": "_admin", "type": "address", "internalType": "address" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setPayrollExecutor",
    "inputs": [{ "name": "_payrollExecutor", "type": "address", "internalType": "address" }],
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
  // ── Views ─────────────────────────────────────────────────────────────────
  {
    "type": "function",
    "name": "admin",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "oracle",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "payrollExecutor",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "companiesHouse",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "edgeCounter",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "paused",
    "inputs": [],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getEdge",
    "inputs": [{ "name": "edgeId", "type": "uint256", "internalType": "uint256" }],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct PaymentEngine.EdgeData",
        "components": [
          {
            "name": "edge",
            "type": "tuple",
            "internalType": "struct IPaymentEngine.PaymentEdge",
            "components": [
              { "name": "id",          "type": "uint256", "internalType": "uint256" },
              { "name": "from",        "type": "address", "internalType": "address" },
              { "name": "to",          "type": "address", "internalType": "address" },
              { "name": "pType",       "type": "uint8",   "internalType": "enum IPaymentEngine.PaymentType" },
              { "name": "rateUSDT",    "type": "uint96",  "internalType": "uint96"  },
              { "name": "lastSettled", "type": "uint48",  "internalType": "uint48"  },
              { "name": "period",      "type": "uint48",  "internalType": "uint48"  },
              { "name": "active",      "type": "bool",    "internalType": "bool"    }
            ]
          },
          { "name": "companyId", "type": "uint96", "internalType": "uint96" }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getOrgEdgeIds",
    "inputs": [{ "name": "from", "type": "address", "internalType": "address" }],
    "outputs": [{ "name": "", "type": "uint256[]", "internalType": "uint256[]" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getEdgesBatch",
    "inputs": [
      { "name": "from",    "type": "address", "internalType": "address" },
      { "name": "fromIdx", "type": "uint256", "internalType": "uint256" },
      { "name": "toIdx",   "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [
      {
        "name": "result",
        "type": "tuple[]",
        "internalType": "struct PaymentEngine.EdgeData[]",
        "components": [
          {
            "name": "edge",
            "type": "tuple",
            "internalType": "struct IPaymentEngine.PaymentEdge",
            "components": [
              { "name": "id",          "type": "uint256", "internalType": "uint256" },
              { "name": "from",        "type": "address", "internalType": "address" },
              { "name": "to",          "type": "address", "internalType": "address" },
              { "name": "pType",       "type": "uint8",   "internalType": "enum IPaymentEngine.PaymentType" },
              { "name": "rateUSDT",    "type": "uint96",  "internalType": "uint96"  },
              { "name": "lastSettled", "type": "uint48",  "internalType": "uint48"  },
              { "name": "period",      "type": "uint48",  "internalType": "uint48"  },
              { "name": "active",      "type": "bool",    "internalType": "bool"    }
            ]
          },
          { "name": "companyId", "type": "uint96", "internalType": "uint96" }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRevenueRecipients",
    "inputs": [{ "name": "edgeId", "type": "uint256", "internalType": "uint256" }],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "internalType": "struct PaymentEngine.RevenueRecipient[]",
        "components": [
          { "name": "recipient", "type": "address", "internalType": "address" },
          { "name": "bps",       "type": "uint16",  "internalType": "uint16"  }
        ]
      }
    ],
    "stateMutability": "view"
  },
  // ── Events ────────────────────────────────────────────────────────────────
  {
    "type": "event",
    "name": "EdgeAdded",
    "inputs": [
      { "name": "id",        "type": "uint256", "indexed": true  },
      { "name": "from",      "type": "address", "indexed": true  },
      { "name": "to",        "type": "address", "indexed": true  },
      { "name": "pType",     "type": "uint8",   "indexed": false },
      { "name": "companyId", "type": "uint96",  "indexed": false }
    ]
  },
  {
    "type": "event",
    "name": "EdgeRemoved",
    "inputs": [
      { "name": "id", "type": "uint256", "indexed": true }
    ]
  },
  {
    "type": "event",
    "name": "EdgeSettled",
    "inputs": [
      { "name": "id",     "type": "uint256", "indexed": true  },
      { "name": "amount", "type": "uint256", "indexed": false },
      { "name": "asOf",   "type": "uint48",  "indexed": false }
    ]
  },
  {
    "type": "event",
    "name": "CommissionTriggered",
    "inputs": [
      { "name": "id",         "type": "uint256", "indexed": true  },
      { "name": "saleAmount", "type": "uint256", "indexed": false },
      { "name": "commission", "type": "uint256", "indexed": false }
    ]
  },
  {
    "type": "event",
    "name": "RevenueRecipientsSet",
    "inputs": [
      { "name": "id",             "type": "uint256", "indexed": true  },
      { "name": "recipientCount", "type": "uint256", "indexed": false }
    ]
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
