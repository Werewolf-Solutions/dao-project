# WLF DAO

- Trello board: https://trello.com/b/bOGxJpTY/dao-project
- Discord: https://discord.gg/DVDtsbHp

---

## Overview

WLF DAO is a fully on-chain decentralized organization built on Ethereum. Token holders buy WLF, stake for yield, and govern the protocol through proposals that execute via a 2-day timelock. Companies can be registered on-chain and pay employees in WLF, automatically converted from USD at the live market rate.

---

## Contracts

### WerewolfTokenV1
ERC-20 governance token (WLF). Total supply: 1B tokens minted to Treasury. Implements checkpoints on every transfer so voting power is always snapshotted at the proposal creation block.

### Treasury
Holds DAO funds (WLF + USDT). Distributes staking rewards. Can buy back WLF via Uniswap. Owned by Timelock.

### Timelock
Enforces a 2-day minimum delay on all governance actions. Admin is transferred to DAO after deployment.

### DAO
Manages proposal creation, guardian approval, voting (snapshot-based), queuing, and execution.

- Proposal cost: 10 WLF (sent to Treasury)
- Voting delay: 1 day
- Voting period: 3 days
- Quorum: 50%
- Max operations per proposal: 10
- Guardian approves proposals from Pending → Active

### Staking
ERC-4626 vault. Per-position tracking. Rewards auto-compound into share price.

- Base APY: 6% (flexible) up to 80% (10-year fixed)
- APY formula: half-life decay `MIN + (MAX - MIN) / 2^exponent`
- 7 fixed durations: 30d (+5%), 3mo (+10%), 6mo (+15%), 1yr (+25%), 2yr (+40%), 5yr (+60%), 10yr (+80% bonus APY)
- Supports: `stakeFlexible`, `stakeFixed`, `addToPosition`, `withdrawPosition`, `withdrawAll`
- Emergency pause via guardian or owner

### TokenSale
- Sale #0: founding round — collected USDT + paired WLF deposited into Uniswap v3 WLF/USDT pool; LP shares locked 5 years
- Sale #N: collected USDT added to existing Uniswap pool at current market price; remainder goes to Treasury
- Emergency pause on `buyTokens`

### LPStaking
ERC-4626 vault for WLF/USDT LP tokens. Same APY mechanics as Staking. LP positions initialized automatically when a token sale ends.

### UniswapHelper
Facilitates Uniswap v3 liquidity operations for TokenSale. Applies 1% slippage protection and a 20-minute deadline.

### CompaniesHouseV1
On-chain company registry.

- Create companies with a dedicated company wallet
- Hire employees with multi-role salary streams (USDT/hr stored on-chain)
- Salary paid in WLF, converted from USDT at the live TokenSale price at pay time
- Batch `payEmployees(companyId)` to pay all active employees in one tx
- Soft delete for companies and employees
- View functions: `getTotalPendingPay`, `getMonthlyBurnUSDT`, `getRequiredFor5Years`
- Emergency pause on create/hire/pay

---

## Dapp

React + Vite + Wagmi frontend at `dapp/`.

Pages:
- `/` — landing page with protocol overview
- `/token-sale` — buy WLF, progress bar, LP split estimate, past sales with participant lists
- `/staking` — WLF and LP staking tabs; per-position cards with live ticker, withdraw flows, add-to-position
- `/dao` — proposal list, create proposal (quick templates + raw), guardian controls, emergency pause, treasury actions
- `/companies-house` — create company, hire/fire employees, pay salary, payment history from event logs
- `/account` — wallet connection and balances

---

## DAO Proposal Flow

### Normal proposals
1. Create proposal (costs 10 WLF → Treasury)
2. Guardian approves → state: Active
3. Voting delay: 1 day
4. Voting period: 3 days
5. If succeeded (50% quorum) → Queue (2-day timelock)
6. Execute after ETA

### Emergency pause (current implementation)
Guardian can directly call `pause()` / `unpause()` on Staking, CompaniesHouse, and TokenSale without going through a proposal.

---

## Deploy Steps

1. Deploy `Treasury` (founder as initial owner)
2. Deploy `Timelock` (founder as admin, 2-day delay)
3. Deploy `WerewolfTokenV1` (mints 1B WLF to Treasury)
4. Set WerewolfToken address in Treasury
5. Deploy `Staking`
6. Deploy `LPStaking`
7. Deploy `DAO` (guardian = founder)
8. Deploy `TokenSale`
9. Deploy `CompaniesHouseV1`
10. Airdrop 5M WLF to TokenSale
11. Start Sale #0
12. Transfer ownership of WerewolfToken, Treasury, TokenSale to Timelock

```bash
forge script script/Deploy.s.sol
# addresses written to script/output/deployed-addresses.txt
```

---

## Testing

```bash
forge test                  # all tests, summary
forge test -vvvv            # all tests, full traces
```

### By suite

```bash
forge test --match-contract DaoTest          # DAO governance lifecycle
forge test --match-contract StakingTest      # WLF staking (position create/withdraw/APY)
forge test --match-contract LPStakingTest    # LP staking vault
forge test --match-contract TimelockTest     # timelock queue/cancel/execute timing
forge test --match-contract TreasuryTest     # threshold guards, buyback, withdraw
forge test --match-contract WerewolfTokenTest # mint, airdrop, checkpoint behavior
forge test --match-contract TokenSaleWithLPTest # token sale + Uniswap LP flow
```

### Verbosity flags

| Flag | Shows |
|------|-------|
| _(none)_ | pass/fail + gas |
| `-vv` | `console.log` output |
| `-vvv` | stack traces on failure |
| `-vvvv` | full traces on every test |

> `--match-test` matches by substring — e.g. `forge test --match-test test_cannot` runs all tests containing "cannot".

---

## Contract Layout Standard

All contracts follow this structure:

1. Data types (structs, enums, type declarations)
2. State Variables
3. Events
4. Function Modifiers
5. Constructor / Initialize
6. Fallback and Receive functions
7. External functions
8. Public functions
9. Internal functions
10. Private functions

### NatSpec format

```solidity
/**
 * @notice Explain what this function does
 * @param paramName Documents a parameter
 * @return Documents the return variables
 * @inheritdoc ContractName Copies missing tags from base function
 */
```

---

## TODO

- [ ] Emergency proposals — full on-chain flow: auto-created from multisig, no reviewing period, 7-day voting, 100% quorum + threshold, auto-executed if passed
- [ ] DAO: use sWLF and WLF_LP checkpoints in voting power (currently WLF only)
- [ ] Treasury: ETH and WBTC support
- [ ] CompaniesHouse: off-chain ERP oracle integration for auditable financial data
- [ ] Dapp: Ledger and other wallet support
