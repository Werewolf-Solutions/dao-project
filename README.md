# DAO project

- trello board https://trello.com/b/bOGxJpTY/dao-project

- discord https://discord.gg/DVDtsbHp

# TODO

- [] **token sale**

  - [] buyTokens

    - [] add liquidity to uniswap `WLF_(token)`

      > https://docs.uniswap.org/contracts/v3/guides/providing-liquidity/setting-up

    - [] stake `WLF_(token)_LP`

- [] **staking**

  - [] calculateAPY

  - [] fixed staking

  - [] flexible staking

- [>] **DAO**

  > `forge test -vvvv DaoTest.t.sol`

  - [?] implement OZ contracts https://docs.openzeppelin.com/contracts/5.x/governance

  - [>] create/queue/execute proposals

  - [] use checkPoints for voting power (`WLF`, `sWLF`, `sWLF_(token)_LP`)

  - [] add emergency proposal when `emergency_pause` function is called by the 100% of voting power and only if proposal is queued

  - **dao proposal flow**

  - normal:

    - create proposal

    - `reviewingPeriod = 2 days`

    - `votingPeriod = 3 days`

    - if proposal is succeeded `quorum = 60%` and `threshold = 51%` the proposal is queued for `queuePeriod = 2 days`

  - emergency (is created automatically from multisig?)

    - create proposal(targets: [`DAO.address`, `DAO.address`], signatures: [`emergencyPause(uint256 proposalId)`, `emergencyCancel(uint256 proposalId)`], calldatas: [`encode(proposalId)`, `encode(proposalId)`])

    - `emergencyReviewingPeriod = 0 days` is automatically active

    - `emergencyVotingPeriod = 7 days`

    - if proposal is succeeded `emergencyQuorum = 100%` and `emergencyThreshold = 100%` the proposal is not queued but it's automatically executed `emergencyQueuePeriod = 0 days`

- [] **companiesHouse**

  - [] CRUD company

  - [] hire/fire employees/collaborators

  - [] pay employees/collaborators

  - [] give/revoke role

- []

- [] ...

# Summary

