include .env

deploy-local-dry:
	forge script script/DEploy.s.sol:Deploy --fork-url http://localhost:8545
deploy-local:
	forge script script/DEploy.s.sol:Deploy --fork-url http://localhost:8545 --broadcast

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
