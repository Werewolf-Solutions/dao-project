include .env

# ─── Install ──────────────────────────────────────────────────────────────────

install:
	forge install
	cd dapp && npm install

# ─── Run dapp ─────────────────────────────────────────────────────────────────

dev:
	cd dapp && npm run dev

# ─── Local (Anvil on localhost:8545) ──────────────────────────────────────────

deploy-local-dry:
	forge script script/Deploy.s.sol:Deploy --fork-url http://localhost:8545

deploy-local:
	forge script script/Deploy.s.sol:Deploy --fork-url http://localhost:8545 --broadcast && node scripts/sync-dapp.mjs

# ─── Test Proposal: Start Sale #1 (local) ────────────────────────────────────
# Set env vars from script/output/deployed-addresses.txt before running:
#   export DAO_ADDRESS=0x... WEREWOLF_TOKEN_ADDRESS=0x... TOKEN_SALE_ADDRESS=0x...
# For approve/queue/execute also set: export PROPOSAL_ID=0

propose-local:
	STEP=create forge script script/TestProposal_StartSale1.s.sol:TestProposalStartSale1 \
		--fork-url http://localhost:8545 --broadcast

approve-proposal-local:
	STEP=approve forge script script/TestProposal_StartSale1.s.sol:TestProposalStartSale1 \
		--fork-url http://localhost:8545 --broadcast

queue-proposal-local:
	STEP=queue forge script script/TestProposal_StartSale1.s.sol:TestProposalStartSale1 \
		--fork-url http://localhost:8545 --broadcast

execute-proposal-local:
	STEP=execute forge script script/TestProposal_StartSale1.s.sol:TestProposalStartSale1 \
		--fork-url http://localhost:8545 --broadcast

# ─── Sepolia ──────────────────────────────────────────────────────────────────

deploy-sepolia-dry:
	forge script script/Deploy.s.sol:Deploy --rpc-url $(SEPOLIA_RPC_URL)

deploy-sepolia:
	forge script script/Deploy.s.sol:Deploy \
		--rpc-url $(SEPOLIA_RPC_URL) --broadcast \
		--private-key $(PRIVATE_KEY)
	node scripts/sync-dapp.mjs
	forge script script/Deploy.s.sol:Deploy \
		--rpc-url $(SEPOLIA_RPC_URL) \
		--verify --etherscan-api-key $(ETHERSCAN_API_KEY) \
		--resume --private-key $(PRIVATE_KEY)

# ─── Deploy (Base Sepolia) ────────────────────────────────────────────────────
# Uses real Aave v3 + Aave-listed USDT for DeFi testing.
# Requires BASE_SEPOLIA_RPC_URL and BASESCAN_API_KEY in .env

deploy-base-sepolia-dry:
	forge script script/Deploy.s.sol:Deploy --rpc-url $(BASE_SEPOLIA_RPC_URL)

deploy-base-sepolia:
	forge script script/Deploy.s.sol:Deploy \
		--rpc-url $(BASE_SEPOLIA_RPC_URL) --broadcast \
		--private-key $(PRIVATE_KEY)
	node scripts/sync-dapp.mjs
	forge script script/Deploy.s.sol:Deploy \
		--rpc-url $(BASE_SEPOLIA_RPC_URL) \
		--verify --etherscan-api-key $(BASESCAN_API_KEY) \
		--verifier-url https://api-sepolia.basescan.org/api \
		--resume --private-key $(PRIVATE_KEY)

# ─── Deploy (all testnets at once) ───────────────────────────────────────────
# Deploys to Sepolia + Base Sepolia sequentially; also deploys to local Anvil
# if a node is detected on localhost:8545.
# sync-dapp.mjs merges each chain's addresses into addresses.ts incrementally.

deploy-all-testnets-dry:
	@echo "=== [dry] Sepolia ==="
	forge script script/Deploy.s.sol:Deploy --rpc-url $(SEPOLIA_RPC_URL)
	@echo "=== [dry] Base Sepolia ==="
	forge script script/Deploy.s.sol:Deploy --rpc-url $(BASE_SEPOLIA_RPC_URL)

