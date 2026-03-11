# WLF DAO Dapp — QA Testing Scope

**Network:** Sepolia Testnet
**Wallet:** MetaMask required
**Token decimals:** WLF = 18, USDT = 6

---

## 1. Token Sale (`/token-sale`)

### Buy flow

| # | Test case | Expected |
|---|-----------|----------|
| T-1 | Enter 0 or negative WLF amount | "Enter an amount greater than 0" error; button disabled |
| T-2 | Enter amount exceeding available tokens | "Exceeds tokens available" error; button disabled |
| T-3 | Enter valid amount with no USDT allowance | "Approve USDT (one-time)" button shown |
| T-4 | Click Approve USDT | MetaMask popup for `approve(TokenSale, MAX)`; after confirmation button switches to "Buy with USDT" |
| T-5 | Click "Buy with USDT" with insufficient USDT balance | Button disabled |
| T-6 | Successful purchase | MetaMask popup; after confirmation: USDT balance decreases, progress bar advances |

### Post-sale states

| # | Test case | Expected |
|---|-----------|----------|
| T-7 | Sale ended — non-founder wallet | "Waiting for founder to create LP..." message; no action button |
| T-8 | Sale ended — founder wallet, LP not yet created | "Create LP & Lock All Shares" button shown |
| T-9 | Founder clicks "Create LP & Lock All Shares" | MetaMask popup; after confirmation LP is created and shares locked for 5 years |
| T-10 | LP already created | "View Staking Positions" button links to `/staking?tab=lp` |

---

## 2. Staking (`/staking`)

### WLF staking flows

| # | Test case | Expected |
|---|-----------|----------|
| S-1 | New position — enter 0 amount | Stake button disabled |
| S-2 | New position — no WLF allowance | "Approve WLF" shown first; after approval stake button active |
| S-3 | Successful flexible stake | MetaMask popup; new position card appears; WLF balance decreases |
| S-4 | Successful fixed stake (any duration) | MetaMask popup; position shows lock date and bonus multiplier |
| S-5 | Add stake to existing position — no allowance | Approve step shown first |
| S-6 | Successful add to position | MetaMask popup; position WLF value increases |

### Position states & withdrawals

| # | Test case | Expected |
|---|-----------|----------|
| S-7 | Fixed position still locked — withdraw amount | Input and Withdraw button disabled |
| S-8 | Fixed position still locked — Withdraw All | Button shows lock date; disabled |
| S-9 | Fixed position unlocked — Withdraw All | MetaMask popup; position removed; WLF balance increases |
| S-10 | Partial withdraw on unlocked position | MetaMask popup; position principal reduced; WLF balance increases by withdrawn amount |
| S-11 | "Withdraw Rewards" on unlocked position with earned > 0 | MetaMask popup; only accrued rewards sent; principal stays staked |
| S-12 | Withdraw Rewards on newly created position (earned = 0) | Button not shown |

### LP Staking

| # | Test case | Expected |
|---|-----------|----------|
| S-13 | LP positions load correctly for user with staked LP | Position cards shown with lock/unlock state |
| S-14 | Withdraw LP position | MetaMask popup; LP tokens returned to wallet |

---

## 3. DAO (`/dao`)

### Proposal lifecycle

| # | Test case | Expected |
|---|-----------|----------|
| D-1 | No WLF allowance for DAO | "Approve WLF (proposal fee)" button shown; "Create Proposal" hidden |
| D-2 | Approve WLF for proposal fee | MetaMask popup; after confirmation "Create Proposal" button appears |
| D-3 | Create proposal (Quick — Set Voting Period) | MetaMask popup; proposal appears in list with Pending state |
| D-4 | Create proposal (Quick — Set Voting Delay) | MetaMask popup; proposal appears with Pending state |
| D-5 | Create proposal (Quick — Start Token Sale) | WLF amount auto-calculated from USDT target / price; MetaMask popup; proposal created |
| D-6 | Create proposal (Quick — Airdrop WLF) | Invalid address shows inline error; amount <= 0 shows error; valid submit creates proposal |
| D-7 | Create proposal (Quick — Company Airdrop) | Select companies + enter amount; MetaMask popup; proposal created |
| D-8 | Create proposal (Quick — WLF Buyback) | Enter USDT amount + min WLF; MetaMask popup; proposal created |
| D-9 | Create proposal (Quick — Set DAO Contract on TokenSale) | MetaMask popup; proposal created |
| D-10 | Create proposal (Raw tab) — array length mismatch | Error shown; submit blocked |
| D-11 | Create proposal (Raw tab) — valid input | MetaMask popup; proposal created |

### Proposal states & actions

| # | Test case | Expected |
|---|-----------|----------|
| D-12 | Pending — guardian wallet clicks Approve | MetaMask popup; proposal moves to Active |
| D-13 | Pending — non-guardian wallet | No Approve button shown |
| D-14 | Active — vote For / Against / Abstain | MetaMask popup; vote bar updates after confirmation |
| D-15 | Active — vote with 0 WLF balance at snapshot | Tx reverts; error shown |
| D-16 | Active — attempt to vote twice with same wallet | Second tx rejected; error shown |
| D-17 | Succeeded — click Queue | MetaMask popup; proposal moves to Queued; ETA set to now + 2 days |
| D-18 | Queued — before ETA | Execute button disabled or not shown |
| D-19 | Queued — after 2-day ETA | Execute button active; MetaMask popup; on-chain actions executed |
| D-20 | Defeated / Canceled / Expired | No action buttons available |
| D-21 | Executed | Read-only; no action buttons |

