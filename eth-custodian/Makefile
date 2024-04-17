.PHONY: compile test

NETWORK=ropsten
NEAR_NETWORK=testnet
NEAR_EVM_ACCOUNT=aurora
NEAR_ACCOUNT=
QUERY_NEAR_ACCOUNT=${NEAR_ACCOUNT}
NEAR_JSON_RPC_MAINNET=https://archival-rpc.mainnet.near.org/
NEAR_JSON_RPC_TESTNET=https://rpc.testnet.near.org
NEAR_JSON_RPC=${NEAR_JSON_RPC_TESTNET}
ETH_RECIPIENT=
ETH_ADDRESS=
AMOUNT=0
FEE=0
PROOF=
TX_HASH=
RECEIPT_ID=
RELAYER_NEAR_ADDRESS=
RELAYER_ADDRESS_IN_AURORA=

ERC20_TOKEN_ADDRESS=
AURORA_ERC20_TOKEN_ADDRESS=
ERC20_NAME=
ERC20_SYMBOL=
ERC20_DECIMALS=

NEAR_RECIPIENT=${NEAR_ACCOUNT}

compile:
	mkdir -p build/proofs && yarn hardhat compile

test:
	yarn hardhat test

eth-get-prover-address:
	yarn hardhat run --network ${NETWORK} scripts/eth_get_prover_address.js

eth-deploy-contracts:
	yarn hardhat run --network ${NETWORK} scripts/eth_deploy_contracts.js

eth-deploy-proxy:
	yarn hardhat run --network ${NETWORK} scripts/eth_deploy_proxy.js

eth-deposit-to-near:
	yarn hardhat --network ${NETWORK} eth-deposit-to-near --near-recipient ${NEAR_RECIPIENT} --amount ${AMOUNT} --fee ${FEE}

eth-deposit-to-evm:
	yarn hardhat --network ${NETWORK} eth-deposit-to-evm --eth-recipient-on-near ${ETH_RECIPIENT} --amount ${AMOUNT} --fee ${FEE}

eth-withdraw:
	yarn hardhat run --network ${NETWORK} scripts/eth_withdraw.js

eth-generate-deposit-proof:
	mkdir -p build/proofs && yarn hardhat --network ${NETWORK} eth-generate-deposit-proof --tx-hash ${TX_HASH}

eth-finalize-withdraw-from-near:
	yarn hardhat --network ${NETWORK} eth-finalize-withdraw-from-near --receipt-id ${RECEIPT_ID} --near-account ${NEAR_ACCOUNT}

eth-get-erc20-metadata:
	yarn hardhat --network ${NETWORK} eth-get-erc20-metadata --address ${ERC20_TOKEN_ADDRESS}

near-finalize-deposit-from-eth:
	yarn hardhat --network ${NETWORK} near-finalize-deposit-from-eth --tx-hash ${TX_HASH} --near-account ${NEAR_ACCOUNT} --near-recipient ${NEAR_RECIPIENT} --deposited-to-near true --near-network ${NEAR_NETWORK} --near-json-rpc ${NEAR_JSON_RPC}

near-finalize-deposit-from-eth-to-evm:
	yarn hardhat --network ${NETWORK} near-finalize-deposit-from-eth --tx-hash ${TX_HASH} --near-account ${NEAR_ACCOUNT} --eth-recipient ${ETH_RECIPIENT} --near-network ${NEAR_NETWORK} --near-json-rpc ${NEAR_JSON_RPC}

near-ft-balance-of:
	yarn hardhat near-ft-balance-of --near-network ${NEAR_NETWORK} --near-json-rpc ${NEAR_JSON_RPC} --near-account ${NEAR_ACCOUNT} --query-near-account ${QUERY_NEAR_ACCOUNT}

near-ft-balance-of-eth:
	yarn hardhat near-ft-balance-of-eth --near-network ${NEAR_NETWORK} --near-json-rpc ${NEAR_JSON_RPC} --near-account ${NEAR_ACCOUNT} --eth-address ${ETH_ADDRESS}

