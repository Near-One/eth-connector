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
2. Update `ethereum-config.json` with the actual data on the addresses, transfer amount and fee.
3. Create `.env` file inside `eth-custodian` directory: `$ touch .env`.
4. Add to the file your Alchemy API key:
`$ echo "ALCHEMY_API_KEY=YOUR_ALCHEMY_API_KEY_HERE" >> .env`
RPC access can be easily gained from [Alchemy](https://www.alchemyapi.io/).
5. Add to the file Ropsten Private key:
`$ echo "ROPSTEN_PRIVATE_KEY=YOUR_ROPSTEN_PRIVATE_KEY_HERE" >> .env`
6. Add path to the Near credentials (e.g. this usually will be at `~/.near-credentials` on Linux and
   `/Users/<user>/.near-credentials` on MacOS:
`$ echo "NEAR_KEY_STORE_PATH=PATH_TO_YOUR_NEAR_CREDENTIALS_HERE" >> .env`

## Ethereum -> Near transfer (ETH -> bridgedETH (NEP-141))
1. Go to _eth-custodian_ directory: `$ cd eth-custodian`.
2. **Transfer ETH to EthCustodian**. Send `depositToNear` transaction to EthCustodian contract. This step will use
previously configured `ethereum-config.json` file as args to withdraw `amountToTransfer` (wei) from your account and
deposit `amountToTransfer` (wei) having `fee` (wei) to `nearRecipient` account on Near. To run: `$ make eth-deposit`.
3. **Finalise deposit to Near**. Call deposit in Near blockchain to finalise the deposit transaction with the given
   `txHash`. You can find `txHash` in the output of the previous step. Then execute the following command:
`$ make eth-finalise-deposit-to-near TX_HASH=YOUR_TX_HASH_HERE`


## Near -> Ethereum transfer (bridgedETH -> ETH)
1. Go to _eth-custodian_ directory: `$ cd eth-custodian`.


## Ethereum -> Near transfer (ETH -> nETH (native ETH in Near-EVM))
WIP

## Near -> Ethereum transfer (nETH -> ETH)
WIP