deploy-all-testnets:
	@echo "=== [1/3] Sepolia ==="
	forge script script/Deploy.s.sol:Deploy \
		--rpc-url $(SEPOLIA_RPC_URL) --broadcast --private-key $(PRIVATE_KEY)
	node scripts/sync-dapp.mjs
	@echo "=== [2/3] Base Sepolia ==="
	forge script script/Deploy.s.sol:Deploy \
		--rpc-url $(BASE_SEPOLIA_RPC_URL) --broadcast --private-key $(PRIVATE_KEY)
	node scripts/sync-dapp.mjs
	@echo "=== [3/3] Local (Anvil) — checking localhost:8545 ==="
	@if nc -z localhost 8545 2>/dev/null; then \
		forge script script/Deploy.s.sol:Deploy --fork-url http://localhost:8545 --broadcast && \
		node scripts/sync-dapp.mjs; \
	else \
		echo "  No Anvil node detected — skipping local deploy"; \
	fi
	@echo "=== All testnet deploys complete ==="

# ─── Upgrade (Sepolia) ────────────────────────────────────────────────────────
# Usage: make upgrade-sepolia
# Auto-detects changed contracts by comparing on-chain bytecode vs local artifacts.
# Only upgrades contracts whose bytecode has changed — skips everything else.
# Requires MULTISIG_PRIVATE_KEY in .env (private key for MULTISIG_ADDRESS)
#
# Proxy env vars are read automatically from script/output/deployed-addresses.txt
PROXY_ENVS = \
  TREASURY_PROXY=$(shell grep '^Treasury:' script/output/deployed-addresses.txt | cut -d: -f2) \
  TIMELOCK_PROXY=$(shell grep '^TimeLock:' script/output/deployed-addresses.txt | cut -d: -f2) \
  WLF_PROXY=$(shell grep '^WerewolfToken:' script/output/deployed-addresses.txt | cut -d: -f2) \
  STAKING_PROXY=$(shell grep '^Staking:' script/output/deployed-addresses.txt | cut -d: -f2) \
  LP_STAKING_PROXY=$(shell grep '^LPStaking:' script/output/deployed-addresses.txt | cut -d: -f2) \
  DAO_PROXY=$(shell grep '^DAO:' script/output/deployed-addresses.txt | cut -d: -f2) \
  TOKEN_SALE_PROXY=$(shell grep '^TokenSale:' script/output/deployed-addresses.txt | cut -d: -f2) \
  COMPANIES_HOUSE_PROXY=$(shell grep '^CompaniesHouse:' script/output/deployed-addresses.txt | cut -d: -f2)

upgrade-sepolia-dry:
	$(PROXY_ENVS) forge script script/Upgrade.s.sol:Upgrade --rpc-url $(SEPOLIA_RPC_URL)

upgrade-sepolia:
	$(PROXY_ENVS) forge script script/Upgrade.s.sol:Upgrade \
		--rpc-url $(SEPOLIA_RPC_URL) --broadcast \
		--private-key $(MULTISIG_PRIVATE_KEY)
	node scripts/sync-dapp.mjs
	$(PROXY_ENVS) forge script script/Upgrade.s.sol:Upgrade \
		--rpc-url $(SEPOLIA_RPC_URL) \
		--verify --etherscan-api-key $(ETHERSCAN_API_KEY) \
		--resume --private-key $(MULTISIG_PRIVATE_KEY)

# ─── Upgradability PoC (Sepolia) ─────────────────────────────────────────────
# Step 2: Create 3 staking positions (establishes on-chain state before upgrade)
#   Deployer must hold ≥ 600 WLF (received from WerewolfTokenV1.initialize at deploy)
stake-sepolia:
	$(PROXY_ENVS) forge script script/InteractStaking.s.sol:InteractStaking \
		--rpc-url $(SEPOLIA_RPC_URL) --broadcast \
		--private-key $(PRIVATE_KEY)

# Step 5: Verify state survived upgrade and version() returns "2.0.0"
#   Run AFTER make upgrade-sepolia
verify-upgrade-sepolia:
	$(PROXY_ENVS) forge script script/VerifyUpgrade.s.sol:VerifyUpgrade \
		--rpc-url $(SEPOLIA_RPC_URL) \
		--private-key $(PRIVATE_KEY)

