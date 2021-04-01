/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require('dotenv').config();
require('@nomiclabs/hardhat-waffle');
require('hardhat-gas-reporter');

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const ROPSTEN_PRIVATE_KEY = process.env.ROPSTEN_PRIVATE_KEY;

task('eth-generate-deposit-proof', 'Generates deposit proof for the given TX hash')
    .addParam('txHash', 'transaction hash')
    .setAction(async taskArgs => {
        const Proof = require('./scripts/eth_generate_proof');
        await Proof.findProof(taskArgs.txHash);
    });

task('eth-finalise-deposit-to-near', 'Generates deposit proof for the given TX hash and submits it to Near to finalise the deposit')
    .addParam('txHash', 'transaction hash')
    .addParam('nearAccount', 'Near account that will submit the deposit transaction to Near')
    .addOptionalParam('nearJsonRpc', 'Near JSON RPC address (default: "https://rpc.testnet.near.org/"', 'https://rpc.testnet.near.org/')
    .addOptionalParam('nearNetwork', 'Near network (default: default)', 'default')
    .setAction(async taskArgs => {
        const { ethFinaliseDepositToNear } = require('./scripts/eth_finalise_deposit_to_near');
        await ethFinaliseDepositToNear(taskArgs.txHash, taskArgs.nearAccount, taskArgs.nearJsonRpc, taskArgs.nearNetwork);
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
      url: `https://eth-ropsten.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
      accounts: [`0x${ROPSTEN_PRIVATE_KEY}`]
    }
  },
  gasReporter: {
    currency: 'USD',
    enabled: false
  }
};
