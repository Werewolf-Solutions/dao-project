# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A decentralized autonomous organization (DAO) project built on Solidity with governance, token sales, staking, and treasury management. The system uses upgradeable proxy patterns (TransparentUpgradeableProxy) for all major contracts.

## Development Commands

### Building and Testing
- Build: `forge build`
- Run all tests: `forge test`
- Run specific test file: `forge test --match-path test/DaoTest.t.sol`
- Run with verbose output: `forge test -vvvv`
- Run DAO tests (per README): `forge test -vvvv DaoTest.t.sol`

### Deployment
- Deploy script: `forge script script/Deploy.s.sol`
- Deployment addresses are written to: `script/output/deployed-addresses.txt`

### Configuration
- Solidity version: `0.8.28` (fixed in foundry.toml)
- Via IR: `false` (can be enabled as last resort)

## Architecture

### Core Governance Flow

The project implements a timelock-based governance system where the DAO controls all contracts through queued and executed proposals:

1. **DAO** ([src/DAO.sol](src/DAO.sol)) - Manages proposal creation, voting, and execution
   - Proposals require 10 WLF tokens to create (paid to Treasury)
   - Proposal states: Pending → Active → Queued → Executed
   - Guardian approves proposals to move from Pending to Active
   - Voting period: 3 days, Voting delay: 1 block
   - Quorum: 50%, Proposal threshold: 0.5% of treasury balance
   - Max operations per proposal: 10

2. **Timelock** ([src/Timelock.sol](src/Timelock.sol)) - Enforces time delays on governance actions
   - Minimum delay: 2 days, Maximum delay: 30 days
   - Grace period: 14 days for execution after eta
   - Admin initially set to founder, designed to be transferred to DAO
   - All ownership-critical functions must go through Timelock

3. **WerewolfTokenV1** ([src/WerewolfTokenV1.sol](src/WerewolfTokenV1.sol)) - Governance token (WLF)
   - Total supply: 1B tokens minted to Treasury
   - Implements checkpoints for voting power tracking via `getPriorVotes()`
   - Ownership transferred to Timelock after deployment
   - Treasury can airdrop tokens, authorized callers can pay employees

4. **Treasury** ([src/Treasury.sol](src/Treasury.sol)) - Holds and manages DAO funds
   - Receives proposal creation fees
   - Distributes staking rewards
   - Managed by Timelock (owner)
   - Tracks allowed tokens for multi-token support

### Token Economics

5. **TokenSale** ([src/TokenSale.sol](src/TokenSale.sol)) - Handles token sales
   - Sale #0: Founder sale (5M WLF at 0.001 USDT, establishes initial liquidity)
   - Sale #1: Public sale (same price as #0)
   - Automatically adds liquidity to Uniswap v3 and stakes LP tokens
   - Ownership transferred to Timelock

6. **Staking** ([src/Staking.sol](src/Staking.sol)) - ERC4626 vault for staking WLF
   - APY range: 6% (MIN_APY) to 80% (MAX_APY)
   - Fixed duration staking bonus: +5% APY
   - Epoch duration: 30 days
   - Tracks locked stakes per epoch for long-term commitments

7. **UniswapHelper** ([src/UniswapHelper.sol](src/UniswapHelper.sol)) - Facilitates Uniswap v3 liquidity operations
   - Used by TokenSale to create WLF/USDT pairs

### Future Components

8. **CompaniesHouse** ([src/CompaniesHouseV1.sol](src/CompaniesHouseV1.sol)) - Company management (partial implementation)
   - CRUD operations for companies
   - Hire/fire employees and collaborators
   - Pay employees (integrates with off-chain ERP via oracle - planned)

## Contract Layout Standard

All contracts follow this structure (enforced in comments):
1. Data types (structs, enums, type declarations)
2. State Variables
3. Events
4. Function Modifiers
5. Constructor/Initialize
6. Fallback and Receive functions
7. External functions
8. Public functions
9. Internal functions
10. Private functions

## Deployment Sequence

Critical: Contracts have circular dependencies. Follow this exact order:

1. Deploy Treasury (with founder as initial owner)
2. Deploy Timelock (with founder as admin, 2-day delay)
3. Deploy WerewolfTokenV1 (mints 1B tokens to Treasury)
4. **Set WerewolfToken in Treasury** (post-deployment configuration)
5. Deploy Staking
6. Deploy DAO (with guardian = founder)
7. Deploy TokenSale
8. Deploy CompaniesHouse
9. Airdrop 5M WLF to TokenSale
10. Start TokenSale #0
11. Transfer ownership of WerewolfToken, Treasury, and TokenSale to Timelock

See [script/Deploy.s.sol](script/Deploy.s.sol) for full deployment script and [test/BaseTest.t.sol](test/BaseTest.t.sol) for test setup.

## Testing Patterns

- Base test setup in [test/BaseTest.t.sol](test/BaseTest.t.sol) - inherit from `BaseTest` for all tests
- Uses TransparentUpgradeableProxy pattern with multiSig as proxy admin
- MockUSDT provided for local testing (6 decimals like mainnet USDT)
- Prank `founder` address for ownership actions in tests

## DAO Proposal Flow

### Normal Proposals
1. Create proposal (costs 10 WLF, sent to Treasury)
2. Guardian approves → state becomes Active
3. Reviewing period: 2 days (per README, currently 1 block in code)
4. Voting period: 3 days
5. If succeeded (quorum 60%, threshold 51% per README; 50% in code), queue for 2 days
6. Execute after timelock delay passes

### Emergency Proposals (Planned)
- Created automatically from multisig
- No reviewing period (0 days)
- Voting period: 7 days
- Emergency quorum: 100%, threshold: 100%
- Not queued, automatically executed if passed

## Key Gotchas

- **Admin Transfer**: Timelock admin must be transferred to DAO via `setPendingAdmin()` → `acceptAdmin()` flow. Currently commented out in Deploy script (`_setTimelockAdmin()`)
- **Voting Power**: Currently uses simple token balance (`balanceOf`) in voting, not checkpoints. Checkpoint integration is TODO
- **Guardian Role**: DAO has a guardian (initially founder) who approves proposals. This is a centralization point
- **State Management**: Proposal state updates are partially manual - some state transitions require explicit calls
- **ETA Precision**: When queueing proposals, ensure `eta = block.timestamp + timelock.delay()` exactly matches expected timing

## Project Status

Active development areas (from README TODO):
- [ ] Staking: calculateAPY, fixed/flexible staking
- [>] DAO: create/queue/execute proposals (in progress)
- [ ] DAO: Use checkpoints for voting power (WLF, sWLF, WLF_LP)
- [ ] DAO: Emergency proposals with 100% voting power requirement
- [ ] Token sale integration with Uniswap liquidity and staking
- [ ] CompaniesHouse CRUD, employee management, payments

## Contract Layout and NatSpec

Follow this NatSpec format for functions:
```solidity
/**
 * @notice Explain what this function does
 * @param paramName Documents a parameter
 * @return Documents the return variables
 * @inheritdoc ContractName Copies missing tags from base function
 */
```

## External Resources

- Trello board: https://trello.com/b/bOGxJpTY/dao-project
- Discord: https://discord.gg/DVDtsbHp
- OpenZeppelin governance docs: https://docs.openzeppelin.com/contracts/5.x/governance
- Uniswap v3 liquidity guide: https://docs.uniswap.org/contracts/v3/guides/providing-liquidity/setting-up