### Guardian controls

| # | Test case | Expected |
|---|-----------|----------|
| D-22 | Guardian: Wire TokenSale into DAO (when not set) | "Set" button calls `setTokenSaleContract()` directly; banner disappears after confirmation |
| D-23 | Guardian: Pause Staking | `staking.pause()` called; new stakes rejected on Staking page after confirmation |
| D-24 | Guardian: Unpause Staking | `staking.unpause()` called; staking restores |
| D-25 | Guardian: Pause CompaniesHouse | `companiesHouse.pause()` called; create/hire/pay actions revert |
| D-26 | Guardian: Unpause CompaniesHouse | `companiesHouse.unpause()` called; actions restore |
| D-27 | Non-guardian wallet | Emergency Pause panel not visible |

### Treasury direct actions

| # | Test case | Expected |
|---|-----------|----------|
| D-28 | Click "Distribute Rewards" | `treasury.distributeRewards()` called; staking reward reserve increases |
| D-29 | Click "Distribute Rewards to LP" | `treasury.distributeRewardsToLP()` called |
| D-30 | LP Delegation — delegate voting power | MetaMask popup; delegation recorded on-chain |

---

## 4. Companies House (`/companies-house`)

### Create Company

| # | Test case | Expected |
|---|-----------|----------|
| C-1 | Submit without WLF approval | "Approve WLF" step shown first |
| C-2 | Approve WLF for creation fee | MetaMask popup; after confirmation "Create" button active |
| C-3 | Successful create | MetaMask popup; company card appears; WLF fee deducted |

### Hire & Fire Employee

| # | Test case | Expected |
|---|-----------|----------|
| C-4 | Successful hire | MetaMask popup; employee card appears inside company |
| C-5 | Hire same address twice | Contract rejects; error shown in UI |
| C-6 | Fire employee — two-step confirm (authorized user) | MetaMask popup; employee marked inactive and card removed |
| C-7 | Fire button not shown for own account | Not visible on self |
| C-8 | Non-authorized user | No fire button shown |

### Pay flows

| # | Test case | Expected |
|---|-----------|----------|
| C-9 | Pay single employee | MetaMask popup calls `payEmployee()`; pending pay resets to 0 |
| C-10 | Pay All Employees | MetaMask popup calls `payEmployees(companyId)`; all pending pays reset |
| C-11 | Pay when company has insufficient USDT balance | Tx reverts; error shown |
| C-12 | Payment History | Fetches `EmployeePaid` event logs; shows date + USDT amount table (last 20, newest first) |

### USDT Deposit

| # | Test case | Expected |
|---|-----------|----------|
| C-13 | Deposit USDT — no allowance | Approve USDT step shown first |
| C-14 | Successful USDT deposit | MetaMask popup; company payroll balance increases |

### Multi-role employees

| # | Test case | Expected |
|---|-----------|----------|
| C-15 | Add role to existing employee | MetaMask popup; additional salary stream appears |
| C-16 | Pending pay reflects sum of all salary items | Total pending pay = sum across all roles |

### Delete Company

| # | Test case | Expected |
|---|-----------|----------|
| C-17 | Delete Company — two-step confirm (owner) | MetaMask popup; company card removed |
| C-18 | Non-owner | No delete button shown |

---

## 5. Edge Cases & Error Handling

| # | Test case | Expected |
|---|-----------|----------|
| E-1 | Reject any MetaMask transaction | UI shows no crash; TxStatus shows failure |
| E-2 | Submit form while previous tx is pending | Buttons show loading/disabled; no double-submission |
| E-3 | Network drops mid-flow | Graceful error; no infinite spinner |
| E-4 | Contract not deployed on connected chain | "Not deployed on chain X" message; no crash |
| E-5 | Staking contract paused — attempt to stake | Tx reverts; clear error shown |
| E-6 | CompaniesHouse paused — attempt to create/hire/pay | Tx reverts; clear error shown |
| E-7 | TokenSale paused — attempt to buy | Tx reverts; clear error shown |
| E-8 | Attempt to withdraw from locked fixed position | Button disabled; lock date shown |
| E-9 | Attempt to execute queued proposal before ETA | Execute button disabled or tx reverts |
| E-10 | Attempt to vote on non-Active proposal | Vote buttons not shown |

---

## Notes

- All write operations require Sepolia ETH for gas — ensure the test wallet is funded before starting.
- Time-sensitive flows (voting period, timelock ETA) cannot be accelerated on testnet. Coordinate with the team to use a local Anvil instance for timing-dependent test cases (D-18, D-19).
- Guardian-specific test cases (D-12, D-22 through D-27) require the founder wallet.
- For proposal lifecycle testing, plan the full flow end-to-end: create -> guardian approve -> wait voting delay -> vote -> wait voting period -> queue -> wait 2 days -> execute.
