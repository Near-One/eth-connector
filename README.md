# ETH connector for Rainbow bridge

## Definitions
`bridgedETH` - NEP-141 fungible-token representation of ETH inside Near.

`nETH` - native ETH inside Near EVM.

## Deployments

| Version        | Description            | Status      | Ethereum Connector Address                 | NEAR Connector Account |
|----------------|------------------------|-------------|--------------------------------------------|------------------------|
| develop.aurora | NEAR testnet - Ropsten | [Working](https://explorer.testnet.near.org/accounts/develop.aurora)   | 0x4a8FfD609122b80E1da0d95e51a31667804eA890 |          develop.aurora        |
|     aurora     | NEAR testnet - Ropsten | [Working](https://explorer.testnet.near.org/accounts/aurora)   | 0x9006a6D7d08A388Eeea0112cc1b6b6B15a4289AF |              aurora            |

# Step-by-step testing guide

## Pre-requisites

### Installation
1. Make sure you have installed npm.

2. Install NEAR CLI: `$ npm install -g near-cli`.

3. Install Yarn: `$ npm install --global yarn`.

4. Clone this repo, and run `$ cd eth-custodian` and `$ yarn install`.

5. Create an account in Metamask in Ropsten testnet.

6. Get some Ropsten ETH. For example using this faucet: https://faucet.ropsten.be/.

7. Create an account in NEAR TestNet: https://wallet.testnet.near.org/.

8. Make sure that you're working with the NEAR TestNet: `$ export NODE_ENV=testnet`.

9. Log in to the NEAR Wallet from the CLI: `$ near login`. The browser should pop up and a NEAR Wallet should ask for a permission for adding a full access key.

### Configuration
1. Go to _eth-custodian_ directory: `$ cd eth-custodian`.

2. (Optional) Update `scripts/json/ethereum-config.json` with the actual data on the addresses.

3. Create `.env` file inside `eth-custodian` directory: `$ touch .env`.

4. Add to the file your RPC endpoint (with or without API key):
`$ echo "WEB3_RPC_ENDPOINT=YOUR_WEB3_RPC_ENDPOINT_HERE" >> .env` <br/>
(Optional) RPC access can be easily gained from [Alchemy](https://www.alchemyapi.io/).

5. Add to the file Ropsten Private key:
`$ echo "ROPSTEN_PRIVATE_KEY=YOUR_ROPSTEN_PRIVATE_KEY_HERE" >> .env`

6. Add path to the Near credentials (e.g. this usually will be at `/home/<YOUR_USER_NAME>/.near-credentials` on Linux <br/>
and `$HOME/.near-credentials` on MacOS: <br/>
`$ echo "NEAR_KEY_STORE_PATH=PATH_TO_YOUR_NEAR_CREDENTIALS_HERE" >> .env`

7. Compile Ethereum contracts with: <br/>
`$ make compile`

## Utilities
To get the balance of bridgedETH (NEP-141):
`$ make near-ft-balance-of NEAR_ACCOUNT=<YOUR_NEAR_ACCOUNT_HERE>`

To get the balance of nETH (native ETH in Aurora-EVM):
`$ make near-ft-balance-of-eth NEAR_ACCOUNT=<YOUR_NEAR_ACCOUNT_HERE> ETH_ADDRESS=<ETH_ADDRESS_OF_ACCOUNT_IN_EVM_HERE>`

## Ethereum -> Near transfer (ETH -> nETH (NEP-141))
1. Go to _eth-custodian_ directory: `$ cd eth-custodian`.

2. **Transfer ETH to EthCustodian**.
Send `depositToNear` transaction to EthCustodian contract.  This will transfer `AMOUNT` (wei) from your account
and deposit `AMOUNT` (wei) having `FEE` (wei) to `NEAR_RECIPIENT` account on Near. <br/>
Run: `$ make eth-deposit-to-near NEAR_RECIPIENT=<ACCOUNT_ID_OF_RECIPIENT_HERE> AMOUNT=<DEPOSIT_AMOUNT_HERE> FEE=<DEPOSIT_FEE_HERE>`.

3. **Wait sufficiently long**
You need to wait for 3 confirmations for Ropsten blockchain. This is needed to achieve finality of Ropsten block, including locking transaction.
The status of syncing of the bridge can be observed [here](http://35.235.76.186:8002/metrics).
First metric (`near_bridge_eth2near_client_block_number`) should become more than the height of a block with transaction from the step 2 at least by 3,
for a successful finalization of the transfer.

4. **Finalize deposit to Near**
Call deposit in Near blockchain to finalize the deposit transaction with the given `TX_HASH`. You can find `TX_HASH` in the output of the previous step.
You will need to provide your `NEAR_ACCOUNT` AccountId which will be used to relay the ETH proof to the Near blockchain to mint appropriate amount of
bridgedETH for the `NEAR_RECIPIENT` (this parameter is optional here and only serves for verbose purposes to show the balance of the recipient before and after) <br/>
Run: `$ make near-finalize-deposit-from-eth TX_HASH=<DEPOSIT_TX_HASH_HERE> NEAR_ACCOUNT=<YOUR_NEAR_ACCOUNT_HERE> NEAR_RECIPIENT=<RECIPIENT_HERE>`

## Near -> Ethereum transfer (nETH -> ETH)
1. Go to _eth-custodian_ directory: `$ cd eth-custodian`.

2. **Begin withdraw**
Send a `withdraw` transaction to the bridgedETH contract to withdraw `AMOUNT` bridgedETH (wei) from the `NEAR_ACCOUNT` and
transfer the appropriate amount of ETH (wei) to `ETH_RECIPIENT` (Specify without '0x' prefix).
During the execution, the contract will issue an execution outcome, which would be used during finalization step to contruct the proof for the EthCustodian in Ethereum. <br/>
Run: `$ make near-withdraw-to-eth NEAR_ACCOUNT=<YOUR_NEAR_ACCOUNT_HERE> ETH_RECIPIENT=<ETH_ADDRESS_OF_RECIPIENT_HERE> AMOUNT=<WITHDRAW_AMOUNT_HERE> FEE=<WITHDRAW_FEE_HERE>`

3. **Wait sufficiently long**
This approximately takes 10 minutes for the Ropsten bridge deployment.
This is needed to relay NEAR block with the height higher than the block with transaction from previous step to Ethereum, plus wait a challenge period.
The status of syncing of the bridge can be observed [here](http://35.235.76.186:8001/metrics).
First metric `near_bridge_near2eth_client_height` should become higher than the block height displayed in console during the previous step.
4. **Finalize withdraw to Eth**
Call withdraw in Near blockchain to finalize the deposit transaction with the given `RECEIPT_ID`. You can find `RECEIPT_ID` in the output of the previous step.
Send a `withdraw` transaction to the EthCustodian contract. After bridge syncing we are able to prove the fact of withdrawal transaction on NEAR to the EthCustodian contract. <br/>
Run: `$ make eth-finalize-withdraw-from-near RECEIPT_ID=<RECEIPT_ID_FROM_STEP_2_HERE> NEAR_ACCOUNT=<YOUR_NEAR_ACCOUNT_HERE>`

## Ethereum -> Near transfer (ETH -> ETH (native ETH in Aurora-EVM))
1. Go to _eth-custodian_ directory: `$ cd eth-custodian`.

2. **Transfer ETH to EthCustodian**.
Send `depositToEVM` transaction to EthCustodian contract.  This will transfer `AMOUNT` (wei) from your account
and deposit `AMOUNT` (wei) having `FEE` (wei) to `NEAR_RECIPIENT` account on Near. <br/>
Run: `$ make eth-deposit-to-evm ETH_RECIPIENT=<ETH_ADDRESS_OF_RECIPIENT_IN_EVM_HERE> AMOUNT=<DEPOSIT_AMOUNT_HERE> FEE=<DEPOSIT_FEE_HERE>`.

3. **Wait sufficiently long**
You need to wait for 3 confirmations for Ropsten blockchain. This is needed to achieve finality of Ropsten block, including locking transaction.
The status of syncing of the bridge can be observed [here](http://35.235.76.186:8002/metrics).
First metric (`near_bridge_eth2near_client_block_number`) should become more than the height of a block with transaction from the step 2 at least by 3,
for a successful finalization of the transfer.

4. **Finalize deposit to Near**
Call deposit in Near blockchain to finalize the deposit transaction with the given `TX_HASH`. You can find `TX_HASH` in the output of the previous step.
You will need to provide your `NEAR_ACCOUNT` AccountId which will be used to relay the ETH proof to the Near blockchain to mint appropriate amount of
bridgedETH for the `NEAR_RECIPIENT` (this parameter is optional here and only serves for verbose purposes to show the balance of the recipient before and after) <br/>
Run: `$ make near-finalize-deposit-from-eth-to-evm TX_HASH=<DEPOSIT_TX_HASH_HERE> NEAR_ACCOUNT=<YOUR_NEAR_ACCOUNT_HERE> ETH_RECIPIENT=<ETH_RECIPIENT_HERE>`

## Near -> Ethereum transfer (ETH -> ETH)
WIP

## Advanced

### Contract deployment

To deploy the contract, you need at least _proverAddress_ and _nearEvmAccount_ addresses to be configured in
`ethereum-config.json` prior to the deployment.

After that call: <br />
`$ make eth-deploy-contracts`

As a result of the function call you will get the address of the freshly deployed `EthCustodian` that you can put in
your `ethereum-config.json` file in the `ethConnectorAddress` field.

After `ethConnectorAddress` is set, you can run

`$ make eth-deploy-proxy`

to deploy the proxy contract and make it the admin of `EthCustodian`.

### Other scripts

For more advanced usage, please examine the `hardhat.config.js` file which contains a lot of scripts that are performed
in this step-by-step guide via more simplified `make` commands. You can see the list of available tasks by running:
<br/>
`$ yarn hardhat`

To show help and required arguments on how to use the specific task from the task list, use the following command structure:
`$ yarn hardhat <TASK_NAME> --help` <br/>

e.g.:

`$ yarn hardhat eth-deposit-to-evm --help`
