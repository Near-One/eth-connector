/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require('dotenv').config();
require('@nomiclabs/hardhat-waffle');
require('hardhat-gas-reporter');

const WEB3_RPC_ENDPOINT = process.env.WEB3_RPC_ENDPOINT;
const ROPSTEN_PRIVATE_KEY = process.env.ROPSTEN_PRIVATE_KEY;

task('eth-deposit-to-near', 'Deposits the provided `amount` (wei) having `fee`(wei) to ETH Custodian to transfer it to Near')
    .addParam('nearRecipient', 'AccountID of recipient on Near')
    .addParam('amount', 'Amount (wei) to transfer', 0, types.int)
    .addParam('fee', 'Fee (wei) for the transfer', 0, types.int)
    .setAction(async taskArgs => {
        if (taskArgs.amount <= 0 || taskArgs.fee > taskArgs.amount) {
            throw new Error(
                'The amount to transfer should be greater than 0 and bigger than fee'
            );
        }
        const { ethDeposit } = require('./scripts/eth_deposit');
        const depositToNear = true;
        await ethDeposit(hre.ethers.provider, depositToNear, taskArgs.nearRecipient, taskArgs.amount, taskArgs.fee);
    });

task('eth-deposit-to-evm', 'Deposits the provided `amount` (wei) having `fee`(wei) to ETH Custodian to transfer it to Near EVM')
    .addParam('ethRecipientOnNear', 'AccountID of recipient on Near')
    .addParam('amount', 'Amount (wei) to transfer', 0, types.int)
    .addParam('fee', 'Fee (wei) for the transfer', 0, types.int)
    .setAction(async taskArgs => {
        if (taskArgs.amount <= 0 || taskArgs.fee > taskArgs.amount) {
            throw new Error(
                'The amount to transfer should be greater than 0 and bigger than fee'
            );
        }
        const { ethDeposit } = require('./scripts/eth_deposit');
        const depositToNear = false;
        await ethDeposit(hre.ethers.provider, depositToNear, taskArgs.ethRecipientOnNear, taskArgs.amount, taskArgs.fee);
    });

task('eth-generate-deposit-proof', 'Generates deposit proof for the given TX hash')
    .addParam('txHash', 'transaction hash')
    .setAction(async taskArgs => {
        const Proof = require('./scripts/eth_generate_proof');
        await Proof.findProof(taskArgs.txHash);
    });

task('eth-finalise-deposit-to-near', 'Generates the deposit proof for the given TX hash and submits it to Near to finalise the deposit')
    .addParam('txHash', 'transaction hash')
    .addParam('nearAccount', 'Near account that will submit the deposit transaction to Near')
    .addOptionalParam('nearRecipient', 'Near account that will receive the transferred amount (Used for verbose purposes to get detailed information)', undefined)
    .addOptionalParam('nearJsonRpc', 'Near JSON RPC address (default: "https://rpc.testnet.near.org/"', 'https://rpc.testnet.near.org/')
    .addOptionalParam('nearNetwork', 'Near network (default: default)', 'default')
    .setAction(async taskArgs => {
        const { ethFinaliseDepositToNear } = require('./scripts/eth_finalise_deposit_to_near');
        const depositToNear = false;
        await ethFinaliseDepositToNear(taskArgs.nearAccount, taskArgs.nearJsonRpc, taskArgs.nearNetwork, depositToNear, taskArgs.txHash, taskArgs.nearRecipient);
    });

