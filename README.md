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

- [>] change names

  - [] Token: WerewolfTokenV1

  - [] DAO: DAOv1

  - [] ...

- [>] create&execute proposals

  - [>] add quorumVotes, proposalThreshold, votingDelay, votingPeriod

  - [>] change into arrays so it can execute multiple functions

  - [] write Timelock contract to handle voting delay, execution after voting period and so on

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

- [] create Constitution

  ```solidity
  uint256 public lawCount;
  mapping(uint256 => Law) public laws;

  struct Law {
      string name;
      string description;
  }

  function addLaw(
        string memory _name,
        string memory _description
    ) external onlyOwner {
        // save new law
        lawCount++;
        laws[lawCount] = Law({name: _name, description: _description});
    }
  ```

- [] test al vulnerabilities

- [] Companies House

  - [] create business

  - [] hire/fire/pause employees

  - [] payEmployees

  - [] give/revoke roles
