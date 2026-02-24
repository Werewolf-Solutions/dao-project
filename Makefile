include .env

# ─── Local (Anvil on localhost:8545) ──────────────────────────────────────────

deploy-local-dry:
	forge script script/Deploy.s.sol:Deploy --fork-url http://localhost:8545

deploy-local:
	forge script script/Deploy.s.sol:Deploy --fork-url http://localhost:8545 --broadcast

# Run after advancing Anvil time past the timelock delay:
#   cast rpc evm_increaseTime 172800 && cast rpc evm_mine 1
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
		--rpc-url $(SEPOLIA_RPC_URL) --broadcast --verify

# Run 2 days after deploy-sepolia.
# Set env vars from script/output/deployed-addresses.txt before running:
#   export TIMELOCK_ADDRESS=0x... DAO_ADDRESS=0x... ADMIN_ETA=...
accept-admin-sepolia:
	forge script script/AcceptTimelockAdmin.s.sol:AcceptTimelockAdmin \
		--rpc-url $(SEPOLIA_RPC_URL) --broadcast

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
