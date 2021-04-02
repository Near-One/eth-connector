.PHONY: compile test

NETWORK=ropsten
VERSION=v01
NEAR_EVM_ACCOUNT=${VERSION}.kconnector.testnet
NEAR_ACCOUNT=
RPC_ENDPOINT=https://rpc.testnet.near.org
ETH_RECIPIENT=
AMOUNT=
FEE=
PROOF=
TX_HASH=

NEAR_RECIPIENT=${NEAR_ACCOUNT}

compile:
	yarn hardhat compile

test:
	yarn hardhat test

eth-get-prover-address:
	yarn hardhat run --network ${NETWORK} scripts/eth_get_prover_address.js

eth-deploy-contracts:
	yarn hardhat run --network ${NETWORK} scripts/eth_deploy_contracts.js

eth-deposit-to-near:
	yarn hardhat --network ${NETWORK} eth-deposit-to-near --near-recipient ${NEAR_RECIPIENT} --amount ${AMOUNT} --fee ${FEE}

eth-withdraw:
	yarn hardhat run --network ${NETWORK} scripts/eth_withdraw.js

eth-generate-deposit-proof:
	mkdir -p build/proofs && yarn hardhat --network ${NETWORK} eth-generate-deposit-proof --tx-hash ${TX_HASH}

eth-finalise-deposit-to-near:
	yarn hardhat --network ${NETWORK} eth-finalise-deposit-to-near --tx-hash ${TX_HASH} --near-account ${NEAR_ACCOUNT}

near-get-balance-of:
	near view ${NEAR_EVM_ACCOUNT} ft_balance_of --account-id ${NEAR_ACCOUNT} '{ "account_id": "${NEAR_ACCOUNT}" }'

near-withdraw-from:
	near call ${NEAR_EVM_ACCOUNT} withdraw --account-id ${NEAR_ACCOUNT} \
		'{ "recipient_id": "${ETH_RECIPIENT}", "amount": "${AMOUNT}" }'

near-get-tx-status:
	/usr/bin/http post ${RPC_ENDPOINT} jsonrpc=2.0 method=EXPERIMENTAL_tx_status \
		params:='["${TX_HASH}", "${NEAR_ACCOUNT}"]' id=dontcare

near-deposit:
	near call ${NEAR_EVM_ACCOUNT} deposit --account-id ${NEAR_ACCOUNT} --gas 300000000000000 '{"proof": ${PROOF}}'

near-deposit-to-nostd:
	near call ${NEAR_EVM_ACCOUNT} deposit '${PROOF}' --account-id ${NEAR_ACCOUNT} --gas 300000000000000

near-withdraw-from-nostd:
	near call ${NEAR_EVM_ACCOUNT} withdraw --account-id ${NEAR_ACCOUNT} \
		'{ "recipient_id": "${ETH_RECIPIENT}", "amount": ${AMOUNT} }'