# ─── Test Proposal: Start Sale #1 (Sepolia) ──────────────────────────────────
# Set env vars from script/output/deployed-addresses.txt before running:
#   export DAO_ADDRESS=0x... WEREWOLF_TOKEN_ADDRESS=0x... TOKEN_SALE_ADDRESS=0x...
# For approve/queue/execute also set: export PROPOSAL_ID=0

propose-sepolia:
	STEP=create forge script script/TestProposal_StartSale1.s.sol:TestProposalStartSale1 \
		--rpc-url $(SEPOLIA_RPC_URL) --broadcast --private-key $(PRIVATE_KEY)

approve-proposal-sepolia:
	STEP=approve forge script script/TestProposal_StartSale1.s.sol:TestProposalStartSale1 \
		--rpc-url $(SEPOLIA_RPC_URL) --broadcast --private-key $(PRIVATE_KEY)

queue-proposal-sepolia:
	STEP=queue forge script script/TestProposal_StartSale1.s.sol:TestProposalStartSale1 \
		--rpc-url $(SEPOLIA_RPC_URL) --broadcast --private-key $(PRIVATE_KEY)

execute-proposal-sepolia:
	STEP=execute forge script script/TestProposal_StartSale1.s.sol:TestProposalStartSale1 \
		--rpc-url $(SEPOLIA_RPC_URL) --broadcast --private-key $(PRIVATE_KEY)

# ─── Mainnet ──────────────────────────────────────────────────────────────────
# Requires MAINNET_RPC_URL, PRIVATE_KEY, MULTISIG_ADDRESS, ETHERSCAN_API_KEY in .env

deploy-mainnet-dry:
	forge script script/Deploy.s.sol:Deploy --rpc-url $(MAINNET_RPC_URL)

deploy-mainnet:
	@echo "⚠️  MAINNET DEPLOYMENT — double-check .env before proceeding"
	forge script script/Deploy.s.sol:Deploy \
		--rpc-url $(MAINNET_RPC_URL) --broadcast \
		--private-key $(PRIVATE_KEY)
	node scripts/sync-dapp.mjs
	forge script script/Deploy.s.sol:Deploy \
		--rpc-url $(MAINNET_RPC_URL) \
		--verify --etherscan-api-key $(ETHERSCAN_API_KEY) \
		--resume --private-key $(PRIVATE_KEY)

upgrade-mainnet-dry:
	$(PROXY_ENVS) forge script script/Upgrade.s.sol:Upgrade --rpc-url $(MAINNET_RPC_URL)

upgrade-mainnet:
	@echo "⚠️  MAINNET UPGRADE — double-check .env before proceeding"
	$(PROXY_ENVS) forge script script/Upgrade.s.sol:Upgrade \
		--rpc-url $(MAINNET_RPC_URL) --broadcast \
		--private-key $(MULTISIG_PRIVATE_KEY)
	node scripts/sync-dapp.mjs
	$(PROXY_ENVS) forge script script/Upgrade.s.sol:Upgrade \
		--rpc-url $(MAINNET_RPC_URL) \
		--verify --etherscan-api-key $(ETHERSCAN_API_KEY) \
		--resume --private-key $(MULTISIG_PRIVATE_KEY)

# ─── Debug / Diagnose ─────────────────────────────────────────────────────────
# Run with: make fork-debug
# Shows full trace of endSale() against live Sepolia state; use -vvvv to see reverts.
fork-debug:
	forge test --match-path test/ForkDebug.t.sol --fork-url $(SEPOLIA_RPC_URL) -vvvv

