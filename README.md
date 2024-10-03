# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.js

npx hardhat --network localhost test
```

> https://chatgpt.com/c/66fd4ee3-b528-800f-978c-79cb87e71b03

# v0.0.1 - init

- [>] create dao-project

  - [>] write deploy flow, ownership problems? DAO, Treasury, Token how do they own each other? Who can do what?

    - DAO(token, founder=owner)

    - Treasury(dao)

    - Token()

      - on deploy mint to owner and send to treasury

      - set DAO address so only DAO can mint tokens

  - [>] connect metamask to ganache wallet with private key

- [>] change names

  - [] Token: WerewolfTokenV1

  - [] DAO: GovernorV1

  - [] ...