task('eth-finalise-deposit-to-evm', 'Generates the deposit proof for the given TX hash and submits it to Near to finalise the deposit')
    .addParam('txHash', 'transaction hash')
    .addParam('nearAccount', 'Near account that will submit the deposit transaction to Near')
    .addOptionalParam('nearRecipient', 'Near account that will receive the transferred amount (Used for verbose purposes to get detailed information)', undefined)
    .addOptionalParam('nearJsonRpc', 'Near JSON RPC address (default: "https://rpc.testnet.near.org/"', 'https://rpc.testnet.near.org/')
    .addOptionalParam('nearNetwork', 'Near network (default: default)', 'default')
    .setAction(async taskArgs => {
        const { ethFinaliseDepositToNear } = require('./scripts/eth_finalise_deposit_to_near');
        const depositToNear = false;
        await ethFinaliseDepositToNear(taskArgs.nearAccount, taskArgs.nearJsonRpc, taskArgs.nearNetwork, depositToNear, taskArgs.txHash, taskArgs.nearRecipient);
    });

task('near-withdraw-to-eth', 'Withdraws the provided `amount` (wei) having `fee`(wei) from `nearAccount` to `ethRecipient` to transfer it to Ethereum')
    .addParam('nearAccount', 'Near account to withdraw from')
    .addParam('ethRecipient', 'Address of the recipient on Ethereum')
    .addParam('amount', 'Amount (wei) to transfer', 0, types.int)
    .addParam('fee', 'Fee (wei) for the transfer', 0, types.int)
    .addOptionalParam('noStd', 'Set this if you are using no-std version of the connector (default: false)', false, types.boolean)
    .addOptionalParam('nearJsonRpc', 'Near JSON RPC address (default: "https://rpc.testnet.near.org/"', 'https://rpc.testnet.near.org/')
    .addOptionalParam('nearNetwork', 'Near network (default: default)', 'default')
    .setAction(async taskArgs => {
        if (taskArgs.amount <= 0 || taskArgs.fee > taskArgs.amount) {
            throw new Error(
                'The amount to transfer should be greater than 0 and bigger than fee'
            );
        }
        const { nearWithdrawToEth } = require('./scripts/near_withdraw_to_eth');
        await nearWithdrawToEth(taskArgs.nearAccount, taskArgs.nearJsonRpc, taskArgs.nearNetwork, taskArgs.noStd, taskArgs.ethRecipient, taskArgs.amount, taskArgs.fee);
    });

task('near-finalise-withdraw-to-eth', 'Generates the receipt proof for the given TX hash and submits it to Ethereum to finalise the withdraw')
    .addParam('receiptId', 'Withdrawal success receipt ID')
    .addParam('nearAccount', 'Near account that will relay the transaction')
    .addOptionalParam('nearJsonRpc', 'Near JSON RPC address (default: "https://rpc.testnet.near.org/"', 'https://rpc.testnet.near.org/')
    .addOptionalParam('nearNetwork', 'Near network (default: default)', 'default')
    .setAction(async taskArgs => {
        const { nearFinaliseWithdrawToEth } = require('./scripts/near_finalise_withdraw');
        await nearFinaliseWithdrawToEth(hre.ethers.provider, taskArgs.nearAccount, taskArgs.nearJsonRpc, taskArgs.nearNetwork, taskArgs.receiptId);
    });

task('aurora-init-eth-connector', 'Initializes the Eth connector in the Aurora contract')
    .addParam('nearAccount', 'Near account that will submit the deposit transaction to Near')
    .addOptionalParam('nearJsonRpc', 'Near JSON RPC address (default: "https://rpc.testnet.near.org/"', 'https://rpc.testnet.near.org/')
    .addOptionalParam('nearNetwork', 'Near network (default: default)', 'default')
    .setAction(async taskArgs => {
        const { auroraInitEthConnector } = require('./scripts/aurora_init_eth_connector');
        await auroraInitEthConnector(taskArgs.nearAccount, taskArgs.nearJsonRpc, taskArgs.nearNetwork);
    });

module.exports = {
  paths: {
    sources: "./contracts",
    artifacts: "./build",
  },
  solidity: {
    compilers: [
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ]
  },
  networks: {
    ropsten: {
      url: `${WEB3_RPC_ENDPOINT}`,
      accounts: [`0x${ROPSTEN_PRIVATE_KEY}`]
    }
  },
  gasReporter: {
    currency: 'USD',
    enabled: false
  }
};
