export const companiesHouseViewsABI = [
  {
    "type": "function",
    "name": "ch",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
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
    "name": "getCompanyStableBalance",
    "inputs": [
      { "name": "_companyId", "type": "uint96", "internalType": "uint96" }
    ],
    "outputs": [
      { "name": "total", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  }
] as const;
