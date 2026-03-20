export const companiesHouseABI = [
  {
    "type": "function",
    "name": "createCompany",
    "inputs": [
      {
        "name": "_params",
        "type": "tuple",
        "internalType": "struct CompaniesHouseV1.CreateCompany",
        "components": [
          { "name": "name",               "type": "string",  "internalType": "string"  },
          { "name": "industry",           "type": "string",  "internalType": "string"  },
          { "name": "domain",             "type": "string",  "internalType": "string"  },
          {
            "name": "roles", "type": "tuple[]",
            "internalType": "struct CompaniesHouseV1.RoleDefinition[]",
            "components": [
              { "name": "name",  "type": "string", "internalType": "string" },
              { "name": "level", "type": "uint8",  "internalType": "uint8"  }
            ]
          },
          { "name": "operatorAddress",    "type": "address", "internalType": "address" },
          { "name": "ownerRole",          "type": "string",  "internalType": "string"  },
          { "name": "ownerRoleLevel",     "type": "uint8",   "internalType": "uint8"   },
          { "name": "ownerSalaryPerHour", "type": "uint256", "internalType": "uint256" },
          { "name": "ownerName",          "type": "string",  "internalType": "string"  }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "hireEmployee",
    "inputs": [
      {
        "name": "_hireParams",
        "type": "tuple",
        "internalType": "struct CompaniesHouseV1.HireEmployee",
        "components": [
          { "name": "employeeAddress", "type": "address",  "internalType": "address" },
          { "name": "name",            "type": "string",   "internalType": "string"  },
          { "name": "companyId",       "type": "uint96",   "internalType": "uint96"  },
          {
            "name": "salaryItems",
            "type": "tuple[]",
            "internalType": "struct CompaniesHouseV1.SalaryItem[]",
            "components": [
              { "name": "role",          "type": "string",  "internalType": "string"  },
              { "name": "earningsType",  "type": "uint8",   "internalType": "enum CompaniesHouseV1.EarningsType" },
              { "name": "salaryPerHour", "type": "uint256", "internalType": "uint256" },
              { "name": "lastPayDate",   "type": "uint256", "internalType": "uint256" }
            ]
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "updateEmployee",
    "inputs": [
      { "name": "_employeeAddress", "type": "address", "internalType": "address" },
      { "name": "_companyId",       "type": "uint96",  "internalType": "uint96"  },
      {
        "name": "_params", "type": "tuple",
        "internalType": "struct CompaniesHouseV1.UpdateEmployee",
        "components": [
          { "name": "name",           "type": "string",  "internalType": "string"  },
          { "name": "payableAddress", "type": "address", "internalType": "address" },
          {
            "name": "salaryItems", "type": "tuple[]",
            "internalType": "struct CompaniesHouseV1.SalaryItem[]",
            "components": [
              { "name": "role",          "type": "string",  "internalType": "string"  },
              { "name": "earningsType",  "type": "uint8",   "internalType": "enum CompaniesHouseV1.EarningsType" },
              { "name": "salaryPerHour", "type": "uint256", "internalType": "uint256" },
              { "name": "lastPayDate",   "type": "uint256", "internalType": "uint256" }
            ]
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "addRoleToEmployee",
    "inputs": [
      { "name": "_employeeAddress", "type": "address", "internalType": "address" },
      { "name": "_companyId",       "type": "uint96",  "internalType": "uint96"  },
      {
        "name": "_item",
        "type": "tuple",
        "internalType": "struct CompaniesHouseV1.SalaryItem",
        "components": [
          { "name": "role",          "type": "string",  "internalType": "string"  },
          { "name": "earningsType",  "type": "uint8",   "internalType": "enum CompaniesHouseV1.EarningsType" },
          { "name": "salaryPerHour", "type": "uint256", "internalType": "uint256" },
          { "name": "lastPayDate",   "type": "uint256", "internalType": "uint256" }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "submitEarning",
    "inputs": [
      { "name": "_employeeAddress", "type": "address", "internalType": "address" },
      { "name": "_companyId",       "type": "uint96",  "internalType": "uint96"  },
      { "name": "_earningsType",    "type": "uint8",   "internalType": "enum CompaniesHouseV1.EarningsType" },
      { "name": "_amount",          "type": "uint256", "internalType": "uint256" },
      { "name": "_description",     "type": "string",  "internalType": "string"  }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "fireEmployee",
    "inputs": [
      { "name": "_employeeAddress", "type": "address", "internalType": "address" },
      { "name": "_companyId",       "type": "uint96",  "internalType": "uint96"  }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setPayrollExecutor",
    "inputs": [
      { "name": "_payrollExecutor", "type": "address", "internalType": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "payrollExecutor",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "canPayEmployee",
    "inputs": [
      { "name": "caller",    "type": "address", "internalType": "address" },
      { "name": "employee",  "type": "address", "internalType": "address" },
      { "name": "companyId", "type": "uint96",  "internalType": "uint96"  }
    ],
    "outputs": [
      { "name": "", "type": "bool", "internalType": "bool" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "calcEmployeeGross",
    "inputs": [
      { "name": "employee",  "type": "address", "internalType": "address" },
      { "name": "companyId", "type": "uint96",  "internalType": "uint96"  }
    ],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "checkCanPay",
    "inputs": [
      { "name": "companyId", "type": "uint96",  "internalType": "uint96"  },
      { "name": "amount",    "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [
      { "name": "", "type": "bool", "internalType": "bool" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "updateCompany",
    "inputs": [
      { "name": "_companyId", "type": "uint96", "internalType": "uint96" },
      {
        "name": "_params",
        "type": "tuple",
        "internalType": "struct CompaniesHouseV1.UpdateCompany",
        "components": [
          { "name": "name",    "type": "string",  "internalType": "string"  },
          { "name": "industry","type": "string",  "internalType": "string"  },
          { "name": "domain",  "type": "string",  "internalType": "string"  },
          {
            "name": "roles", "type": "tuple[]",
            "internalType": "struct CompaniesHouseV1.RoleDefinition[]",
            "components": [
              { "name": "name",  "type": "string", "internalType": "string" },
              { "name": "level", "type": "uint8",  "internalType": "uint8"  }
            ]
          },
          { "name": "operatorAddress", "type": "address", "internalType": "address" }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "deleteCompany",
    "inputs": [
      { "name": "_companyId", "type": "uint96", "internalType": "uint96" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setCompanyRole",
    "inputs": [
      { "name": "_employeeAddress", "type": "address", "internalType": "address" },
      { "name": "_salaryItemIndex", "type": "uint256", "internalType": "uint256" },
      { "name": "_newRole",         "type": "string",  "internalType": "string"  },
      { "name": "_companyId",       "type": "uint96",  "internalType": "uint96"  }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "depositToCompany",
    "inputs": [
      { "name": "companyId", "type": "uint96",   "internalType": "uint96"  },
      { "name": "token",     "type": "address",  "internalType": "address" },
      { "name": "amount",    "type": "uint256",  "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "creditToCompany",
    "inputs": [
      { "name": "companyId", "type": "uint96",   "internalType": "uint96"  },
      { "name": "token",     "type": "address",  "internalType": "address" },
      { "name": "amount",    "type": "uint256",  "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setMinReserveMonths",
    "inputs": [
      { "name": "months", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setUsdcAddress",
    "inputs": [
      { "name": "_usdc", "type": "address", "internalType": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setCompanyReserveMonths",
    "inputs": [
      { "name": "_companyId", "type": "uint96",   "internalType": "uint96"  },
      { "name": "_months",    "type": "uint256",  "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
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
    "name": "setSwapRouter",
    "inputs": [
      { "name": "_swapRouter", "type": "address", "internalType": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "swapRouter",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getOwnerCompanyIds",
    "inputs": [
      { "name": "_owner", "type": "address", "internalType": "address" }
    ],
    "outputs": [
      { "name": "", "type": "uint96[]", "internalType": "uint96[]" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "retrieveCompany",
    "inputs": [
      { "name": "_companyId", "type": "uint96", "internalType": "uint96" }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct CompaniesHouseV1.CompanyStruct",
        "components": [
          { "name": "companyId",    "type": "uint96",  "internalType": "uint96"  },
          { "name": "owner",        "type": "address", "internalType": "address" },
          { "name": "operatorAddress","type": "address", "internalType": "address" },
          { "name": "industry",     "type": "string",  "internalType": "string"  },
          { "name": "name",         "type": "string",  "internalType": "string"  },
          { "name": "createdAt",    "type": "uint256", "internalType": "uint256" },
          { "name": "active",       "type": "bool",    "internalType": "bool"    },
          {
            "name": "employees",
            "type": "tuple[]",
            "internalType": "struct CompaniesHouseV1.Employee[]",
            "components": [
              { "name": "employeeId",    "type": "address", "internalType": "address" },
              { "name": "payableAddress","type": "address", "internalType": "address" },
              { "name": "name",          "type": "string",  "internalType": "string"  },
              { "name": "companyId",     "type": "uint256", "internalType": "uint256" },
              { "name": "hiredAt",       "type": "uint256", "internalType": "uint256" },
              { "name": "active",        "type": "bool",    "internalType": "bool"    },
              {
                "name": "salaryItems",
                "type": "tuple[]",
                "internalType": "struct CompaniesHouseV1.SalaryItem[]",
                "components": [
                  { "name": "role",          "type": "string",  "internalType": "string"  },
                  { "name": "earningsType",  "type": "uint8",   "internalType": "enum CompaniesHouseV1.EarningsType" },
                  { "name": "salaryPerHour", "type": "uint256", "internalType": "uint256" },
                  { "name": "lastPayDate",   "type": "uint256", "internalType": "uint256" }
                ]
              }
            ]
          },
          { "name": "domain", "type": "string", "internalType": "string" },
          {
            "name": "roles", "type": "tuple[]",
            "internalType": "struct CompaniesHouseV1.RoleDefinition[]",
            "components": [
              { "name": "name",  "type": "string", "internalType": "string" },
              { "name": "level", "type": "uint8",  "internalType": "uint8"  }
            ]
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getTotalPendingUSDT",
    "inputs": [
      { "name": "_companyId", "type": "uint96", "internalType": "uint96" }
    ],
    "outputs": [
      { "name": "totalUSDT", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMonthlyBurnUSDT",
    "inputs": [
      { "name": "_companyId", "type": "uint96", "internalType": "uint96" }
    ],
    "outputs": [
      { "name": "usdtPerMonth", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRequiredReserveUSDT",
    "inputs": [
      { "name": "_companyId", "type": "uint96", "internalType": "uint96" }
    ],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getCompanyStableBalance",
    "inputs": [
      { "name": "_companyId", "type": "uint96", "internalType": "uint96" }
    ],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "previewPayroll",
    "inputs": [
      { "name": "_companyId", "type": "uint96", "internalType": "uint96" }
    ],
    "outputs": [
      {
        "name": "items",
        "type": "tuple[]",
        "internalType": "struct CompaniesHouseV1.PayrollPreviewItem[]",
        "components": [
          { "name": "employeeAddress", "type": "address", "internalType": "address" },
          { "name": "name", "type": "string", "internalType": "string" },
          { "name": "grossUSDT", "type": "uint256", "internalType": "uint256" },
          { "name": "fee", "type": "uint256", "internalType": "uint256" },
          { "name": "netUSDT", "type": "uint256", "internalType": "uint256" }
        ]
      },
      { "name": "totalGross", "type": "uint256", "internalType": "uint256" },
      { "name": "totalFee", "type": "uint256", "internalType": "uint256" },
      { "name": "totalNet", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "usdcAddress",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "companyReserveMonths",
    "inputs": [
      { "name": "companyId", "type": "uint96", "internalType": "uint96" }
    ],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "companyTokenBalances",
    "inputs": [
      { "name": "companyId", "type": "uint96",  "internalType": "uint96"  },
      { "name": "token",     "type": "address", "internalType": "address" }
    ],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "minReserveMonths",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
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
    "name": "creationFee",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "currentCompanyIndex",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "uint96", "internalType": "uint96" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "CompanyCreated",
    "inputs": [
      { "name": "owner",     "type": "address", "indexed": true  },
      { "name": "companyId", "type": "uint96",  "indexed": true  }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CompanyUpdated",
    "inputs": [
      { "name": "owner",     "type": "address", "indexed": true },
      { "name": "companyId", "type": "uint96",  "indexed": true }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CompanyDeleted",
    "inputs": [
      { "name": "owner",     "type": "address", "indexed": true },
      { "name": "companyId", "type": "uint96",  "indexed": true }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CompanyFunded",
    "inputs": [
      { "name": "companyId", "type": "uint96",  "indexed": true  },
      { "name": "token",     "type": "address", "indexed": true  },
      { "name": "amount",    "type": "uint256", "indexed": false }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EmployeeHired",
    "inputs": [
      { "name": "employee", "type": "address", "indexed": true }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EmployeeUpdated",
    "inputs": [
      { "name": "employee",  "type": "address", "indexed": true },
      { "name": "companyId", "type": "uint96",  "indexed": true }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EmployeeFired",
    "inputs": [
      { "name": "employee", "type": "address", "indexed": true }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EmployeePaid",
    "inputs": [
      { "name": "employee",    "type": "address", "indexed": true  },
      { "name": "usdtAmount",  "type": "uint256", "indexed": false }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RoleAdded",
    "inputs": [
      { "name": "employee",  "type": "address", "indexed": true  },
      { "name": "companyId", "type": "uint96",  "indexed": true  },
      { "name": "role",      "type": "string",  "indexed": false }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EarningSubmitted",
    "inputs": [
      { "name": "employee",     "type": "address", "indexed": true  },
      { "name": "companyId",    "type": "uint96",  "indexed": true  },
      { "name": "earningsType", "type": "uint8",   "indexed": false },
      { "name": "amount",       "type": "uint256", "indexed": false },
      { "name": "description",  "type": "string",  "indexed": false }
    ],
    "anonymous": false
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
  {
    "type": "function",
    "name": "paused",
    "inputs": [],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
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
  },
  {
    "type": "function",
    "name": "wlfFeeBps",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nonWlfFeeBps",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setFees",
    "inputs": [
      { "name": "_wlfFeeBps",    "type": "uint256", "internalType": "uint256" },
      { "name": "_nonWlfFeeBps", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "daoCompanyId",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint96", "internalType": "uint96" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setDaoCompanyId",
    "inputs": [{ "name": "_id", "type": "uint96", "internalType": "uint96" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "ProtocolFeePaid",
    "inputs": [
      { "name": "companyId",  "type": "uint96",  "indexed": true  },
      { "name": "token",      "type": "address", "indexed": true  },
      { "name": "feeAmount",  "type": "uint256", "indexed": false }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CompanyReserveMonthsSet",
    "inputs": [
      { "name": "companyId", "type": "uint96",  "indexed": true  },
      { "name": "months",    "type": "uint256", "indexed": false }
    ],
    "anonymous": false
  },
  // ── CompanyVault integration ───────────────────────────────────────────────
  {
    "type": "function",
    "name": "beacon",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "companyVault",
    "inputs": [{ "name": "companyId", "type": "uint96" }],
    "outputs": [{ "name": "", "type": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setBeacon",
    "inputs": [{ "name": "_beacon", "type": "address" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "createVault",
    "inputs": [
      { "name": "_companyId", "type": "uint96" },
      { "name": "_aavePool", "type": "address" },
      { "name": "_allowedToken", "type": "address" }
    ],
    "outputs": [{ "name": "vault", "type": "address" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "VaultCreated",
    "inputs": [
      { "name": "companyId", "type": "uint96",  "indexed": true },
      { "name": "vault",     "type": "address", "indexed": true }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "VaultBeaconSet",
    "inputs": [
      { "name": "beacon", "type": "address", "indexed": true }
    ],
    "anonymous": false
  }
] as const;
