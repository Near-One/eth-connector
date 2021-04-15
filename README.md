# ETH connector for Rainbow bridge

## Definitions
`bridgedETH` - NEP-141 fungible-token representation of ETH inside Near.

`nETH` - native ETH inside Near EVM.

## Deployments

| Version | Description            | Status      | Ethereum Connector Address                 | NEAR Connector Account |
|---------|------------------------|-------------|--------------------------------------------|------------------------|
|   v0.1  | NEAR testnet - Ropsten | [Working](https://explorer.testnet.near.org/accounts/v01.kconnector.testnet)   | 0xE3eBE85E0c42cC59cF09a1367d2CA30B26639659 | v01.kconnector.testnet |
| no-std  | NEAR testnet - Ropsten | [Working](https://explorer.testnet.near.org/accounts/nostd-v01.kconnector.testnet)   | 0x88657f6D4c4bbDB193C2b0B78DD74cD38479f819 | nostd-v01.kconnector.testnet |

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
1. Copy `test-ethereum-config.json` to `ethereum-config.json` with `$ cp eth-custodian/scripts/json/test-ethereum-config.json eth-custodian/scripts/json/ethereum-config.json`.

2. Update `ethereum-config.json` with the actual data on the addresses.

3. Create `.env` file inside `eth-custodian` directory: `$ touch .env`.

4. Add to the file your Alchemy API key:
`$ echo "ALCHEMY_API_KEY=YOUR_ALCHEMY_API_KEY_HERE" >> .env` <br/>
RPC access can be easily gained from [Alchemy](https://www.alchemyapi.io/).

5. Add to the file Ropsten Private key:
`$ echo "ROPSTEN_PRIVATE_KEY=YOUR_ROPSTEN_PRIVATE_KEY_HERE" >> .env`

6. Add path to the Near credentials (e.g. this usually will be at `~/.near-credentials` on Linux <br/>
and `/Users/<user>/.near-credentials` on MacOS: <br/>
`$ echo "NEAR_KEY_STORE_PATH=PATH_TO_YOUR_NEAR_CREDENTIALS_HERE" >> .env`

## Ethereum -> Near transfer (ETH -> bridgedETH (NEP-141))
1. Go to _eth-custodian_ directory: `$ cd eth-custodian`.

2. **Transfer ETH to EthCustodian**.
Send `depositToNear` transaction to EthCustodian contract.  This will transfer `AMOUNT` (wei) from your account
and deposit `AMOUNT` (wei) having `FEE` (wei) to `NEAR_RECIPIENT` account on Near. <br/>
Run: `$ make eth-deposit-to-near NEAR_RECIPIENT=<ACCOUNT_ID_OF_RECIPIENT_HERE> AMOUNT=<DEPOSIT_AMOUNT_HERE> FEE=<DEPOSIT_FEE_HERE>`.

3. **Wait sufficiently long**
You need to wait for 30 confirmations for Ropsten blockchain. This is needed to achieve finality of Ropsten block, including locking transaction.
The status of syncing of the bridge can be observed [here](http://35.235.76.186:8002/metrics).
First metric (`near_bridge_eth2near_client_block_number`) should become more than the height of a block with transaction from the step 2 at least by 30,
for successfull finalisation of the transfer.

4. **Finalise deposit to Near**
Call deposit in Near blockchain to finalise the deposit transaction with the given `TX_HASH`. You can find `TX_HASH` in the output of the previous step.
You will need to provide your `NEAR_ACCOUNT` AccountId which will be used to relay the ETH proof to the Near blockchain to mint appropriate amount of
bridgedETH for the `NEAR_RECIPIENT` (this parameter is optional here and only serves for verbose purposes to show the balance of the recipient before and after) <br/>
Run: `$ make eth-finalise-deposit-to-near TX_HASH=<DEPOSIT_TX_HASH_HERE> NEAR_ACCOUNT=<YOUR_NEAR_ACCOUNT_HERE> NEAR_RECIPIENT=<RECIPIENT_HERE>`

## Near -> Ethereum transfer (bridgedETH -> ETH)
1. Go to _eth-custodian_ directory: `$ cd eth-custodian`.

2. **Begin withdraw**
Send a `withdraw` transaction to the bridgedETH contract to withdraw `AMOUNT` bridgedETH (wei) from the `NEAR_ACCOUNT` and
transfer the appropriate amount of ETH (wei) to `ETH_RECIPIENT` (Specify without '0x' prefix).
During the execution, the contract will issue an execution outcome, which would be used during finalisation step to contruct the proof for the EthCustodian in Ethereum. <br/>
Run: `$ make near-withdraw-to-eth NEAR_ACCOUNT=<YOUR_NEAR_ACCOUNT_HERE> ETH_RECIPIENT=<ETH_ADDRESS_OF_RECIPIENT_HERE> AMOUNT=<WITHDRAW_AMOUNT_HERE>` FEE=<WITHDRAW_FEE_HERE>

3. **Wait sufficiently long**
This approximately takes 10 minutes for the Ropsten bridge deployment.
This is needed to relay NEAR block with the height higher than the block with transaction from previous step to Ethereum, plus wait a challenge period.
The status of syncing of the bridge can be observed [here](http://35.235.76.186:8001/metrics).
First metric `near_bridge_near2eth_client_height` should become higher than the block height displayed in console during the previous step.
4. **Finalise withdraw to Eth**
Call withdraw in Near blockchain to finalise the deposit transaction with the given `TX_HASH`. You can find `TX_HASH` in the output of the previous step.
Send a `withdraw` transaction to the EthCustodian contract. After bridge syncing we are able to prove the fact of withdrawal transaction on NEAR to the EthCustodian contract. <br/>
Run: `$ make near-finalise-withdraw-to-eth TX_HASH=<WITHDRAW_TX_HASH_HERE>`

## Ethereum -> Near transfer (ETH -> nETH (native ETH in Near-EVM))
WIP

## Near -> Ethereum transfer (nETH -> ETH)
WIP