near-withdraw-bridged-eth:
	yarn hardhat --network ${NETWORK} near-withdraw-bridged-eth \
		--near-account ${NEAR_ACCOUNT} --eth-recipient ${ETH_RECIPIENT} --amount ${AMOUNT} --fee ${FEE}

near-check-proof-exists:
	yarn hardhat --network ${NETWORK} near-check-proof-exists \
		--near-account ${NEAR_ACCOUNT} --tx-hash ${TX_HASH}

near-set-paused-flags:
	yarn hardhat --network ${NETWORK} near-set-paused-flags \
		--near-account ${NEAR_ACCOUNT} --paused-flags 0

near-get-tx-status:
	/usr/bin/http post ${NEAR_JSON_RPC} jsonrpc=2.0 method=EXPERIMENTAL_tx_status \
		params:='["${TX_HASH}", "${NEAR_ACCOUNT}"]' id=dontcare

_near-deposit:
	near call ${NEAR_EVM_ACCOUNT} deposit --account-id ${NEAR_ACCOUNT} --gas 300000000000000 '{"proof": ${PROOF}}'

_near-deposit-to-nostd:
	near call ${NEAR_EVM_ACCOUNT} deposit '${PROOF}' --account-id ${NEAR_ACCOUNT} --gas 300000000000000

_near-call-withdraw-from:
	near call ${NEAR_EVM_ACCOUNT} withdraw --account-id ${NEAR_ACCOUNT} \
		'{ "recipient_id": "${ETH_RECIPIENT}", "amount": "${AMOUNT}" }'

_near-call-withdraw-from-nostd:
	near call ${NEAR_EVM_ACCOUNT} withdraw --account-id ${NEAR_ACCOUNT} \
		'{ "recipient_id": "${ETH_RECIPIENT}", "amount": ${AMOUNT} }'

aurora-init-eth-connector:
	yarn hardhat aurora-init-eth-connector --near-account ${NEAR_ACCOUNT} --near-network ${NEAR_NETWORK} --near-json-rpc ${NEAR_JSON_RPC}

aurora-register-relayer:
	yarn hardhat aurora-register-relayer --near-account ${RELAYER_NEAR_ADDRESS} --relayer-address-in-aurora ${RELAYER_ADDRESS_IN_AURORA}

aurora-make-it-rain:
	yarn hardhat aurora-make-it-rain --near-account ${RELAYER_NEAR_ADDRESS} --rain-receiver-address ${ETH_RECIPIENT}

aurora-deploy-erc20-token:
	yarn hardhat aurora-deploy-erc20-token --near-account ${NEAR_ACCOUNT} --near-network ${NEAR_NETWORK} --near-json-rpc ${NEAR_JSON_RPC} --token-account-id ${ERC20_TOKEN_ADDRESS}

aurora-get-erc20-from-nep141:
	yarn hardhat aurora-get-erc20-from-nep141 --near-account ${NEAR_ACCOUNT} --near-network ${NEAR_NETWORK} --near-json-rpc ${NEAR_JSON_RPC} --token-account-id ${ERC20_TOKEN_ADDRESS}

aurora-get-nep141-from-erc20:
	yarn hardhat aurora-get-nep141-from-erc20 --near-account ${NEAR_ACCOUNT} --near-network ${NEAR_NETWORK} --near-json-rpc ${NEAR_JSON_RPC} --erc20-token-address-in-aurora ${AURORA_ERC20_TOKEN_ADDRESS}

aurora-set-erc20-metadata:
	yarn hardhat aurora-set-erc20-metadata --near-account ${NEAR_ACCOUNT} --near-network ${NEAR_NETWORK} --near-json-rpc ${NEAR_JSON_RPC} --erc20-token-address-in-aurora ${AURORA_ERC20_TOKEN_ADDRESS} --name ${ERC20_NAME} --symbol ${ERC20_SYMBOL} --decimals ${ERC20_DECIMALS}

aurora-bridge-erc20-token-and-metadata:
	yarn hardhat aurora-bridge-erc20-token-and-metadata --network ${NETWORK} --near-account ${NEAR_ACCOUNT} --near-network ${NEAR_NETWORK} --near-json-rpc ${NEAR_JSON_RPC} --erc20-token-address-in-ethereum ${ERC20_TOKEN_ADDRESS}
