.PHONY: compile test

NETWORK=ropsten
VERSION=v2
PROOF=
NEAR_EVM_ACCOUNT=${VERSION}.eth-connector.testnet
NEAR_ACCOUNT=
RPC_ENDPOINT=https://rpc.testnet.near.org
ETH_RECIPIENT=
AMOUNT_TO_TRANSFER=100
TX_HASH=

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
	near view ${NEAR_EVM_ACCOUNT} ft_balance_of --account-id ${NEAR_ACCOUNT} '{ "account_id": "${NEAR_ACCOUNT}" }'

near-withdraw-from:
	near call ${NEAR_EVM_ACCOUNT} withdraw --account-id ${NEAR_ACCOUNT} \
		'{ "recipient_id": "${ETH_RECIPIENT}", "amount": "${AMOUNT_TO_TRANSFER}" }'

near-get-tx-status:
	/usr/bin/http post ${RPC_ENDPOINT} jsonrpc=2.0 method=EXPERIMENTAL_tx_status \
		params:='["${TX_HASH}", "${NEAR_ACCOUNT}"]' id=dontcare

near-deposit:
	near call ${NEAR_EVM_ACCOUNT} deposit --account-id ${NEAR_ACCOUNT} --gas 300000000000000 '{"proof": ${PROOF}}'