- You can read deploy steps [here](#deploy-steps)

## Contract Layout and Natspec

//Example function natspec:
/\*\*

- @notice Explain what this function does
- @param Documents a parameter just like in doxygen (must be followed by parameter name)
- @return Documents the return variables of a contract’s function state variable
- @inheritdoc Copies all missing tags from the base function (must be followed by the contract name)
  \*/

//When adding anything please follow the contract layout
/_ Contract layout:
Data types: structs, enums, and type declarations
State Variables
Events
Function Modifiers
Constructor/Initialize
Fallback and Receive function
External functions
Public functions
Internal functions
Private Functions
_/

## DAO

DAO controls all the contracts via proposals that are queued and executed by the Timelock

- can do:

  - sets fee

  - add/remove supported tokens

  - remove companies that don't follow guidelines

  - change threshold, quorumVotes and so on

## Staking

Contract to handle staking.

Staking can be with a fixed or variable duration.

## Token Sale

There's different token sales.

- #0 is just for founder (or any other initial supporter) and it's just so that DAO can start functioning (threshold 0.5%)

- #1 is the official token sale with same price of #0

Both #0 and #1 (and we should add like a flag so we can set each one if they follow this rule) all tokens are added as liquidity to uniswap and token_LP is staked for a fixed staking period.

Both #0 and #1 (same of above we might need to add a flag) voting power is delegated to founder (or multisig or something like that) so that we wait for token distribution before DAO has full power.

## WerewolfToken

This is the contract for the token.

## CompaniesHouse

It's were an user can create and manage a company.

the owner can hire/fire/pay employees/collaborators.

This will be connected to an off chain accounting/ERP software. I think it could be some sort of oracle. I'd like to be able to audit a company with one click and see all financial/economy data with 100% accuracy.

## Treasury

This is the treasury for the DAO but I was thinking that each company should have a treasury? or the treasury will be the wallet of the company itself?

# Roles

## Admin

What does admin do that it cannot be done by DAO?

## User

Can:

- stake tokens

- claim rewards

- CRUD company

- if token holder can create/vote proposals

## Company employee

roles:

- founder

- CEO

- HHR: head human resources

- dev

- ...

# Style Guidelines

# Deploy Locally

1 - run `make deploy-local`

...

# Deploy Steps:

1. **Deploy Contracts**  
   The founder deploys the following contracts in sequence:

   - `WerewolfTokenV1` with references to `Treasury` and `Timelock`.
   - `Treasury` and `Timelock` for managing funds and governance, respectively.
   - `Staking` for managing long-term token locking.
   - `DAO` for governance proposals and voting.
   - `TokenSale` for managing token sales.
   - `UniswapHelper` for facilitating Uniswap liquidity operations.

2. **USDT Configuration**

   - If testing locally or on a non-mainnet network, deploy `MockUSDT` and assign its address.
   - If on the mainnet or a specific testnet, use the appropriate USDT address.

3. **Airdrop WLF Tokens**

   - Airdrop 5,000,000 `WLF` tokens to the `TokenSale` contract.

4. **Start Token Sale #0**

   - Begin the initial token sale by invoking `startSaleZero` with 5,000,000 WLF tokens at a price of 0.001 USDT per token.

5. **Ownership Transfer**

   - Transfer ownership of `WerewolfTokenV1`, `Treasury`, and `TokenSale` to the `Timelock` contract to ensure decentralized governance.

6. **Buy Tokens**

   - The founder buys 5,000,000 `WLF` tokens for 5,000 USDT by invoking the `buyTokens` function.
   - This process involves approvals for `TokenSale` to spend WLF and USDT on behalf of the founder.

7. **Add Liquidity to Uniswap**

   - Add the WLF/USDT pair to Uniswap using the `UniswapHelper` contract. The liquidity includes:
     - 5,000,000 WLF tokens.
     - 5,000 USDT.

8. **Stake Liquidity Pool Tokens**

   - Stake the `WLF_USDT_LP` tokens into the `Staking` contract for a duration of 5 years.

9. **Proposal and Voting**
   - The founder proposes and votes for `tokenSale#1` using the `DAO` contract. This ensures the governance system is functional and the next token sale is prepared.

# Testing

## Run everything

```bash
forge test                   # all tests, summary
forge test -vvvv             # all tests, full traces
```

## By suite

```bash
forge test --match-contract DaoTest              # 11 tests — DAO governance
forge test --match-contract BaseTest             # 5 tests  — setup & ownership
forge test --match-contract LPStakingTest        # 14 tests — LP staking vault
forge test --match-contract TokenSaleWithLPTest  # 6 tests  — token sale + Uniswap LP flow
forge test --match-contract StakingTest          # 2 tests  — staking APY
```

## DAO tests (DaoTest)

```bash
# Happy path — full proposal lifecycle (create → vote → queue → execute)
forge test --match-test test_dao_mint_tokens_to_treasury

# Admin & ownership
forge test --match-test test_timelockAdminTransfer
forge test --match-test test_ownership_transfers

# Proposal state machine
forge test --match-test test_proposal_state_transitions
forge test --match-test test_cannot_queue_before_voting_ends
forge test --match-test test_cannot_queue_defeated_proposal
forge test --match-test test_cannot_execute_without_queuing
forge test --match-test test_proposal_expired_after_grace_period

# Voting
forge test --match-test test_weighted_voting
forge test --match-test test_cannot_vote_twice
forge test --match-test test_vote_split_outcome
```

## Base setup tests (BaseTest)

```bash
forge test --match-test test_SetupProcess
forge test --match-test test_AirdropToTokenSale
forge test --match-test test_StartTokenSaleZero
forge test --match-test test_TransferOwnershipToTimelock
forge test --match-test test_FounderBuyTokens
```

## LP staking tests (LPStakingTest)

```bash
forge test --match-test test_Initialization
forge test --match-test test_InitializeLPPosition
forge test --match-test test_InitializeLPPosition_OnlyTokenSale
forge test --match-test test_InitializeLPPosition_AlreadyInitialized
forge test --match-test test_ClaimShares_FlexibleDuration
forge test --match-test test_ClaimShares_FixedDuration
forge test --match-test test_ClaimShares_MultipleUsers
forge test --match-test test_CalculateAPY
forge test --match-test test_GetPositionValue
forge test --match-test test_GetPositionValue_NotInitialized
forge test --match-test test_SetTokenSaleContract_OnlyOnce
forge test --match-test test_SetTokenSaleContract_OnlyOwner
forge test --match-test test_Constants
forge test --match-test test_OnERC721Received
```

## Token sale tests (TokenSaleWithLPTest)

```bash
forge test --match-test test_FullLPStakingFlow
forge test --match-test test_CannotClaimBeforeSaleEnds
forge test --match-test test_CannotClaimTwice
forge test --match-test test_EmptySaleHandling
forge test --match-test test_PartialSaleCompletion
forge test --match-test test_MultipleSequentialSales
```

## Staking tests (StakingTest)

```bash
forge test --match-test test_staking_setup
forge test --match-test test_staking_apy_calculations
```

## Verbosity flags

| Flag | Shows |
|------|-------|
| _(none)_ | pass/fail + gas |
| `-vv` | `console.log` output |
| `-vvv` | stack traces on failure |
| `-vvvv` | full traces on every test |

> `--match-test` matches by substring — e.g. `forge test --match-test test_cannot` runs all tests with "cannot" in the name.
