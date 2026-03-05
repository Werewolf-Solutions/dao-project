# DAO Project - Sprint Planning

**Project**: Decentralized Autonomous Organization with Governance, Staking, and Token Economics
**Sprint Duration**: 2 weeks
**Current Branch**: v0.1.2
**Last Updated**: 2025-10-28

---

## Project Status Overview

**Completion**: ~40-50% for MVP deployment

**Critical Blockers**:
- Staking contract has incomplete functions (missing return statements)
- TokenSale → Uniswap integration disabled (commented out)
- TokenSale → LP staking integration disabled (commented out)
- Debug functions present in production code

**Working Components**:
- DAO proposal creation, voting, queue, execute (in testing)
- Treasury management
- WerewolfToken with checkpoint infrastructure
- Basic staking structure (needs completion)
- Timelock governance (admin transfer needs testing)

---

## Sprint 1: Core Token Economics (2 weeks)

**Goal**: Complete the token purchase → liquidity → staking flow and fix critical Staking contract bugs

**Priority**: HIGH - Blocking MVP deployment

### User Stories

#### 1. As a token buyer, I want my purchase to automatically add liquidity to Uniswap
**Story Points**: 8

**Tasks**:
- [ ] Fix `TokenSale.buyTokens()` Uniswap integration (currently commented out lines 202-210)
- [ ] Remove "BUG:" markers in TokenSale.sol (lines 44, 68)
- [ ] Update `UniswapHelper.addLiquidity()` to accept recipient parameter
- [ ] Add slippage protection to UniswapHelper (replace hardcoded 0 minimums at lines 37-38)
- [ ] Add error handling for failed liquidity operations
- [ ] Test: Verify liquidity is added after token purchase
- [ ] Test: Verify LP tokens are minted to correct recipient

**Acceptance Criteria**:
- When user calls `buyTokens()`, WLF and USDT are automatically added to Uniswap v3
- LP tokens (WLF_USDT_LP) are minted
- Slippage protection prevents sandwich attacks
- All operations revert properly on failure

**Files**:
- [src/TokenSale.sol](src/TokenSale.sol)
- [src/UniswapHelper.sol](src/UniswapHelper.sol)

---

#### 2. As a token buyer, I want my LP tokens automatically staked
**Story Points**: 8

