.PHONY: compile test

NETWORK=ropsten
#VERSION=v01
VERSION=nostd-v01
NEAR_EVM_ACCOUNT=${VERSION}.kconnector.testnet
NEAR_ACCOUNT=testlocal.testnet
RPC_ENDPOINT=https://rpc.testnet.near.org
ETH_RECIPIENT=
AMOUNT_TO_TRANSFER=5000
PROOF=
TX_HASH=0xcda073d8a97e9bdcdee2ddc640d59942602f9a3a03bcd42783e1619776262774

compile:
	yarn hardhat compile

test:
	yarn hardhat test

eth-get-prover-address:
	yarn hardhat run --network ${NETWORK} scripts/eth_get_prover_address.js

eth-deploy-contracts:
	yarn hardhat run --network ${NETWORK} scripts/eth_deploy_contracts.js

eth-deposit:
	yarn hardhat run --network ${NETWORK} scripts/eth_deposit.js

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
		'{ "recipient_id": "${ETH_RECIPIENT}", "amount": "${AMOUNT_TO_TRANSFER}" }'

near-get-tx-status:
	/usr/bin/http post ${RPC_ENDPOINT} jsonrpc=2.0 method=EXPERIMENTAL_tx_status \
		params:='["${TX_HASH}", "${NEAR_ACCOUNT}"]' id=dontcare

near-deposit:
	near call ${NEAR_EVM_ACCOUNT} deposit --account-id ${NEAR_ACCOUNT} --gas 300000000000000 '{"proof": ${PROOF}}'

near-deposit-to-nostd:
	near call ${NEAR_EVM_ACCOUNT} deposit '${PROOF}' --account-id ${NEAR_ACCOUNT} --gas 300000000000000

