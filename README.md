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

> contracts https://chatgpt.com/c/66fd4ee3-b528-800f-978c-79cb87e71b03

> sim https://chatgpt.com/c/67038b69-4b08-800f-8e7d-892a683fd1f4

> https://aragon.org/how-to/structure-dao-proposals-and-build-proposal-processes

> Bankless community
>
> https://forum.bankless.community/t/project-proposal-framework/1431

> AAVE
>
> https://docs.aave.com/governance

> YEARN
>
> https://docs.yearn.finance/contributing/governance/governance-and-operations

> COMP
>
> https://medium.com/compound-finance/compound-governance-5531f524cf68
>
> Token https://etherscan.io/token/0xc00e94cb662c3520282e6f5717214004a7f26888#code
>
> Governor https://etherscan.io/address/0xc0dA01a04C3f3E0be433606045bB7017A7323E38#code
>
> https://github.com/compound-finance/compound-protocol/releases/tag/v2.5-rc2

# v0.0.1 - init

- [>] create dao-project

  - [>] write deploy flow, ownership problems? DAO, Treasury, Token how do they own each other? Who can do what?

    - DAO(token, treasury)

      - [>] create proposals

        - [>] mint tokens to treasury

        - [>] start token sale

        - [>] add quorumVotes, proposalThreshold, votingDelay, votingPeriod

      - Companies House

        - [] create business

        - [] hire/fire/pause employees

        - [] payEmployees

        - [] give/revoke roles

    - Treasury(founder)

    - Token(treasury)

      - on deploy mint to owner and send to treasury

      - set DAO address so only DAO can mint tokens

    - [] write Timelock contract

    > https://etherscan.io/address/0x6d903f6003cca6255D85CcA4D3B5E5146dC33925#code

    ```solidity
    contract Timelock {
        mapping(uint256 => uint256) public proposalTimelocks;

        function setTimelock(uint256 proposalId, uint256 delay) external {
            // Implement efficient timelock management
        }

        function executeProposal(uint256 proposalId) external {
            // Ensure timelocked proposals execute correctly
        }
    }
    ```

  - [>] connect metamask to ganache wallet with private key

- [>] change names

  - [] Token: WerewolfTokenV1

  - [] DAO: GovernorV1

  - [] ...
