# WLF DAO

- Trello board: https://trello.com/b/bOGxJpTY/dao-project
- Discord: https://discord.gg/DVDtsbHp

---

## Getting Started

### Prerequisites

- [Foundry](https://getfoundry.sh) — Solidity toolchain
  ```bash
  curl -L https://foundry.paradigm.xyz | bash && foundryup
  ```
- Node.js ≥ 18 + npm

### 1. Clone

```bash
git clone https://github.com/Werewolf-Solutions/dao-project
cd dao-project
```

### 2. Install dependencies

```bash
make install
```

Runs `forge install` (Solidity libs) + `cd dapp && npm install` (React frontend).

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env — fill in the variables you need:
```

| Variable | Required for |
|---|---|
| `PRIVATE_KEY` | All deploys (deployer key) |
| `MULTISIG_ADDRESS` | All deploys (proxy admin) |
| `MULTISIG_PRIVATE_KEY` | Upgrade scripts |
| `SEPOLIA_RPC_URL` | Sepolia deploy / upgrade |
| `BASE_SEPOLIA_RPC_URL` | Base Sepolia deploy |
| `MAINNET_RPC_URL` | Mainnet deploy |
| `ETHERSCAN_API_KEY` | Sepolia + mainnet verification |
| `BASESCAN_API_KEY` | Base Sepolia verification |

### 4. Deploy

**Local (Anvil)** — start Anvil in a separate terminal first (`anvil`), then:

```bash
make deploy-local
make deploy-local-dry     # dry run (no broadcast)
```

**Sepolia testnet:**

```bash
make deploy-sepolia
make deploy-sepolia-dry   # dry run
```

**Base Sepolia** (Aave v3 live, real DeFi testing):

```bash
make deploy-base-sepolia
make deploy-base-sepolia-dry
```

**All testnets at once** (Sepolia + Base Sepolia; local if Anvil is running):

```bash
make deploy-all-testnets
make deploy-all-testnets-dry
```

**Mainnet** — always dry-run first:

```bash
make deploy-mainnet-dry   # simulate — check output carefully
make deploy-mainnet       # broadcast + verify
```

After each broadcast, `node scripts/sync-dapp.mjs` (or `make sync-dapp`) reads `script/output/deployed-addresses.txt` and writes updated contract addresses + ABIs into `dapp/src/contracts/addresses.ts` automatically.

### 5. Run the dapp

```bash
make dev
# or: cd dapp && npm run dev
```

Opens at http://localhost:5173 or next free port

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

### CompanyVault

Per-company DeFi investment vault, deployed as a minimal-proxy clone via `UpgradeableBeacon`. One vault per company, isolated from payroll funds in CompaniesHouseV1.

- Deposit / withdraw tokens
- Supply / withdraw from Aave v3 for yield; aTokens accrue directly in the vault
- Borrow from Aave against collateral (disabled by default; guardian can toggle without a proposal)
- Configurable minimum health factor (default 1.5×)
- Admin: Timelock; guardian: founder (for borrowing toggle without governance overhead)
- Beacon owned by Timelock — a single DAO proposal upgrades all company vaults atomically

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

Full sequence executed by `script/Deploy.s.sol`:

1. Deploy `UniswapHelper`
2. Deploy `Treasury` (founder as initial owner)
3. Deploy `Timelock` (founder as admin, chain-specific delay)
4. Deploy `WerewolfTokenV1` (mints 1B WLF to Treasury)
5. Set WerewolfToken address in Treasury
6. Deploy `Staking` + `LPStaking`
7. Wire Treasury → staking contracts; wire Staking → LPStaking reference
8. Deploy `DAO`; wire staking contracts for voting power
9. Deploy `TokenSale`; wire DAO ↔ TokenSale for auto-delegation; set 2-year delegate lock
10. Deploy `CompaniesHouseV1`; wire Treasury + DAO authorizations
11. Deploy `CompanyVault` implementation + `UpgradeableBeacon` (Timelock owns beacon); register in CompaniesHouseV1
12. Airdrop 5M WLF to TokenSale; start Sale #0
13. Create "Werewolf DAO" company + CompanyVault; mark as canonical DAO company (`setDaoCompanyId`)
14. Create "Werewolf Solutions" company + CompanyVault
15. Transfer ownership of WLF, Treasury, TokenSale, Staking → Timelock
16. Transfer Timelock admin → DAO (`setPendingAdmin` + `__acceptAdmin`)

```bash
forge script script/Deploy.s.sol
# addresses written to script/output/deployed-addresses.txt
```

---

## Upgrade

Upgrades detect changed contracts by comparing on-chain bytecode vs local artifacts — only changed contracts are redeployed. Proxy addresses are read automatically from `script/output/deployed-addresses.txt`.

Requires `MULTISIG_PRIVATE_KEY` in `.env` (the proxy admin key).

```bash
make upgrade-sepolia-dry        # simulate — see what would change
make upgrade-sepolia            # broadcast + verify

make upgrade-mainnet-dry
make upgrade-mainnet
```

---

## Governance Proposal Scripts

Walk through a full proposal lifecycle (creates a "Start Sale #1" test proposal).

Set required env vars from `script/output/deployed-addresses.txt` before running:

```bash
export DAO_ADDRESS=0x...
export WEREWOLF_TOKEN_ADDRESS=0x...
export TOKEN_SALE_ADDRESS=0x...
export PROPOSAL_ID=0   # needed for approve/queue/execute steps
```

**Local (Anvil):**

```bash
make propose-local              # create proposal
make approve-proposal-local     # guardian approves (Pending → Active)
make queue-proposal-local       # queue after voting passes
make execute-proposal-local     # execute after timelock delay
```

**Sepolia:**

```bash
make propose-sepolia
make approve-proposal-sepolia
make queue-proposal-sepolia
make execute-proposal-sepolia
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

| Flag     | Shows                     |
| -------- | ------------------------- |
| _(none)_ | pass/fail + gas           |
| `-vv`    | `console.log` output      |
| `-vvv`   | stack traces on failure   |
| `-vvvv`  | full traces on every test |

> `--match-test` matches by substring — e.g. `forge test --match-test test_cannot` runs all tests containing "cannot".

---

## Debug Utilities

```bash
make fork-debug     # full trace of endSale() against live Sepolia state (-vvvv)
make cast-debug     # quick cast state inspection of TokenSale / LPStaking
```

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
