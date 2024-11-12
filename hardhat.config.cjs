require("@nomiclabs/hardhat-waffle");
const path = require("path");

const DEFAULT_COMPILER_SETTINGS = {
  version: "0.7.6",
  settings: {
    evmVersion: "istanbul",
    optimizer: {
      enabled: true,
      runs: 1_000_000,
    },
    metadata: {
      bytecodeHash: "none",
    },
  },
};

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.27",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      DEFAULT_COMPILER_SETTINGS,
    ],
  },
  networks: {
    ganache: {
      url: "http://127.0.0.1:8545",
      gasPrice: 20000000000,
      gas: 6000000,
      accounts: [
        "0x64f31ad5bb344c3c6a1459797a69bd674ece816e097ff6a4e82f6d1a8c265604",
        "0xb10119ccdacc3d6cf209b929ebdf7a0dd5bda732fcbc8c467c42e53fa758719e",
        "0x896acc5eb58ba0b8893a62a2cbb894465661da7dec42997a93bd1ca74c892965",
      ],
    },
  },
};
