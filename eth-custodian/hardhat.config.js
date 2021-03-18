/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require('dotenv').config();
require('@nomiclabs/hardhat-waffle');
require('hardhat-gas-reporter');

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const ROPSTEN_PRIVATE_KEY = process.env.ROPSTEN_PRIVATE_KEY;

task("eth-generate-deposit-proof", "Generates deposit proof for the given TX hash")
    .addParam("txHash", "transaction hash")
    .setAction(async taskArgs => {
        const Proof = require('./scripts/eth_generate_proof');
        await Proof.findProof(taskArgs.txHash);
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