# Quick cast state inspection — requires TOKEN_SALE_ADDRESS to be set in .env
cast-debug:
	@TOKEN_SALE=$(shell grep '^TokenSale:' script/output/deployed-addresses.txt | cut -d: -f2); \
	LP_STAKING=$(shell grep '^LPStaking:' script/output/deployed-addresses.txt | cut -d: -f2); \
	WLF=$(shell grep '^WerewolfToken:' script/output/deployed-addresses.txt | cut -d: -f2); \
	USDT_ADDR=$(shell grep '^USDT:' script/output/deployed-addresses.txt | cut -d: -f2); \
	echo "=== TokenSale: $$TOKEN_SALE ==="; \
	echo -n "saleActive:      "; cast call $$TOKEN_SALE "saleActive()" --rpc-url $(SEPOLIA_RPC_URL); \
	echo -n "saleIdCounter:   "; cast call $$TOKEN_SALE "saleIdCounter()" --rpc-url $(SEPOLIA_RPC_URL); \
	echo -n "wlfCollected[0]: "; cast call $$TOKEN_SALE "saleWLFCollected(uint256)" 0 --rpc-url $(SEPOLIA_RPC_URL); \
	echo -n "usdtCollected[0]:"; cast call $$TOKEN_SALE "saleUSDTCollected(uint256)" 0 --rpc-url $(SEPOLIA_RPC_URL); \
	echo -n "lpCreated[0]:    "; cast call $$TOKEN_SALE "saleLPCreated(uint256)" 0 --rpc-url $(SEPOLIA_RPC_URL); \
	echo -n "tickLower:       "; cast call $$TOKEN_SALE "tickLower()" --rpc-url $(SEPOLIA_RPC_URL); \
	echo -n "tickUpper:       "; cast call $$TOKEN_SALE "tickUpper()" --rpc-url $(SEPOLIA_RPC_URL); \
	echo -n "owner:           "; cast call $$TOKEN_SALE "owner()" --rpc-url $(SEPOLIA_RPC_URL); \
	echo -n "WLF balance:     "; cast call $$WLF "balanceOf(address)" $$TOKEN_SALE --rpc-url $(SEPOLIA_RPC_URL); \
	echo -n "USDT balance:    "; cast call $$USDT_ADDR "balanceOf(address)" $$TOKEN_SALE --rpc-url $(SEPOLIA_RPC_URL); \
	echo -n "LPStaking.tokenSaleContract: "; cast call $$LP_STAKING "tokenSaleContract()" --rpc-url $(SEPOLIA_RPC_URL); \
	echo "=== Simulating endSale() ==="; \
	cast call $$TOKEN_SALE "endSale()" --rpc-url $(SEPOLIA_RPC_URL) && echo "SUCCESS" || echo "REVERTED (see above)"

# ─── Dapp ─────────────────────────────────────────────────────────────────────

sync-dapp:
	node scripts/sync-dapp.mjs

sync-whitepaper:
	cp white-paper.md dapp/public/whitepaper.md

# ─── Utils ────────────────────────────────────────────────────────────────────

create-interfaces:
	cast interface ./out/Counter.sol/Counter.json -n ICounter -o ./src/interfaces/ICounter.sol; \
	cast interface ./out/Timelock.sol/Timelock.json -n ITimelock -o ./src/interfaces/ITimelock.sol; \
	cast interface ./out/CompaniesHouseV1.sol/CompaniesHouseV1.json -n ICompaniesHouseV1 -o ./src/interfaces/CompaniesHouseV1.sol; \
	cast interface ./out/CounterHook.sol/CounterHook.json -n ICounterHook -o ./src/interfaces/ICounterHook.sol; \
	cast interface ./out/DAO.sol/DAO.json -n IDAO -o ./src/interfaces/IDAO.sol; \
	cast interface ./out/Staking.sol/Staking.json -n IStaking -o ./src/interfaces/IStaking.sol; \
	cast interface ./out/TokenSale.sol/TokenSale.json -n ITokenSale -o ./src/interfaces/ITokenSale.sol; \
	cast interface ./out/Treasury.sol/Treasury.json -n ITreasury -o ./src/interfaces/ITreasury.sol; \
	cast interface ./out/UniswapHelper.sol/UniswapHelper.json -n IUniswapHelper -o ./src/interfaces/IUniswapHelper.sol; \
	cast interface ./out/WerewolfTokenV1.sol/WerewolfTokenV1.json -n IWerewolfTokenV1 -o ./src/interfaces/IWerewolfTokenV1.sol
