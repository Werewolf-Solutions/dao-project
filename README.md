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

- [>] TokenSale.sol

  - [>] add logic of after token sale lock tokens in staking and send USD+other tokens from treasury to uniswap as LP and lock or stake WLF_USDT_LP

- [>] write founder buys tokens in token sale for 5000$ in beforeEach

  - [>] what's the flow? I can't start token sale without proposal but I can't start proposal if I don't have enough tokens for proposalThreshold

- [>] add quorumVotes, proposalThreshold

  - [>] use hybrid voting model? or Voting Power Based on Token Holding (Token-Weighted Voting)

    1. Quadratic Voting
       Quadratic voting seeks to balance voting influence between large and small token holders. In this model, the cost (or “voting power”) of each additional vote grows quadratically. For example, if a voter wants to cast four votes, it costs them 16 tokens (since 4\*4=16). This approach ensures that large holders can still influence outcomes, but at a diminishing rate, preventing them from easily overwhelming smaller holders.

    How It Works:
    Voting Power: Each additional vote requires an exponentially higher amount of tokens.
    Influence Distribution: This limits the power of whales, allowing small token holders to have a meaningful impact without being overwhelmed.
    Solidity Implementation Example
    Here’s a basic structure for implementing quadratic voting in Solidity:

    ```solidity
    pragma solidity ^0.8.0;

    contract QuadraticVoting {
    IERC20 public governanceToken;

          // Struct to track votes for a proposal
          struct Proposal {
              uint256 voteCount;
              mapping(address => uint256) votes;
          }

          mapping(uint256 => Proposal) public proposals;

          constructor(address _tokenAddress) {
              governanceToken = IERC20(_tokenAddress);
          }

          function calculateCost(uint256 voteAmount) public pure returns (uint256) {
              return voteAmount * voteAmount; // Quadratic cost
          }

          function vote(uint256 proposalId, uint256 voteAmount) public {
              uint256 cost = calculateCost(voteAmount);
              require(governanceToken.balanceOf(msg.sender) >= cost, "Insufficient tokens");

              // Transfer tokens to contract as a commitment
              governanceToken.transferFrom(msg.sender, address(this), cost);

              proposals[proposalId].voteCount += voteAmount;
              proposals[proposalId].votes[msg.sender] += voteAmount;
          }

          function getVoteCount(uint256 proposalId) public view returns (uint256) {
              return proposals[proposalId].voteCount;
          }

    }
    ```

    In this example:

    Quadratic Cost Calculation: The calculateCost function squares the voteAmount, enforcing quadratic voting costs.
    Token Deduction: The voter transfers tokens equal to the squared vote amount, ensuring that more votes require exponentially more tokens. 2. Minimum Balance Requirement (Sybil Attack Mitigation)
    In this model, each address has one vote, but only if it holds a minimum balance of tokens. This requirement helps prevent Sybil attacks (where an individual splits tokens across multiple addresses to gain more votes). It maintains inclusivity while ensuring voters have a meaningful stake in the project.

    Solidity Implementation Example
    Here’s a simple example with a minimum balance threshold:

    ```solidity
    pragma solidity ^0.8.0;

    contract MinimumBalanceVoting {
    IERC20 public governanceToken;
    uint256 public minBalance;

          mapping(uint256 => uint256) public proposalVotes;
          mapping(uint256 => mapping(address => bool)) public hasVoted;

          constructor(address _tokenAddress, uint256 _minBalance) {
              governanceToken = IERC20(_tokenAddress);
              minBalance = _minBalance;
          }

          function vote(uint256 proposalId) public {
              require(governanceToken.balanceOf(msg.sender) >= minBalance, "Insufficient token balance to vote");
              require(!hasVoted[proposalId][msg.sender], "Address has already voted");

              proposalVotes[proposalId] += 1;
              hasVoted[proposalId][msg.sender] = true;
          }

          function getVoteCount(uint256 proposalId) public view returns (uint256) {
              return proposalVotes[proposalId];
          }

    }
    ```

    In this example:

    Minimum Balance Check: The vote function requires msg.sender to hold a minimum number of tokens.
    One Vote Per Address: Each address can only vote once per proposal. 3. Token-Weighted Voting with a Cap
    This approach allows each voter’s voting power to scale with their holdings but caps the maximum influence any single address can have. This provides a safeguard against whales while still rewarding token holders with more voting power.

    Solidity Implementation Example
    Here’s a basic model for capped token-weighted voting:

    ```solidity
    pragma solidity ^0.8.0;

    contract CappedTokenVoting {
    IERC20 public governanceToken;
    uint256 public voteCap;

          struct Proposal {
              uint256 voteCount;
              mapping(address => uint256) votes;
          }

          mapping(uint256 => Proposal) public proposals;

          constructor(address _tokenAddress, uint256 _voteCap) {
              governanceToken = IERC20(_tokenAddress);
              voteCap = _voteCap; // Max votes any address can have
          }

          function vote(uint256 proposalId, uint256 voteAmount) public {
              uint256 balance = governanceToken.balanceOf(msg.sender);
              uint256 cappedVoteAmount = voteAmount > voteCap ? voteCap : voteAmount;
              require(balance >= cappedVoteAmount, "Insufficient token balance");

              proposals[proposalId].voteCount += cappedVoteAmount;
              proposals[proposalId].votes[msg.sender] += cappedVoteAmount;
          }

          function getVoteCount(uint256 proposalId) public view returns (uint256) {
              return proposals[proposalId].voteCount;
          }

    }
    ```

    In this example:

    Vote Capping: voteCap limits the maximum voting power any single address can have, regardless of their token balance.
    Partial Influence: Larger holders can vote up to a certain amount but cannot overwhelmingly influence the outcome beyond the cap.
    Choosing the Right Hybrid Model
    Each of these hybrid models can be effective depending on your project’s goals:

    Quadratic Voting: Useful if you want to mitigate whale influence while still allowing some proportionality.
    Minimum Balance Requirement: Great for Sybil-resistance while maintaining equal influence for all holders.
    Token-Weighted Voting with a Cap: Balances influence by allowing token holders to have a say proportional to their stake, but prevents excessive control by any single address.
    These hybrid models can also be combined further (e.g., a capped quadratic voting model) to tailor the governance structure for your specific needs. Hybrid models offer a flexible way to balance inclusivity, security, and proportional representation.

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
