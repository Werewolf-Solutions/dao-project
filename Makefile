include .env

# ─── Local (Anvil on localhost:8545) ──────────────────────────────────────────

deploy-local-dry:
	forge script script/Deploy.s.sol:Deploy --fork-url http://localhost:8545

deploy-local:
	forge script script/Deploy.s.sol:Deploy --fork-url http://localhost:8545 --broadcast && node scripts/sync-dapp.mjs

# Run after advancing Anvil time past the timelock delay:
#   cast rpc evm_increaseTime 172860 && cast rpc evm_mine 1
# Set env vars from script/output/deployed-addresses.txt before running:
#   export TIMELOCK_ADDRESS=0x... DAO_ADDRESS=0x... ADMIN_ETA=...
accept-admin-local:
	forge script script/AcceptTimelockAdmin.s.sol:AcceptTimelockAdmin \
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

# Run 2 days after deploy-sepolia.
# Set env vars from script/output/deployed-addresses.txt before running:
#   export TIMELOCK_ADDRESS=0x... DAO_ADDRESS=0x... ADMIN_ETA=...
accept-admin-sepolia:
	forge script script/AcceptTimelockAdmin.s.sol:AcceptTimelockAdmin \
		--rpc-url $(SEPOLIA_RPC_URL) --broadcast

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
