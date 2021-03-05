.PHONY: compile test

NETWORK=ropsten
NEAR_EVM_ACCOUNT=v1.eth-connector.testnet
NEAR_ACCOUNT=testlocal.testnet
ETH_RECIPIENT=891B2749238B27fF58e951088e55b04de71Dc374
AMOUNT_TO_TRANSFER=400

compile:
	yarn hardhat compile

test:
	yarn hardhat test

eth-get-prover-address:
	yarn hardhat run --network ${NETWORK} scripts/get_prover_address.js

eth-deploy-contracts:
	yarn hardhat run --network ${NETWORK} scripts/deploy_contracts.js

eth-call-deposit:
	yarn hardhat run --network ${NETWORK} scripts/call_deposit.js

eth-call-withdraw:
	yarn hardhat run --network ${NETWORK} scripts/call_withdraw.js

near-get-balance-of:
	near call ${NEAR_EVM_ACCOUNT} ft_balance_of --account-id ${NEAR_ACCOUNT} '{ "account_id": "${NEAR_ACCOUNT}" }'

near-withdraw-from:
	near call ${NEAR_EVM_ACCOUNT} withdraw --account-id ${NEAR_ACCOUNT} \
		'{ "recipient_id": "${ETH_RECIPIENT}", "amount": "${AMOUNT_TO_TRANSFER}" }'
