# White Paper

**Version**: 0.1.4 — Q1 2026
**Author**: Lorenzo

---

## Table of Contents

1. [Abstract](#1-abstract)
2. [Introduction](#2-introduction)
3. [Problem Statement](#3-problem-statement)
4. [Solution Overview](#4-solution-overview)
5. [Technology Architecture](#5-technology-architecture)
6. [Tokenomics](#6-tokenomics)
7. [Governance Model](#7-governance-model)
8. [Company Management](#8-company-management)
9. [Roadmap](#9-roadmap)
10. [Security Design](#10-security-design)
11. [Team](#11-team)
12. [Legal Disclaimer](#12-legal-disclaimer)

---

## 1. Abstract

The global financial system was not designed for the individual. Entrepreneurs, remote workers, and small teams face a fragmented landscape of banking intermediaries, opaque company registries, and capital held at counterparty risk. Wealth and governance power remain concentrated, while those who build the most own the least.

Werewolf Solutions made Werewolf DAO that is a fully on-chain, open-source platform that replaces this fragmented infrastructure with a unified ecosystem governed by its community. At its core is the WLF governance token, a decentralised treasury, a time-locked governance contract, and a company management registry — all coordinated through smart contracts deployed on Ethereum with upgradeable proxy architecture.

The platform enables entrepreneurs to register companies, manage multi-role payrolls, _and raise capital (not yet)_ — all in a single on-chain environment. Treasury management, token sales, and liquidity provision are automated and transparent. Governance over every critical parameter is enforced by a Timelock contract with a minimum two-day delay, ensuring no single actor can act unilaterally.

This document describes the system as built in v0.1.4, including the technical architecture of each contract, the token economics, the governance lifecycle, and the development roadmap. It is written for early adopters, investors, and contributors who want to understand both what has been built and where the project is headed.

---

## 2. Introduction

### Vision

Werewolf DAO is built on a simple conviction: the tools that power businesses — payroll, treasury management, governance, fundraising — should be open, transparent, and owned by the people who use them. Not by banks. Not by corporate shareholders. By the community.

The platform is designed for three types of people: **entrepreneurs** (those who see opportunities and build teams), **developers** (those who write the software), and **makers** (those who build the hardware and infrastructure). Together they form a self-sustaining ecosystem.

Everything in this project is open source. Not a single line of code is private. Every governance decision, every treasury allocation, every company payroll entry is stored on-chain and auditable by anyone.

### Philosophy

Create more, _consume less (remove and change it something else)_ . Community ownership over centralised control. Financial sovereignty for the individual, enforced by mathematics rather than institutions.

### What This Document Covers

This white paper describes the complete technical architecture of the v0.1.4 release, including all deployed smart contracts, the WLF token economics, the governance model, the company management system, and the development roadmap through v1.0.

---

## 3. Problem Statement

### Fragmented Financial Tools

Entrepreneurs and small businesses rely on a patchwork of disconnected services: banks, payroll providers, cap table tools, shareholder registries, and accounting software. None of these systems talk to each other (or if they do it's complicated, with hiccups and so on), and none of them are owned by the users.

### Opaque, Bureaucratic Company Management

Incorporating a company is slow and expensive. Payroll involves intermediaries. Cap tables are maintained in spreadsheets or proprietary software. There is no globally accessible, trustless registry where the ownership and obligations of a company are publicly verifiable.

### Capital at Risk

Funds held at centralised institutions are subject to institutional failure. A treasury that depends on a bank's solvency is not a treasury — it is a loan to a counterparty.

### Wealth Concentration and Opaque Governance

Most organisations — both traditional and crypto — concentrate decision-making power at the top. Token holders in most DeFi protocols have governance rights in theory but little influence in practice, either because quorums are unreachable or because whale wallets dominate votes. **How to have right dilution? Who should own the token?**

### Employees With No Ownership Stake

The people who build products rarely own meaningful equity in what they create. Salaries are paid in fiat, equity vesting is slow and illiquid, and there is no mechanism for workers to participate in the upside of what they build.

---

## 4. Solution Overview

### All-in-One Platform

Werewolf DAO combines treasury management, token sales, decentralised governance, staking, and company payroll into a single integrated platform. Every component is a smart contract. Every interaction is on-chain and auditable.

### Smart-Contract-Enforced Transparency

There are no admin backends. No privileged servers. Every governance action — from adjusting APY bounds to approving payroll allocation — must pass through the DAO proposal lifecycle and be executed via the Timelock contract after a mandatory delay.

### Community Governance via WLF

WLF token holders govern the platform. Voting power is derived from wallet holdings, staked WLF (via the ERC4626 Staking vault), and LP positions. A snapshot-based system prevents flash-loan voting attacks: voting power is measured at the block when the proposal was created, not at the time of voting.

### Decentralised Payroll and Treasury Management

CompaniesHouseV1 enables on-chain company registration and payroll. Salaries are tracked per-hour in USDT, with a configurable reserve requirement ensuring companies cannot become insolvent. Payroll is executed in a single batch transaction.

### Uniswap-Backed Liquidity from Day One

Every token sale automatically creates a WLF/USDT liquidity pool on Uniswap v3. LP tokens are staked for five years, preventing immediate sell pressure. The Treasury can also repurchase WLF via Uniswap using collected USDT, creating a price support mechanism governed by DAO proposals.

---

## 5. Technology Architecture

### 5.1 System Overview

All contracts use the `TransparentUpgradeableProxy` pattern from OpenZeppelin. The proxy admin is a multisig wallet. All ownership-critical functions on implementation contracts are restricted to the Timelock, which is in turn governed by the DAO. This means every protocol upgrade and parameter change must pass through community governance.

The deployment sequence resolves circular dependencies:

1. Deploy **Treasury** (founder as initial owner)
2. Deploy **Timelock** (founder as admin, 2-day delay)
3. Deploy **WerewolfTokenV1** (mints 1B WLF to Treasury)
4. Set WerewolfToken address in Treasury
5. Deploy **Staking**
6. Deploy **DAO** (guardian = founder)
7. Deploy **TokenSale**
8. Deploy **CompaniesHouseV1**
9. Airdrop 5M WLF to TokenSale; start Sale #0
10. Transfer ownership of WerewolfToken, Treasury, and TokenSale to Timelock

---

### 5.2 WerewolfTokenV1 (WLF)

**File**: `src/WerewolfTokenV1.sol`

WLF is an ERC20Upgradeable token with a voting checkpoint system modelled after Compound's governance token.

**Key properties**:

- Total supply: 1,000,000,000 WLF (1 billion), minted entirely to the Treasury at deployment
- Voting checkpoints written on every transfer via the `_update()` hook
- Binary-search `getPriorVotes(address, blockNumber)` for gas-efficient historical balance lookups
- Ownership transferred to Timelock after deployment, ensuring all mint/airdrop/payEmployee calls require DAO approval

**Entry points**:

- `airdrop(address to, uint256 amount)` — owner (Timelock) moves WLF from Treasury to an address
- `payEmployee(address to, uint256 amount)` — authorized callers (e.g., CompaniesHouseV1) pay employees from Treasury
- `mint(uint256 amount)` — owner mints additional WLF to Treasury (inflation requires DAO proposal)

---

### 5.3 Treasury

**File**: `src/Treasury.sol`

The Treasury is the financial hub of the DAO. It holds all unsold WLF, collected USDT fees, and any other allowed ERC20 tokens.

**Key functions**:

- `distributeRewards()` — transfers a configured WLF allocation to the Staking contract
- `distributeRewardsToLP()` — transfers a configured WLF allocation to the LPStaking contract
- `buybackWLF(uint256 usdtAmount, uint256 minWLFOut)` — swaps USDT for WLF on Uniswap v3 via the configured SwapRouter; `minWLFOut` is a required slippage guard (cannot be zero)
- `isAboveThreshold()` — returns true if Treasury WLF balance exceeds the configured threshold percentage; null-safe if WerewolfToken is not yet set
- `withdrawToken(address token, uint256 amount, address to)` — owner (Timelock) withdraws any ERC20; used by DAO proposals to fund company treasuries

**Threshold**: configurable percentage (default 20%) used by external callers to determine if the Treasury is adequately funded before initiating distributions.

---

### 5.4 Timelock

**File**: `src/Timelock.sol`

The Timelock enforces a mandatory waiting period on all governance-controlled actions, giving token holders time to review and react before execution.

**Constants**:

- `MINIMUM_DELAY`: 2 days
- `MAXIMUM_DELAY`: 30 days
- `GRACE_PERIOD`: 14 days (execution window after ETA)

**Lifecycle of a queued transaction**:

1. Admin (DAO) calls `queueTransaction(target, signature, data, eta)` — eta must be at least `block.timestamp + delay`
2. Transaction hash is stored in `queuedTransactions` mapping
3. After eta passes and within the grace period, admin calls `executeTransaction()` — the call is made to the target contract
4. If not executed within the grace period, the transaction becomes stale and must be re-queued

**Admin transfer** follows a two-step process: current admin calls `setPendingAdmin(address)`, then the pending admin calls `acceptAdmin()`. This prevents accidental permanent lockout.

---

### 5.5 DAO (Governance)

**File**: `src/DAO.sol`

The DAO manages the full proposal lifecycle and aggregates voting power from WLF wallets, staking positions, and LP positions.

**Parameters** (set at initialization, adjustable via DAO proposals through Timelock):

- Proposal cost: 10 WLF (transferred to Treasury on proposal creation)
- Voting delay: 1 day (time between proposal creation and vote opening)
- Voting period: 1 hour (currently; governance-adjustable via `setVotingPeriod`)
- Quorum: 50%
- Proposal threshold: 0.5% of Treasury balance
- Max operations per proposal: 10

**Proposal states**:

```
Pending → [Guardian approves] → Active → [Voting ends]
  → Succeeded / Defeated / Canceled
  → [If Succeeded] Queued → [After Timelock delay] Executed
```

**Voting power aggregation**:

- WLF wallet balance at `snapshotBlock` (via `getPriorVotes` — anti-flash-loan)
- Staked WLF value (via `IStaking.getStakedWLF`)
- LP staking voting power (via `ILPStaking.getWLFVotingPower`)

If a voter has delegated their power, they forfeit their own raw power and it counts toward the delegatee instead. Delegated power and the voter's own power are never double-counted.

**Delegation system**:

- `VALIDATOR_THRESHOLD`: 5,000,000 WLF required to receive delegations
- `delegate(address)` — manual delegation; applies 6-month cooldown before redelegation
- `undelegate()` — reclaim own power; applies the same cooldown
- `autoDelegate(address user, address delegatee)` — called by TokenSale for sales #0 and #1; applies 2-year lock
- `syncDelegate(address)` — updates cached delegated power after staking balance changes

---

### 5.6 Staking (ERC4626 Vault)

**File**: `src/Staking.sol`

The Staking contract is an ERC4626-compliant upgradeable vault. Depositing WLF mints sWLF shares. As rewards accrue into `stakedBalance`, each share becomes worth more WLF — this is the auto-compounding mechanism.

**APY model** — half-life decay curve based on staking ratio:

```
stakingRatio = stakedBalance / circulatingSupply
exponent     = stakingRatio / 1e17
apy          = minApy + (maxApy - minApy) / 2^exponent
```

- Minimum APY: **6%** (`minApy = 6_000`)
- Maximum APY: **80%** (`maxApy = 80_000`)
- `circulatingSupply` = total supply minus treasury holdings (tokens not yet in the market)
- When nothing is staked, APY is at maximum (80%)
- As more tokens are staked relative to circulating supply, APY decays toward the floor (6%)

**Fixed-duration lock bonuses** (added on top of base APY):

| Duration | Bonus APY |
| -------- | --------- |
| 30 days  | +5%       |
| 3 months | +10%      |
| 6 months | +15%      |
| 1 year   | +25%      |
| 2 years  | +40%      |
| 5 years  | +60%      |
| 10 years | +80%      |

**Per-position tracking** via `StakePosition` struct: each position records `shares`, original `assets` deposited, `stakedAt`, `unlockAt` (0 for flexible), `bonusApy`, and `active` flag.

**Key user functions**:

- `stakeFlexible(uint256)` — no lock; merges into existing flexible position if one exists
- `stakeFixed(uint256 amount, uint256 duration)` — creates or merges into position for that duration
- `withdrawPosition(uint256 index)` — withdraw entire position (must be unlocked)
- `withdrawAmountFromPosition(uint256 index, uint256 amount)` — partial withdrawal
- `withdrawAll()` — withdraw all unlocked positions in one transaction
- `withdrawAllRewards()` — harvest only the appreciation above original deposits; principals remain staked
- `withdrawAllRewardsAndStakeFlexible()` — compound: harvest rewards and re-stake them as flexible; no token transfer occurs

**Reward funding**: Owner (Timelock/Treasury) calls `addStakingRewards(uint256)` to deposit WLF into the reward pool. APY bounds and duration bonuses are governance-adjustable via DAO proposals.

---

### 5.7 TokenSale

**File**: `src/TokenSale.sol`

TokenSale manages sequential fundraising rounds, each priced at or above the previous round.

**Sale structure**:

- Sale #0: Founder / seed round (`startSaleZero`)
- Sale #1+: Public rounds (`startSale`); each must use `price >= previous price`
- Floor price at initialization: `0.0004 USDT per WLF` (18-decimal precision)

**Purchase flow**:

1. Buyer calls `buyTokens(amount, wlfDesired, usdtRequired)` — USDT transferred to TokenSale; WLF tracked internally
2. Buyer and purchase amounts recorded for LP share distribution
3. When all tokens sell (or owner force-ends), `endSale()` can be called

**Sale close — LP creation**:

1. Collected USDT and paired WLF are approved to UniswapHelper
2. `uniswapHelper.addLiquidity(..., 100)` creates a Uniswap v3 WLF/USDT position (1% slippage tolerance, 20-minute deadline)
3. LP NFT is transferred to LPStaking
4. `lpStaking.initializeLPPosition()` records actual amounts used (excess returned to Treasury)
5. All buyers automatically receive LP shares with a 5-year lock via `lpStaking.claimShares(buyer, saleId, amount, true)`

**Auto-delegation**: For sales #0 and #1, all buyers are automatically delegated to the founder for a 2-year lock via `dao.autoDelegate(buyer, founder)`. This preserves governance stability during the early bootstrap phase.

**Excess handling**: If Uniswap uses fewer tokens than desired (due to pool price mismatch), excess WLF and USDT are forwarded to the Treasury rather than being lost.

---

### 5.8 UniswapHelper

**File**: `src/UniswapHelper.sol`

UniswapHelper wraps the Uniswap v3 `NonfungiblePositionManager` to abstract pool initialisation, token sorting, and position minting into a single callable interface.

**Key behaviour**:

- Accepts `slippageBps` (basis points, e.g., `100` = 1%) to compute `amount0Min` and `amount1Min`
- Enforces `deadline = block.timestamp + 20 minutes` on all liquidity calls
- Computes `sqrtPriceX96` from desired amounts to initialise new pools at the correct price
- Sorts tokens into (token0, token1) canonical order before interacting with Uniswap
- Returns the Uniswap NFT position ID (`tokenId`) to the caller

---

### 5.9 CompaniesHouseV1

**File**: `src/CompaniesHouseV1.sol`

CompaniesHouseV1 is an on-chain company registry with built-in payroll management, designed for entrepreneurs and remote-first teams.

**Company lifecycle**:

- `createCompany(CreateCompany params)` — charges 10 WLF creation fee (sent to Treasury); registers the company; auto-hires the creator as the first employee with their specified role and salary
- `deleteCompany(uint96 companyId)` — soft-delete; uses an `active` flag rather than removing storage (avoids issues with nested dynamic arrays)
- Companies have a dedicated `companyWallet` address — a separate EOA the user controls, used for automated operations without exposing their main wallet's private key

**Employee management**:

- `hireEmployee(HireEmployee params)` — adds an employee with one or more salary streams; all roles must exist in the company's `roles[]` array
- `addRoleToEmployee(address employee, uint96 companyId, SalaryItem item)` — adds an additional role and salary stream to an existing employee
- `fireEmployee(address employee, uint96 companyId)` — soft-delete; marks employee inactive and clears their brief
- Each `SalaryItem` contains: `role`, `salaryPerHour` (USDT 6-decimal wei per hour), and `lastPayDate`

**Salary example**: $500/month ≈ `500_000_000 / 730 ≈ 684_931` USDT-wei/hour stored on-chain (USDT has 6 decimals; 730 hours per month)

**Payroll**:

- `payEmployee(address, uint96)` — pays a single employee all pending USDT; checks reserve threshold first
- `payEmployees(uint96 companyId)` — batch payroll for all active employees in one transaction; performs a single reserve check upfront for the total batch, preventing partial payment failures
- `payEmployeeWithTokens(...)` — split payment in USDT and/or WLF from company's internal balances

**Reserve protection**:

- `minReserveMonths` (default: 60 months = 5 years) — company USDT balance must exceed `getMonthlyBurnUSDT × minReserveMonths` after any payment
- `getMonthlyBurnUSDT(companyId)` — total monthly payroll USDT across all active employees
- `getRequiredReserveUSDT(companyId)` — minimum balance required at all times
- `getTotalPendingUSDT(companyId)` — USDT currently owed to all active employees

**Funding**:

- `depositToCompany(companyId, token, amount)` — anyone can fund a company's internal balance via ERC20 `transferFrom`
- `creditToCompany(companyId, token, amount)` — admin (Timelock) credits tokens already in the contract; used with `treasury.withdrawToken()` for DAO-governed company funding proposals

**Authorization**: company owner, company wallet address, or any active employee with a `powerRole` can manage the company.

---

## 6. Tokenomics

### 6.1 WLF Token Details

| Property       | Value                                 |
| -------------- | ------------------------------------- |
| Name           | Werewolf Token                        |
| Symbol         | WLF                                   |
| Decimals       | 18                                    |
| Total Supply   | 1,000,000,000 WLF                     |
| Initial holder | Treasury (100%)                       |
| Blockchain     | Ethereum                              |
| Standard       | ERC20Upgradeable + voting checkpoints |

All tokens are minted to the Treasury at deployment. There is no pre-mine, no team allocation, and no investor cliff. Supply enters circulation only through token sales, staking rewards, and DAO-approved distributions.

### 6.2 Fundraising Rounds

| Round     | Raise Target | Price / WLF | Notes                          |
| --------- | ------------ | ----------- | ------------------------------ |
| Sale #0   | ~$2,000      | $0.0004     | Founder / developer seed round |
| Pre-seed  | $1,000,000   | $0.004      | MVP launch — April 2026        |
| Seed      | $10,000,000  | $0.04       | Product-market fit             |
| Series A  | $100,000,000 | $0.4        | Post 2–3x price appreciation   |
| Series B+ | 10x each     | 10x each    | Scale phase                    |

Every sale price must be ≥ the previous sale price. 100% of USDT collected in each sale is used to create a Uniswap v3 WLF/USDT liquidity pool and the remaining is sent to DAO treasury, not distributed to the team.

### 6.3 Token Distribution

All unsold WLF remains in the Treasury. The Treasury is managed by the Timelock, which is governed by the DAO. Distributions require a successful DAO proposal:

- **Staking rewards**: WLF transferred from Treasury to Staking contract via `distributeRewards()`
- **Employee payroll**: WLF transferred from Treasury to employees via CompaniesHouseV1 (USDT path) or directly via `airdrop()`
- **Buyback**: Treasury uses collected USDT to purchase WLF on Uniswap via `buybackWLF()`
- **New sales**: Founder or DAO airdrops WLF to TokenSale before starting a new round

### 6.4 Staking Incentives

The APY decay curve rewards early stakers disproportionately and creates organic incentive to stake before the ratio becomes too high. When circulating supply is low and staking participation is high, APY compresses toward 6%. When participation is low, APY opens to 80%.

Fixed-duration bonuses add up to +80% on top of the base APY, incentivizing long-term commitment. _A 10-year staker at minimum base APY still earns 6% + 80% = 86% total APY. (wrong)_

All bonuses and APY bounds are governance-adjustable via DAO proposals through the Timelock.

### 6.5 Staking Sustainability _wrong, needs update_

**The Treasury is effectively inexhaustible as a staking reward reserve** under any realistic scenario:

| Circulating Supply  | Staking Ratio | APY   | Annual Rewards | Treasury Depletes In |
| ------------------- | ------------- | ----- | -------------- | -------------------- |
| 5M (after sale #0)  | 100%          | ~6.1% | ~305K WLF/yr   | ~3,260 years         |
| 30M (after sale #1) | 100%          | ~6.1% | ~1.83M WLF/yr  | ~514 years           |
| 55M (after sale #2) | 50%           | ~8.3% | ~2.28M WLF/yr  | ~412 years           |
| 200M (mature)       | 50%           | ~8.3% | ~8.3M WLF/yr   | ~113 years           |

Three factors keep emissions sustainable:

1. **94% of supply stays in Treasury** — only a small fraction is ever sold
2. **APY self-throttles** — the half-life decay formula means higher staking participation automatically reduces APY and reward emissions
3. **Governance controls the tap** — the DAO decides each epoch how much to release via `addStakingRewards()`; emissions can always be reduced by proposal

**Real inflation rate** (not treasury depletion):

The meaningful metric is annual inflation of circulating supply: `staking_ratio × APY`. At 50% staked with 8.3% APY this equals **4.15% annual inflation** — comparable to Ethereum's issuance model and self-correcting: if stakers dump rewards and the WLF price falls, APY in USDT terms drops, reducing staking incentive, reducing the staking ratio, and raising APY back up.

**Daily reward emissions example** (55M circulating, 50% staked, APY 8.3%):

```
Annual rewards = 27.5M × 8.3% = 2.28M WLF/year
Daily rewards  = 2.28M / 365  ≈ 6,247 WLF/day
Sell value (at $0.04/WLF) ≈ $250/day
```

A Uniswap v3 pool with $10,000 of liquidity absorbs this with less than 1% price impact. Even at 200M circulating supply the daily sell pressure at full staking participation is under $1,000/day — manageable for any live trading pool.

### 6.6 Revenue Model

The protocol generates revenue through fees that flow to the Treasury, grow the WLF buyback reserve, and ultimately appreciate the token value for all holders:

| Revenue Stream       | Mechanism                              | Rate                                |
| -------------------- | -------------------------------------- | ----------------------------------- |
| Payroll fee          | % of each `payEmployees()` batch       | 0.5% (planned)                      |
| Company registration | WLF fee on `createCompany()`           | 10 WLF today; governance-adjustable |
| M&A facilitation     | % of acquisition deal value            | 1–2% (planned v0.1.8)               |
| Asset tokenization   | WLF fee per registered asset           | TBD (v1.0)                          |
| WLF appreciation     | Treasury buyback from accumulated fees | Ongoing                             |

The most reliable revenue stream is **payroll fees** — a 0.5% cut on every salary paid through the protocol. Every company that onboards and runs payroll generates continuous fee income regardless of token price. This is the Uniswap model: fee on every transaction, no dependency on speculation.

### 6.5 Liquidity Design

- USDT raised in each token sale is deposited into a Uniswap v3 WLF/USDT pool and the rest is held in DAO treasury
- LP NFTs are transferred to LPStaking and locked for 5 years
- No immediate sell pressure from LP holders during the critical early period
- Treasury buyback mechanism provides a second price-support layer governed by DAO proposals
- Excess tokens from Uniswap price mismatch (between sequential sales) are returned to Treasury, not lost

---

## 7. Governance Model

### 7.1 Proposal Lifecycle

1. **Create proposal**: caller holds ≥ 10 WLF; fee transferred to Treasury; proposal starts in `Pending` state with a snapshot of the current block for voting power
2. **Guardian approves**: the guardian (currently founder) reviews the proposal and moves it to `Active`; this is a transitional centralisation point (see §7.4)
3. **Voting delay**: 1 day from proposal creation before votes open, allowing token holders to acquire or delegate power
4. **Voting period**: voting is open while `block.timestamp < endTime`; each address votes at most once per proposal; voting power is computed from the `snapshotBlock`
5. **Result calculation**: `queueProposal()` computes the outcome — Succeeded if `votesFor > votesAgainst` and total votes ≥ `minVotesRequired`; otherwise Defeated or Canceled
6. **Queue**: Succeeded proposals are queued in the Timelock with `eta = block.timestamp + timelock.delay()` (minimum 2 days)
7. **Execute**: after eta and within the 14-day grace period, anyone can call `executeProposal()` to execute all operations via the Timelock

### 7.2 Voting Power

Voting power at any proposal's `snapshotBlock` is the sum of:

1. **WLF wallet balance** — measured via `getPriorVotes(voter, snapshotBlock)` (checkpoint-based, anti-flash-loan)
2. **Staked WLF** — from the Staking ERC4626 vault via `getStakedWLF(voter)`
3. **LP staking power** — from LP positions via `getWLFVotingPower(voter)`

If a voter has delegated their power, they forfeit their own raw voting power and it is credited to their delegate. Delegated power received from others is added on top of the delegate's own raw power.

### 7.3 Validator System

To receive delegations, an address must have at least **5,000,000 WLF** in own raw voting power (wallet + staking + LP). Power delegated from others does not count toward this threshold — receiving delegations cannot be what qualifies you to receive them.

- `isValidator(address)` — returns true if own raw power ≥ threshold
- Validators cannot re-delegate power received from others
- A 6-month cooldown applies after every manual delegate or undelegate action
- Auto-delegations from early sales apply a 2-year lock

### 7.4 Guardian Role _needs udpated_

The guardian (initially the founder) can:

- Approve proposals from `Pending` to `Active`
- Cancel proposals in `Pending`, `Active`, `Succeeded`, or `Queued` states
- Update the Merkle root for off-chain voting power proofs

This is an explicit, intentional centralisation during the bootstrap phase. The guardian role is designed to be phased out via a DAO proposal once the community is large enough for fully trustless governance. The guardian cannot execute proposals, modify tokenomics, or transfer treasury funds — all of those actions require a successful proposal through the Timelock.

### 7.5 Timelock Governance

All critical actions on WerewolfTokenV1, Treasury, Staking, TokenSale, and CompaniesHouseV1 are restricted to the Timelock (`onlyOwner` or `onlyAdmin`). The Timelock enforces:

- **Minimum 2-day delay** on every queued transaction
- **Maximum 30-day delay**
- **14-day grace period** before a queued transaction becomes stale
- **Hash-verified queue**: each transaction is identified by `keccak256(target, signature, data, eta)` — the exact execution cannot be changed after queuing

---

## 8. Company Management

### Who It Is For

CompaniesHouseV1 is designed for entrepreneurs, SMEs, and remote-first teams who want the benefits of on-chain transparency without abandoning traditional payroll workflows.

### Create a Company in One Transaction

`createCompany()` registers the company, hires the founder as the first employee, and begins tracking their salary — all in a single transaction with a 10 WLF registration fee.

The company's profile includes:

- Name, industry, domain
- Defined `roles[]` and `powerRoles[]` (roles with admin authority)
- A dedicated `companyWallet` — a separate EOA for automated operations, keeping the founder's personal wallet unexposed

### On-Chain Payroll with Reserve Protection

Salaries are tracked per-hour in USDT. Every payment must leave the company balance above the required reserve (`monthlyBurn × minReserveMonths`). On mainnet the default is 60 months (5 years), ensuring companies cannot pay themselves insolvent.

Batch payroll (`payEmployees()`) performs a single upfront reserve check for the full batch, then pays each employee. This prevents the scenario where earlier payments in the loop deplete the balance below threshold, blocking later ones.

### Multi-Role, Per-Hour Salary Tracking

Each employee can hold multiple roles simultaneously, each with its own salary rate. `addRoleToEmployee()` appends a new salary stream without firing and rehiring. All streams are paid in the same `payEmployees()` call.

### Future: Employee Ownership

Company token issuance (one ERC20 per company) is planned for v0.3. This would allow companies to issue shares to employees and early contributors, creating on-chain cap tables with vesting enforced by smart contracts.

### Designed for Oracle Integration

Salary items currently use a simple time-elapsed calculation. The architecture is designed to accept oracle data from an off-chain ERP system, enabling more complex compensation models including invoiced hours, performance bonuses, and multi-currency payroll.

The integration path:

1. **ERP API** signs a payload (hours worked, employee address, amount)
2. A **trusted relayer** submits the signed data to an on-chain oracle contract
3. `CompaniesHouseV1.payEmployee()` is called with the verified data

Phase 1 is a trusted relayer controlled by the company (fast to build, company controls it). Phase 2 replaces it with Chainlink Functions calling the REST API on-chain.

## _this is duplicated, check roadmap and merge it there_

### Revenue Attachment (v0.1.5)

Planned oracle integration to pull real-world revenue data on-chain: Stripe webhooks, bank transfer confirmations, and point-of-sale cash payments recorded by a trusted relayer and credited to the company's on-chain balance. This enables on-chain P&L statements that reflect actual business activity.

### Crypto Payments (v0.1.6)

Businesses will be able to accept payments by generating a QR code linked to their company wallet. Customers scan the code, pay via Apple Pay / Google Pay (through a fiat-to-crypto gateway), and the business receives USDT, WLF, or any allowed ERC20. All payment history is on-chain and auditable.

### Inventory & Supply Chain (v0.1.7)

Inventory levels are inherently off-chain. The planned approach: an oracle reads inventory data from the company's existing systems and publishes stock levels and reorder events on-chain. This enables smart contract-enforced purchase orders, supplier payments, and on-chain supply chain transparency.

### Business Mechanisms: M&A, Partnerships, Mergers (v0.1.8)

Any real-world corporate event should be representable on-chain:

- **Acquisition**: Company A transfers ownership of Company B for a USDT/WLF amount; protocol takes 1–2% fee; on-chain record is instant and irrefutable
- **Merger**: Two companies consolidate into one; employees, roles, and balances are migrated; both original companies soft-deleted
- **Partnership**: A formal agreement between companies with revenue-sharing terms enforced by smart contract
- **Spin-off**: A subset of employees and a capital allocation creates a new company in one transaction

This is the highest-revenue-potential feature: a single acquisition of a company valued at $1M generates $10,000–$20,000 in protocol fees.

### DeFi for Businesses (v0.1.4)

Companies will be able to put idle treasury USDT to work through integrated Aave positions: supply assets to earn interest, borrow against collateral, and swap between positions. All DeFi interactions are authorised by the company owner or power-role employees and recorded on-chain as company activity.

---

## 9. Roadmap _remove done things_

> _move this to v0.1.5_
>
> ### v0.1.8 — Business Mechanisms (M&A)
>
> - [ ] Company acquisition: transfer ownership between wallets, protocol takes 1–2% fee
> - [ ] Merger: consolidate two companies; migrate employees, balances, and roles
> - [ ] Partnership agreement: revenue-sharing contract between two companies
> - [ ] Spin-off: allocate capital and employees to a new company in one transaction

### v0.1 — Core Infrastructure (Q1 2026) ✓

- [x] WerewolfTokenV1 with voting checkpoints on every transfer
- [x] Treasury with buyback, reward distribution, and multi-token support
- [x] Timelock with 2-day minimum delay and grace period
- [x] DAO with snapshot-based voting, delegation system, and guardian lifecycle
- [x] Staking ERC4626 with per-position tracking, APY decay curve, and 7 fixed-lock durations
- [x] TokenSale with sequential sales, Uniswap LP auto-creation, and auto-delegation
- [x] UniswapHelper with slippage protection and deadline enforcement
- [x] CompaniesHouseV1 with multi-role employees, batch payroll, and reserve protection
- [x] Emergency pause mechanism (guardian-controlled) on Staking, TokenSale, CompaniesHouseV1
- [x] Dapp: Staking UI, Companies UI, Account page, DAO voting

### v0.1.4 — DeFi for Businesses

- [ ] Aave integration: companies supply, borrow, and swap from their on-chain balance
- [ ] Company DeFi dashboard in dapp (positions, health factor, yield)
- [ ] Governance-adjustable DeFi adapters (add new protocols via DAO proposal)

### v0.1.5 — Revenue Attachment

- [ ] Stripe oracle: webhook relay posts payment confirmations on-chain to company balance
- [ ] Bank transfer oracle: off-chain bank events credited on-chain via signed relayer
- [ ] Cash payment recording via admin oracle (point-of-sale integration)
- [ ] On-chain P&L and balance sheet view per company

### v0.1.6 — Crypto Payments

- [ ] QR code payment page per company wallet
- [ ] Apple Pay / Google Pay gateway → USDT/WLF delivered to company wallet
- [ ] Multi-currency receive support (USDT, WLF, ETH, GBPT, BTC, ...), company chooses which one to accept
- [ ] Payment history on-chain, auditable by anyone

### v0.1.7 — Inventory & Supply Chain

- [ ] Inventory oracle: reads stock levels from company ERP, publishes on-chain
- [ ] Smart contract-enforced purchase orders with on-chain supplier payments
- [ ] Reorder triggers: oracle publishes low-stock events; DAO or company wallet can auto-pay supplier

### v0.1.8 — Business Mechanisms (M&A)

- [ ] Company acquisition: transfer ownership between wallets, protocol takes 1–2% fee
- [ ] Merger: consolidate two companies; migrate employees, balances, and roles
- [ ] Partnership agreement: revenue-sharing contract between two companies
- [ ] Spin-off: allocate capital and employees to a new company in one transaction

### v0.1.9 — Token Sale QR & Mobile Pay

- [ ] QR code linking to token sale page with amount pre-filled
- [ ] Apple Pay / fiat-to-crypto gateway on token sale page
- [ ] Buyer receives WLF and LP shares; auto-delegation applied on purchase

### v0.2 — Governance Hardening (Q2 2026)

- [ ] Emergency proposals (100% quorum / threshold, 7-day voting, auto-execute)
- [ ] Full checkpoint-based voting power for sWLF and LP positions
- [ ] Timelock admin transfer fully to DAO (remove guardian from admin path)
- [ ] Voting delegation UI in dapp
- [ ] WLF payment option in CompaniesHouseV1 (USDT → WLF conversion via Uniswap)
- [ ] Voting delay parameter finalised (3 days per whitepaper spec)
- [ ] Production deployment to Ethereum mainnet

### v0.3 — Product Expansion (Q3 2026)

- [ ] Token Sale #1 (public pre-seed round — $1M target)
- [ ] LP staking dashboard in dapp
- [ ] Treasury dashboard in dapp (live WLF/USDT balances, buyback history)
- [ ] Oracle integration for CompaniesHouseV1 payroll (off-chain ERP data)
- [ ] Company token issuance (one ERC20 per company; on-chain cap tables)
- [ ] Mobile-optimised dapp
- [ ] Payroll protocol fee (0.5% on every `payEmployees()` call → Treasury)

### v1.0 — Long-Term Vision

- Asset tokenisation (real estate, vehicles, collectibles)
- VAT token: per-country tax stablecoin for on-chain tax compliance
- Algorithmic trading integration (bot-managed treasury strategies)
- Accounting module (on-chain P&L, balance sheets)
- Multi-chain support (L2s, cross-chain governance)
- Physical community network tooling
- AI-assisted proposal parsing, auditing, and risk analysis
- Insurance liquidity pools

---

## 10. Security Design

### Upgradeable Proxies with Timelock-Controlled Admin

All contracts use `TransparentUpgradeableProxy`. The proxy admin is a multisig. Implementation upgrades require a DAO proposal executed via the Timelock — no unilateral upgrades possible after the admin transfer is complete.

### Snapshot Voting (Anti-Flash-Loan)

Voting power is measured at the `snapshotBlock` when the proposal was created, not at voting time. An attacker cannot borrow a large WLF position to vote on a proposal that already exists.

### Mandatory Timelock Delay

`MINIMUM_DELAY = 2 days` ensures that even if a malicious proposal passes a vote, the community has at least 48 hours to react — including withdrawing funds, opposing execution, or forking — before any critical action takes effect.

### Slippage Protection on All Uniswap Interactions

`buybackWLF()` requires `minWLFOut > 0` (cannot be zero). `UniswapHelper.addLiquidity()` accepts `slippageBps` and enforces minimum output amounts. TokenSale passes `100` basis points (1%) when creating LP positions.

### Reserve Threshold Enforcement Before Any Payroll

CompaniesHouseV1 checks `companyBalance >= totalOwed + requiredReserve` before any payment. This check covers the entire batch in `payEmployees()`, preventing partial execution from depleting reserves.

### Two-Step Admin Transfers

Timelock admin transfer requires `setPendingAdmin()` followed by `acceptAdmin()` — the pending admin must actively claim the role. This prevents accidental transfers to an address that cannot call `acceptAdmin()`.

### Planned Audits

A full external audit is planned before any mainnet deployment. All code is open source and available for community review.

---

## 11. Team

**Lorenzo** — Founder, CEO, CTO
Full-stack developer and entrepreneur. Designed and implemented all smart contracts, the governance architecture, and the dapp.

**Open-Source Contribution Model**
Anyone can submit a pull request. Contributors with significant impact may be hired via a CompaniesHouseV1 company and paid in WLF or USDT through the on-chain payroll system. The codebase is MIT-licensed with no private forks.

**We Are Seeking**
Entrepreneurs with product ideas to build on the platform. Developers experienced in Solidity, DeFi, and React. Makers interested in integrating physical hardware with on-chain governance. Economists, legal scholars, and translators who want to extend the platform's reach.

---

## 12. Legal Disclaimer

This white paper is provided for informational purposes only and does not constitute financial advice, investment advice, or a solicitation to purchase any security or financial instrument.

WLF tokens are utility and governance tokens within the Werewolf Solutions ecosystem. They are not shares, securities, or any form of equity in a legal entity. Participation in token sales does not entitle holders to dividends, profit sharing, or any rights beyond those encoded in the smart contracts described in this document.

The regulatory status of utility tokens and decentralised governance systems varies by jurisdiction. Participants are solely responsible for understanding and complying with the laws applicable to them in their respective jurisdictions.

Smart contracts carry inherent risks including but not limited to: bugs in code, protocol-level vulnerabilities, economic exploits, oracle failures, and regulatory changes. While the development team takes security seriously and plans to conduct external audits before mainnet deployment, no guarantee is made that the system is free of vulnerabilities.

Past performance of cryptocurrency markets is not indicative of future results. The value of WLF tokens may go to zero. Only participate with funds you can afford to lose entirely.

This document reflects the state of the project as of v0.1.2 (Q1 2026) and will be updated as the protocol evolves. The most current version is always available in the open-source repository.

---

_Werewolf DAO is open source. The code is the contract._

_Repository: [github.com/werewolf-solutions/dao-project](https://github.com/werewolf-solutions/dao-project)_
_Discord: [https://discord.gg/6z4PTVYB](https://https://discord.gg/6z4PTVYB)_
