.PHONY: compile test

NETWORK=ropsten

compile:
	yarn hardhat compile

test:
	yarn hardhat test

get-prover-address:
	yarn hardhat run --network ${NETWORK} scripts/get_prover_address.js

deploy-contracts:
	yarn hardhat run --network ${NETWORK} scripts/deploy_contracts.js

call-deposit:
	yarn hardhat run --network ${NETWORK} scripts/call_deposit.js
