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

---

these are the functions

```solidity
function createProposal(
address \_targetContract,
string memory \_functionSignature,
bytes memory \_functionParams
) public {
require(
token.balanceOf(msg.sender) >= proposalCost,
"Insufficient balance to create proposal"
);

        // Transfer the proposal cost to the treasury address
        require(
            token.transferFrom(msg.sender, treasuryAddress, proposalCost),
            "Token transfer for proposal cost failed"
        );

        // This works with mint
        bytes memory callData = abi.encodePacked(
            bytes4(keccak256(bytes(_functionSignature))),
            _functionParams
        );

        proposals[proposalCount] = Proposal({
            proposer: msg.sender,
            targetContract: _targetContract,
            callData: callData,
            votes: 0,
            executed: false
        });
        proposalCount++;
    }
```

```solidity
function executeProposal(uint256 proposalId) external {
Proposal storage proposal = proposals[proposalId];
require(!proposal.executed, "Proposal already executed");

        // Before the function call
        require(
            proposal.targetContract != address(0),
            "Invalid target contract"
        );

        require(
            treasury.owner() == address(this),
            "DAO is not the owner of the Treasury"
        );

        // Calculate circulating supply
        uint256 circulatingSupply = token.totalSupply() -
            token.balanceOf(address(treasury));

        // Check if votes exceed half of the circulating supply
        require(
            proposal.votes > circulatingSupply / 2,
            "Proposal must be passed to execute"
        );

        proposal.executed = true;

        // Execute the function call using low-level call
        (bool success, ) = proposal.targetContract.call(proposal.callData);
        require(success, "Function call failed");
    }
```

and this is how I call them

```js
const proposalCost = hre.ethers.utils.parseUnits("10", 18);

// Create a proposal to airdrop tokens from Treasury to addr1
const functionParams = hre.ethers.utils.defaultAbiCoder.encode(
  ["address", "uint256"],
  [addr2.address, ethers.utils.parseUnits("100", 18)]
);

// Approve DAO to spend proposalCost tokens on behalf of founder
await token.connect(founder).approve(dao.address, proposalCost);

await dao
  .connect(founder)
  .createProposal(treasury.address, "airdrop(address,uint256)", functionParams);

// Token holders (founder, addr1) vote on the proposal
await dao.connect(addr1).vote(0);
await dao.connect(founder).vote(0);

await dao.executeProposal(0);
```

it gives me the error `VM Exception while processing transaction: revert Function call failed`

but instead if I do this

```js
const mintAmount = hre.ethers.utils.parseUnits("1000", 18);

// Prepare the function call data to mint tokens
const mintProposalCallData = hre.ethers.utils.defaultAbiCoder.encode(
  ["uint256"],
  [mintAmount]
);

// Cost for the proposal
const proposalCost = hre.ethers.utils.parseUnits("10", 18);

// Approve DAO to spend proposalCost tokens on behalf of founder
await token.connect(founder).approve(dao.address, proposalCost);

// Founder creates a proposal to mint tokens to the Treasury
await dao
  .connect(founder)
  .createProposal(token.address, "mint(uint256)", mintProposalCallData);

// Cast votes from all participants
await dao.connect(founder).vote(0);
await dao.connect(addr1).vote(0);
await dao.connect(addr2).vote(0);

// Execute the proposal (if it directly calls callContractFunc, don't call it separately)
await dao.executeProposal(0);
```

it works. Why? Why does it work for mint(uint256) and not for airdrop(address, uint256)?

in Treasury.sol

```solidity
function airdrop(address to, uint256 amount) external onlyOwner {
require(
token.balanceOf(address(this)) >= amount,
"Insufficient balance"
);
token.transfer(to, amount);
}
```

in Token.sol

```solidity
function mint(uint256 amount) external onlyOwner {
require(amount > 0, "Mint amount must be greater than zero");
\_mint(treasury, amount);
}
```
