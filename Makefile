include .env

deploy-local-dry:
	forge script script/DEploy.s.sol:Deploy --fork-url http://localhost:8545
deploy-local:
	forge script script/DEploy.s.sol:Deploy --fork-url http://localhost:8545 --broadcast