**Tasks**:
- [ ] Fix `TokenSale.buyTokens()` staking integration (currently commented out lines 195-199)
- [ ] Update Staking contract to support LP tokens (not just WLF)
- [ ] Add token type tracking in Staking (WLF vs WLF_USDT_LP)
- [ ] Implement LP token staking with fixed duration (5 years for sale #0)
- [ ] Update APY calculation to handle LP tokens differently if needed
- [ ] Test: Verify LP tokens are staked after purchase
- [ ] Test: Verify staking duration is set correctly (5 years)
- [ ] Test: Full flow test: buy → liquidity → stake

**Acceptance Criteria**:
- After Uniswap liquidity is added, LP tokens are automatically staked
- Staking duration matches sale parameters (5 years for sale #0)
- LP stakes tracked separately or identifiably from WLF stakes
- Full integration test passes: USDT → WLF purchase → Uniswap liquidity → LP staking

**Files**:
- [src/TokenSale.sol](src/TokenSale.sol)
- [src/Staking.sol](src/Staking.sol)

---

#### 3. As a developer, I need complete Staking contract implementations
**Story Points**: 5

**Tasks**:
- [ ] Fix `_lockStakeBonusRewards()` - add return statement (line 321)
- [ ] Fix `_convertToAssets()` - add return values (line 326)
- [ ] Fix `_convertToShares()` - add return values (line 386)
- [ ] Fix `totalAssets()` - add return statement (line 331)
- [ ] Resolve precision loss concerns (lines 319, 402)
- [ ] Implement transfer function for locked staked tokens (line 316)
- [ ] Test: Unit tests for all fixed functions
- [ ] Test: Verify precision in edge cases (very small/large amounts)

**Acceptance Criteria**:
- All functions return correct values
- No compiler warnings about missing return statements
- Precision loss is documented or mitigated
- Unit test coverage for all modified functions

**Files**:
- [src/Staking.sol](src/Staking.sol)
- [test/unit/StakingTest.t.sol](test/unit/StakingTest.t.sol)

---

#### 4. As a founder, I want to complete the initial token sale flow
**Story Points**: 5

**Tasks**:
- [ ] Test full Deploy.s.sol flow with buyTokens integration
- [ ] Verify founder can buy 5M WLF tokens
- [ ] Verify USDT transfer (5,000 USDT)
- [ ] Verify Uniswap pool creation (5M WLF + 5k USDT)
- [ ] Verify LP tokens staked for 5 years
- [ ] Document the complete flow in CLAUDE.md
- [ ] Test: End-to-end deployment test

**Acceptance Criteria**:
- `forge script script/Deploy.s.sol` runs successfully
- All tokens allocated correctly
- Uniswap pool has correct liquidity
- Founder's LP tokens are staked
- Process documented for future sales

**Files**:
- [script/Deploy.s.sol](script/Deploy.s.sol)
- [test/DaoTest.t.sol](test/DaoTest.t.sol) or new integration test

---

### Sprint 1 Definition of Done
- [ ] Token purchase flow complete: USDT → WLF → Uniswap liquidity → LP staking
- [ ] All Staking contract functions complete (no missing returns)
- [ ] All tests passing with `forge test -vvvv`
- [ ] Integration test covering full flow
- [ ] No critical bugs or TODOs remaining in modified code
- [ ] Code reviewed and merged to main branch

---

## Sprint 2: DAO Decentralization & Voting Power (2 weeks)

**Goal**: Complete DAO admin transfer, implement checkpoint-based voting, and enhance governance

**Priority**: HIGH - Critical for decentralization

### User Stories

#### 1. As the DAO, I want to control the Timelock (admin transfer)
**Story Points**: 8

**Tasks**:
- [ ] Uncomment and test `_setTimelockAdmin()` in Deploy.s.sol (line 92)
- [ ] Debug ETA timing issues in admin transfer flow
- [ ] Test two-step process: `setPendingAdmin()` → `acceptAdmin()`
- [ ] Verify DAO can execute timelock operations after transfer
- [ ] Add integration test for admin transfer in DaoTest.t.sol
- [ ] Remove debug functions after testing:
  - [ ] DAO.sol: `testAdmin()` (line 378)
  - [ ] Timelock.sol: `DebugEta` events (lines 143-145)
  - [ ] Timelock.sol: `DebugSender` event (line 99)
- [ ] Document admin transfer process in deployment guide

**Acceptance Criteria**:
- Timelock admin successfully transfers from founder to DAO
- DAO can queue and execute proposals through Timelock
- Two-step security process works correctly
- No debug functions remain in production code
- Process is repeatable and tested

**Files**:
- [script/Deploy.s.sol](script/Deploy.s.sol)
- [src/DAO.sol](src/DAO.sol)
- [src/Timelock.sol](src/Timelock.sol)
- [test/DaoTest.t.sol](test/DaoTest.t.sol)

---

#### 2. As a token holder, I want my voting power based on checkpoints
**Story Points**: 13

**Tasks**:
- [ ] Update DAO voting to use `getPriorVotes()` instead of `balanceOf()`
- [ ] Implement checkpoint voting for WLF token (already has checkpoint infrastructure)
- [ ] Add checkpoint support for sWLF (staked WLF shares)
- [ ] Add checkpoint support for WLF_USDT_LP tokens
- [ ] Update proposal creation to check checkpoint-based voting power
- [ ] Update voting functions to use historical balances
- [ ] Test: Verify votes counted from checkpoint, not current balance
- [ ] Test: Verify voting power can't be manipulated by transfers during voting
- [ ] Test: Multi-token voting power (WLF + sWLF + LP)

**Acceptance Criteria**:
- Voting power calculated from block number when voting starts
- Token transfers after voting starts don't affect vote weight
- All three token types (WLF, sWLF, WLF_LP) contribute to voting power
- Checkpoint system prevents vote manipulation
- Tests verify checkpoint accuracy

**Files**:
- [src/DAO.sol](src/DAO.sol)
- [src/WerewolfTokenV1.sol](src/WerewolfTokenV1.sol)
- [src/Staking.sol](src/Staking.sol) (for sWLF checkpoints)
- [test/DaoTest.t.sol](test/DaoTest.t.sol)

---

#### 3. As a token holder, I want emergency proposals for critical situations
**Story Points**: 8

**Tasks**:
- [ ] Implement `createEmergencyProposal()` function
- [ ] Add emergency proposal state tracking
- [ ] Set emergency parameters: 0 day review, 7 day voting
- [ ] Implement 100% quorum and threshold requirements
- [ ] Skip queue step for emergency proposals (0 day queue)
- [ ] Auto-execute if emergency proposal succeeds
- [ ] Add emergency proposal creation from multisig
- [ ] Test: Create emergency proposal
- [ ] Test: Verify 100% voting requirement
- [ ] Test: Verify immediate execution
- [ ] Document emergency proposal flow

**Acceptance Criteria**:
- Emergency proposals can be created (ideally from multisig)
- No reviewing period (immediate activation)
- 7-day voting period
- Requires 100% quorum and 100% approval
- Executes immediately without queue delay
- Regular proposals remain unchanged

**Files**:
- [src/DAO.sol](src/DAO.sol)
- [test/DaoTest.t.sol](test/DaoTest.t.sol)

---

#### 4. As a developer, I want comprehensive DAO testing
**Story Points**: 5

**Tasks**:
- [ ] Add test for proposal lifecycle with checkpoints
- [ ] Add test for voting power calculation across token types
- [ ] Add test for proposal execution through Timelock
- [ ] Add test for guardian approval flow
- [ ] Add test for quorum and threshold calculations
- [ ] Add test for proposal cancellation
- [ ] Add edge case tests (no votes, tie votes, etc.)
- [ ] Achieve >80% test coverage for DAO.sol

**Acceptance Criteria**:
- All DAO functions have test coverage
- Edge cases handled and tested
- Integration tests with Timelock working
- Test suite runs cleanly with `forge test -vvvv`

**Files**:
- [test/DaoTest.t.sol](test/DaoTest.t.sol)

---

### Sprint 2 Definition of Done
- [ ] DAO controls Timelock (admin transfer complete)
- [ ] Checkpoint-based voting implemented for all token types
- [ ] Emergency proposals implemented and tested
- [ ] All debug functions removed from DAO and Timelock
- [ ] Test coverage >80% for DAO.sol
- [ ] All tests passing
- [ ] Documentation updated

---

## Sprint 3: CompaniesHouse & Production Readiness (2 weeks)

**Goal**: Implement CompaniesHouse CRUD operations and prepare for production deployment

**Priority**: MEDIUM - Feature completion

### User Stories

#### 1. As a user, I want to create and manage a company
**Story Points**: 8

**Tasks**:
- [ ] Implement `createCompany()` function
- [ ] Implement `updateCompany()` function
- [ ] Implement `deleteCompany()` function (or deactivate)
- [ ] Implement `getCompany()` view function
- [ ] Add company ownership verification
- [ ] Add events for all CRUD operations
- [ ] Resolve TODO: combine roles and powerRoles storage (line 67)
- [ ] Test: Create company
- [ ] Test: Update company details
- [ ] Test: Only owner can update
- [ ] Test: Delete/deactivate company

**Acceptance Criteria**:
- Users can create companies with required information
- Only company owner can update company details
- Companies can be deleted or deactivated
- All operations emit events
- Gas-optimized storage (roles/powerRoles combined if needed)

**Files**:
- [src/CompaniesHouseV1.sol](src/CompaniesHouseV1.sol)
- New test file: `test/CompaniesHouseTest.t.sol`

---

#### 2. As a company owner, I want to manage employees
**Story Points**: 8

**Tasks**:
- [ ] Implement `hireEmployee()` function
- [ ] Implement `fireEmployee()` function
- [ ] Implement `updateEmployeeRole()` function
- [ ] Implement `giveRole()` / `revokeRole()` functions
- [ ] Add employee verification and permissions
- [ ] Track employee history (hire/fire dates)
- [ ] Add collaborator management (similar to employees)
- [ ] Test: Hire employee
- [ ] Test: Fire employee
- [ ] Test: Role management
- [ ] Test: Permission checks

**Acceptance Criteria**:
- Company owners can hire/fire employees
- Roles can be assigned and revoked
- Employee history is tracked
- Only authorized addresses can manage employees
- Collaborators supported separately from employees

**Files**:
- [src/CompaniesHouseV1.sol](src/CompaniesHouseV1.sol)
- Test: `test/CompaniesHouseTest.t.sol`

---

#### 3. As a company owner, I want to pay employees
**Story Points**: 13

**Tasks**:
- [ ] Implement `payEmployee()` function
- [ ] Implement batch payment function `payMultipleEmployees()`
- [ ] Add payment token support (WLF, USDT, etc.)
- [ ] Integrate with Treasury for payment funding
- [ ] Add payment history tracking
- [ ] Plan oracle integration for off-chain ERP (future phase)
- [ ] Add payment verification and limits
- [ ] Test: Pay single employee
- [ ] Test: Pay multiple employees (batch)
- [ ] Test: Multi-token payments
- [ ] Test: Insufficient balance handling
- [ ] Document payment flow

**Acceptance Criteria**:
- Company owners can pay employees in supported tokens
- Batch payments work efficiently
- Payment history is recorded on-chain
- Integration with Treasury for fund management
- Oracle integration planned (not implemented this sprint)

**Files**:
- [src/CompaniesHouseV1.sol](src/CompaniesHouseV1.sol)
- [src/Treasury.sol](src/Treasury.sol) (integration)
- Test: `test/CompaniesHouseTest.t.sol`

---

#### 4. As a developer, I want production-ready code
**Story Points**: 8

**Tasks**:
- [ ] Remove all debug functions:
  - [ ] DAO.sol debug functions (lines 270, 364, 373)
  - [ ] Timelock.sol debug events
  - [ ] Any remaining test/debug code
- [ ] Remove all "BUG:" and "TODO:" comments (resolve or document)
- [ ] Review and fix all "todo remove after testing" markers
- [ ] Add comprehensive NatSpec documentation to all functions
- [ ] Run gas optimization pass
- [ ] Security review checklist:
  - [ ] Re-entrancy protection
  - [ ] Access control verification
  - [ ] Integer overflow/underflow checks
  - [ ] Front-running vulnerabilities
- [ ] Update CLAUDE.md with final architecture
- [ ] Create deployment checklist

**Acceptance Criteria**:
- Zero debug functions in production code
- All TODOs resolved or moved to backlog
- Comprehensive NatSpec on all public/external functions
- Security checklist completed
- Gas optimization review complete
- Production deployment guide ready

**Files**:
- All contract files
- [CLAUDE.md](CLAUDE.md)
- New file: `DEPLOYMENT.md`

---

### Sprint 3 Definition of Done
- [ ] CompaniesHouse CRUD fully implemented
- [ ] Employee/collaborator management working
- [ ] Payment system implemented (except oracle)
- [ ] All debug code removed
- [ ] All TODOs resolved or documented
- [ ] Security review complete
- [ ] Production deployment ready
- [ ] All tests passing

---

## Backlog (Future Sprints)

### High Priority
- [ ] **Token Sale #1**: Public token sale implementation (after #0 completes)
- [ ] **Voting delegation**: Allow token holders to delegate voting power
- [ ] **Proposal templates**: Common proposal types (fee changes, token additions, etc.)
- [ ] **Treasury management UI**: Better treasury visibility and management
- [ ] **Multi-sig integration**: Enhanced security for critical operations

### Medium Priority
- [ ] **Oracle integration**: Connect CompaniesHouse to off-chain ERP systems
- [ ] **Financial auditing**: One-click company audit functionality
- [ ] **Staking rewards UI**: Better visibility into staking rewards and APY
- [ ] **Governance analytics**: Proposal history, voting patterns, participation rates
- [ ] **Gas optimization**: Reduce transaction costs across all contracts

### Low Priority / Future Phases
- [ ] **Mobile support**: Web3 mobile wallet integration
- [ ] **Subgraph**: The Graph protocol integration for better querying
- [ ] **Governance UI**: Full frontend for DAO governance
- [ ] **Company treasury**: Separate treasury per company
- [ ] **Employee roles expansion**: More granular permission system
- [ ] **Multi-chain deployment**: Deploy to other EVM chains
- [ ] **Token burning mechanism**: Deflationary tokenomics
- [ ] **Snapshot voting**: Off-chain voting with on-chain execution

### Technical Debt
- [ ] Merge BaseTest and DaoTest patterns (consolidate test setup)
- [ ] Refactor proxy deployment pattern (reduce duplication)
- [ ] Improve error messages (make them more descriptive)
- [ ] Add natspec to all internal functions
- [ ] Gas profiling and optimization report
- [ ] Upgrade dependencies (OpenZeppelin, etc.)

---

## Sprint Ceremonies

### Sprint Planning (Start of each sprint)
1. Review previous sprint completion
2. Discuss and estimate new stories
3. Assign tasks to sprint
4. Set sprint goal and success criteria

### Daily Standup (Async via Discord/Trello)
- What did you complete yesterday?
- What will you work on today?
- Any blockers?

### Sprint Review (End of each sprint)
- Demo completed features
- Review acceptance criteria
- Update product backlog

### Sprint Retrospective (End of each sprint)
- What went well?
- What could be improved?
- Action items for next sprint

---

## Definition of Ready (Before starting any story)

- [ ] User story clearly defined
- [ ] Acceptance criteria documented
- [ ] Technical approach discussed
- [ ] Dependencies identified
- [ ] Estimated (story points assigned)

---

## Definition of Done (For all stories)

- [ ] Code complete and reviewed
- [ ] Unit tests written and passing
- [ ] Integration tests passing (if applicable)
- [ ] Documentation updated (NatSpec, CLAUDE.md)
- [ ] No new compiler warnings
- [ ] Gas usage acceptable
- [ ] Manual testing complete
- [ ] Merged to main branch

---

## Notes

**Branch Strategy**:
- `main` - production-ready code
- `v0.1.x` - version branches for releases
- Feature branches for each story/task

**Testing Strategy**:
- Unit tests for all new functions
- Integration tests for contract interactions
- End-to-end tests for complete flows
- Gas profiling for expensive operations

**Code Review**:
- All code must be reviewed before merge
- Security-critical changes require thorough review
- Gas optimization suggestions welcomed

**Communication**:
- Discord: https://discord.gg/DVDtsbHp
- Trello: https://trello.com/b/bOGxJpTY/dao-project

---

## Progress Tracking

**Sprint 1**: Not started
**Sprint 2**: Not started
**Sprint 3**: Not started

**Overall Progress**: 40-50% (based on codebase analysis)

Track detailed progress on Trello board: https://trello.com/b/bOGxJpTY/dao-project
