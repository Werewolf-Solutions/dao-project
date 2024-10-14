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

        - [>] start token sale

        - test this proposals

          ```solidity
          createProposal(
            address(token),
            "setTreasury(address)",
            abi.encode(newTreasury)
          );
          ```

          ```solidity
          createProposal(
            address(treasury),
            "addAllowedToken(address)",
            abi.encode(_token)
          );
          ```

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

Hi there! I have a problem with abi encoding. What I would like to do is to call contract One function callFunc and call both functions with one and 2 params and ideally even more

This code works with functions with one param and I don't understand why it doesn't work with 2. Could someone explain that to me please?

```solidity
  contract One {
  function callFunc(
          address _targetContract,
          string memory _functionSignature,
          bytes memory _functionParams
      ) public {
          bytes memory callData = abi.encodePacked(
              abi.encodeWithSignature(_functionSignature),
              _functionParams
          );
  targetContract.call(callData);
      }
  }
```

```solidity
  contract Two {
  function oneParam(address a) ...{
  ...
  }
  function twoParams(address a, uint256 b) ...{
  ...
  }
  }
```

I'm encoding \_funcParams like this

```js
const oneParam = hre.ethers.utils.defaultAbiCoder.encode(["address"], [a]);
```

and

```js
const twoParams = hre.ethers.utils.defaultAbiCoder.encode(
  ["address", "uint256"],
  [a, b]
);
```

Then I call the functions like this

```js
callFunc(targetAddress, "oneParam(address)", oneParam);
```

and

```js
callFunc(targetAddress, "twoParams(address,uint256)", twoParams);
```

and please can you tell me why just this doesn't work?

```solidity
  bytes memory callData = abi.encodeWithSignature(
            _functionSignature,
            _functionParams
        );
```
