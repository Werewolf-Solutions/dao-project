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
>
> timelock https://etherscan.io/address/0x6d903f6003cca6255D85CcA4D3B5E5146dC33925#code

# v0.0.1 - init

- [>] add quorumVotes, proposalThreshold, votingDelay, votingPeriod

- [>] write delegate and undelegate functions in DAO? and test them

- [>] Stake.sol

- [>] finish sim `npm run sim` for tokenomics

  ex:

  total supply = 1,000,000,000 WLF

  initial airdrop for tests = 20,000????

  #### token sale #0

  - goal = 500,000$ => TVL
  - my 5,000$ = 1% of shares = 500,000
  - price = 0.01$
  - tokens = 50,000,000 staked for 10 years
  - of total supply = 5%

  #### token sale #1

  #### employees payment

  - token price = 0.01$
  - monthly payment = 2,000$
  - of TVL
  - token monthly payment = 2,000,000
  - of total supply = 0.2%

- [>] TokenSale.sol

  - [>] Stake 2 years (or how much it will take for me to get paid the same - ex tokensale = 50M tokens, me 2M tokens per month, if save all 25 months)

  - [>] after token sale #0 delegate voting power to me or multiSig with team?

- [>] Companies House

  - [] create business

  - [] hire/fire/pause employees

  - [] payEmployees

  - [] give/revoke roles

  - [] payEmployees: payment amount should be calculated on uniswap price or oracle like chainlink price

- [>>] test al vulnerabilities

  - [] payEmployees:: payPeriod is not the same for everyone so find another way to `require(payPeriod > 0,"Not enough time has passed to pay employee");`

  - []

- [] Constitution.sol

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
