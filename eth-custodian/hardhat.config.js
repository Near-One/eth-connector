/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require('dotenv').config();
require('@nomiclabs/hardhat-waffle');
require('hardhat-gas-reporter');

const ROPSTEN_WEB3_RPC_ENDPOINT = process.env.ROPSTEN_WEB3_RPC_ENDPOINT;
const GOERLI_WEB3_RPC_ENDPOINT = process.env.GOERLI_WEB3_RPC_ENDPOINT;
const MAINNET_WEB3_RPC_ENDPOINT = process.env.MAINNET_WEB3_RPC_ENDPOINT;
const AURORA_WEB3_RPC_ENDPOINT = process.env.AURORA_WEB3_RPC_ENDPOINT;
// Hardhat workaround to specify some random private key so this won't fail in CI
const ROPSTEN_PRIVATE_KEY = process.env.ROPSTEN_PRIVATE_KEY ? process.env.ROPSTEN_PRIVATE_KEY : "00".repeat(32);
const GOERLI_PRIVATE_KEY = process.env.GOERLI_PRIVATE_KEY ? process.env.GOERLI_PRIVATE_KEY : "00".repeat(32);
const MAINNET_PRIVATE_KEY = process.env.MAINNET_PRIVATE_KEY ? process.env.MAINNET_PRIVATE_KEY : "00".repeat(32);
const AURORA_PRIVATE_KEY = process.env.AURORA_PRIVATE_KEY ? process.env.AURORA_PRIVATE_KEY : "00".repeat(32);

const PROVER_ACCOUNT_MAINNET = 'prover.bridge.near';
const PROVER_ACCOUNT_TESTNET = 'prover.goerli.testnet';

task('eth-deposit-to-near', 'Deposits the provided `amount` (wei) having `fee`(wei) to ETH Custodian to transfer it to Near')
    .addParam('nearRecipient', 'AccountID of recipient on Near')
    .addParam('amount', 'Amount (wei) to transfer',)
    .addParam('fee', 'Fee (wei) for the transfer',)
    .setAction(async taskArgs => {
        const { ethDeposit } = require('./scripts/eth_deposit');
        const depositToNear = true;
        await ethDeposit(hre.ethers.provider, depositToNear, taskArgs.nearRecipient, taskArgs.amount, taskArgs.fee);
    });

task('eth-deposit-to-evm', 'Deposits the provided `amount` (wei) having `fee`(wei) to ETH Custodian to transfer it to Near EVM')
    .addParam('ethRecipientOnNear', 'Eth address of recipient on Near Aurora')
    .addParam('amount', 'Amount (wei) to transfer')
    .addParam('fee', 'Fee (wei) for the transfer')
    .setAction(async taskArgs => {
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

task('eth-get-erc20-metadata', 'Gets ERC-20 token metadata at the provided address')
    .addParam('address', 'ERC-20 token address')
    .setAction(async taskArgs => {
        const { getErc20TokenMetadata } = require('./scripts/eth_utils');
        const metadata = await getErc20TokenMetadata(hre.ethers.provider, taskArgs.address);
        console.log(`Metadata for ERC-20 token at ${taskArgs.address}:\n ${JSON.stringify(metadata)}`);
    });

task('near-check-proof-exists', 'Checks whether deposit proof exists for the given TX hash')
    .addParam('nearAccount', 'Near account that submits the transaction')
    .addParam('txHash', 'transaction hash')
    .addOptionalParam('nearJsonRpc', 'Near JSON RPC address (default: "https://rpc.testnet.near.org/"', 'https://rpc.testnet.near.org/')
    .addOptionalParam('nearNetwork', 'Near network (default: default)', 'default')
    .setAction(async taskArgs => {
        const Proof = require('./scripts/eth_generate_proof');
        const shouldBorshifyProof = true;
        const proof = await Proof.findProof(taskArgs.txHash, shouldBorshifyProof);

        const { nearCheckIfProofExists } = require('./scripts/near_utils.js');
        const proofExists = await nearCheckIfProofExists(taskArgs.nearAccount, taskArgs.nearJsonRpc, taskArgs.nearNetwork, proof);
        console.log(`Proof for TX ${taskArgs.txHash} exists: ${proofExists}`);
    });

task('near-set-paused-flags', 'Sets paused flags')
    .addParam('nearAccount', 'Near account that submits the transaction')
    .addParam('pausedFlags', 'paused flags')
    .addOptionalParam('nearJsonRpc', 'Near JSON RPC address (default: "https://rpc.testnet.near.org/"', 'https://rpc.testnet.near.org/')
    .addOptionalParam('nearNetwork', 'Near network (default: default)', 'default')
    .setAction(async taskArgs => {
        const { nearSetPausedFlags } = require('./scripts/near_utils.js');
        await nearSetPausedFlags(taskArgs.nearAccount, taskArgs.nearJsonRpc, taskArgs.nearNetwork, taskArgs.pausedFlags);
    });

task('near-finalize-deposit-from-eth', 'Generates the deposit proof for the given Ethereum TX hash and submits it to Near to finalize the deposit')
    .addParam('txHash', 'transaction hash')
    .addParam('nearAccount', 'Near account that will submit the deposit transaction to Near')
    .addOptionalParam('depositedToNear', 'Set this if you are depositing to Near NEP-14. Used only for balance information (default: false)', false, types.boolean)
    .addOptionalParam('nearRecipient', 'Near account that will receive the transferred amount (Used for verbose purposes to get detailed information)', undefined)
    .addOptionalParam('ethRecipient', 'Aurora ETH account that will receive the transferred amount (Used for verbose purposes to get detailed information)', undefined)
    .addOptionalParam('nearJsonRpc', 'Near JSON RPC address (default: "https://rpc.testnet.near.org/"', 'https://rpc.testnet.near.org/')
    .addOptionalParam('nearNetwork', 'Near network (default: default)', 'default')
    .setAction(async taskArgs => {
        const { nearFinalizeDepositFromEth } = require('./scripts/near_finalize_deposit_from_eth');
        await nearFinalizeDepositFromEth(taskArgs.nearAccount, taskArgs.nearJsonRpc, taskArgs.nearNetwork, taskArgs.depositedToNear, taskArgs.txHash, taskArgs.nearRecipient, taskArgs.ethRecipient);
    });

task('near-withdraw-bridged-eth', 'Withdraws the provided `amount` (bridgedWei) having `fee` (bridgedWei) from `nearAccount` to `ethRecipient` to transfer it to Ethereum')
    .addParam('nearAccount', 'Near account to withdraw from')
    .addParam('ethRecipient', 'Address of the recipient on Ethereum')
    .addParam('amount', 'Amount (bridgedWei) to withdraw')
    .addParam('fee', 'Fee (bridgedWei) for the withdraw')
    //.addOptionalParam('noStd', 'Set this if you are using no-std version of the connector (default: false)', false, types.boolean)
    .addOptionalParam('nearJsonRpc', 'Near JSON RPC address (default: "https://rpc.testnet.near.org/"', 'https://rpc.testnet.near.org/')
    .addOptionalParam('nearNetwork', 'Near network (default: default)', 'default')
    .setAction(async taskArgs => {
        const { nearWithdrawBridgedEth } = require('./scripts/near_withdraw_to_eth');
        await nearWithdrawBridgedEth(taskArgs.nearAccount, taskArgs.nearJsonRpc, taskArgs.nearNetwork, taskArgs.ethRecipient, taskArgs.amount, taskArgs.fee);
    });

task('eth-finalize-withdraw-from-near', 'Generates the receipt proof for the given Near TX hash and submits it to Ethereum to finalize the withdraw')
    .addParam('receiptId', 'Withdrawal success receipt ID')
    .addParam('nearAccount', 'Near account that will relay the transaction')
    .addOptionalParam('nearJsonRpc', 'Near JSON RPC address (default: "https://rpc.testnet.near.org/"', 'https://rpc.testnet.near.org/')
    .addOptionalParam('nearNetwork', 'Near network (default: default)', 'default')
    .setAction(async taskArgs => {
        const { ethFinalizeWithdrawFromNear } = require('./scripts/eth_finalize_withdraw_from_near');
        await ethFinalizeWithdrawFromNear(hre.ethers.provider, taskArgs.nearAccount, taskArgs.nearJsonRpc, taskArgs.nearNetwork, taskArgs.receiptId);
    });

task('near-ft-balance-of', 'Returns the current balance of bridged ETH for the provided Near account')
    .addParam('nearAccount', 'Near account that submits the transaction')
    .addParam('queryNearAccount', 'Near account that owns bridged ETH')
    .addOptionalParam('nearJsonRpc', 'Near JSON RPC address (default: "https://rpc.testnet.near.org/"', 'https://rpc.testnet.near.org/')
    .addOptionalParam('nearNetwork', 'Near network (default: default)', 'default')
    .setAction(async taskArgs => {
        const { nearFtBalanceOf } = require('./scripts/near_utils');
        const accountBalance = await nearFtBalanceOf(taskArgs.nearAccount, taskArgs.nearJsonRpc, taskArgs.nearNetwork, taskArgs.queryNearAccount);
        console.log(`Account balance of ${taskArgs.nearAccount}: ${accountBalance} yoctoNEAR`);
    });

task('near-ft-balance-of-eth', 'Returns the current balance of nETH for the provided Ethereum account')
    .addParam('ethAddress', 'Ethereum address that owns nETH')
    .addParam('nearAccount', 'Near account that creates a request')
    .addOptionalParam('nearJsonRpc', 'Near JSON RPC address (default: "https://rpc.testnet.near.org/"', 'https://rpc.testnet.near.org/')
    .addOptionalParam('nearNetwork', 'Near network (default: default)', 'default')
    .setAction(async taskArgs => {
        const { nearFtBalanceOfEth } = require('./scripts/near_utils');
        const ethBalance = await nearFtBalanceOfEth(taskArgs.nearAccount, taskArgs.nearJsonRpc, taskArgs.nearNetwork, taskArgs.ethAddress);
        console.log(`Account balance of ${taskArgs.ethAddress}: ${hre.ethers.utils.formatEther(ethBalance)} nETH (${ethBalance} nWei)`);
    });

task('aurora-init-eth-connector', 'Initializes the Eth connector in the Aurora contract')
    .addParam('nearAccount', 'Near account that will submit the deposit transaction to Near')
    .addOptionalParam('nearJsonRpc', 'Near JSON RPC address (default: "https://rpc.testnet.near.org/"', 'https://rpc.testnet.near.org/')
    .addOptionalParam('nearNetwork', 'Near network (default: default)', 'default')
    .setAction(async taskArgs => {
        const { auroraInitEthConnector } = require('./scripts/aurora_utils');
        const proverAccount = taskArgs.nearNetwork === 'mainnet' ? PROVER_ACCOUNT_MAINNET : PROVER_ACCOUNT_TESTNET;
        await auroraInitEthConnector(taskArgs.nearAccount, taskArgs.nearJsonRpc, taskArgs.nearNetwork, proverAccount);
    });

task('aurora-register-relayer', 'Register the relayer in the Aurora contract')
    .addParam('nearAccount', 'Near account that will submit the deposit transaction to Near')
    .addParam('relayerAddressInAurora', 'Aurora Eth address of the relayer')
    .addOptionalParam('nearJsonRpc', 'Near JSON RPC address (default: "https://rpc.testnet.near.org/"', 'https://rpc.testnet.near.org/')
    .addOptionalParam('nearNetwork', 'Near network (default: default)', 'default')
    .setAction(async taskArgs => {
        const { auroraRegisterRelayer } = require('./scripts/aurora_utils');
        await auroraRegisterRelayer(taskArgs.nearAccount, taskArgs.nearJsonRpc, taskArgs.nearNetwork, taskArgs.relayerAddressInAurora);
    });

task('aurora-deploy-erc20-token', 'Deploys ERC-20 token mapped to the provided NEP141-token with the given account ID')
    .addParam('nearAccount', 'Near account that submits the transaction')
    .addParam('tokenAccountId', 'ERC-20 prefix of NEP-141 Near account')
    .addOptionalParam('nearJsonRpc', 'Near JSON RPC address (default: "https://rpc.testnet.near.org/"', 'https://rpc.testnet.near.org/')
    .addOptionalParam('nearNetwork', 'Near network (default: default)', 'default')
    .setAction(async taskArgs => {
        const { auroraDeployErc20Token } = require('./scripts/aurora_utils');
        const { nearGetBridgedTokenAccountId } = require('./scripts/near_utils.js');
        const nep141AccountId = nearGetBridgedTokenAccountId(taskArgs.tokenAccountId);
        console.log(`NEP-141 address for ${taskArgs.tokenAccountId}: ${nep141AccountId}`);

        const tokenAddressInAurora = await auroraDeployErc20Token(taskArgs.nearAccount, taskArgs.nearJsonRpc, taskArgs.nearNetwork, nep141AccountId);
        console.log(`Deployed ERC-20 token for ${taskArgs.tokenAccountId} to Aurora at: ${tokenAddressInAurora}`);
    });

task('aurora-get-erc20-from-nep141', 'Gets the ERC-20 token mapped to the provided NEP141-token with the given account ID')
    .addParam('nearAccount', 'Near account that submits the transaction')
    .addParam('tokenAccountId', 'ERC-20 prefix of NEP-141 Near account')
    .addOptionalParam('nearJsonRpc', 'Near JSON RPC address (default: "https://rpc.testnet.near.org/"', 'https://rpc.testnet.near.org/')
    .addOptionalParam('nearNetwork', 'Near network (default: default)', 'default')
    .setAction(async taskArgs => {
        const { auroraGetErc20FromNep141 } = require('./scripts/aurora_utils');
        const { nearGetBridgedTokenAccountId } = require('./scripts/near_utils.js');
        const nep141AccountId = nearGetBridgedTokenAccountId(taskArgs.tokenAccountId);
        console.log(`NEP-141 address for ${taskArgs.tokenAccountId}: ${nep141AccountId}`);

        const tokenAddressInAurora = await auroraGetErc20FromNep141(taskArgs.nearAccount, taskArgs.nearJsonRpc, taskArgs.nearNetwork, nep141AccountId);
        console.log(`ERC-20 token for ${taskArgs.tokenAccountId} in Aurora: ${tokenAddressInAurora}`);
    });

task('aurora-get-nep141-from-erc20', 'Gets the NEP-141 token account ID for the provided ERC-20 token address in Aurora')
    .addParam('nearAccount', 'Near account that submits the transaction')
    .addParam('erc20TokenAddressInAurora', 'ERC-20 token address in Aurora')
    .addOptionalParam('nearJsonRpc', 'Near JSON RPC address (default: "https://rpc.testnet.near.org/"', 'https://rpc.testnet.near.org/')
    .addOptionalParam('nearNetwork', 'Near network (default: default)', 'default')
    .setAction(async taskArgs => {
        const { auroraGetNep141FromErc20 } = require('./scripts/aurora_utils');

        const nep141Address = await auroraGetNep141FromErc20(taskArgs.nearAccount, taskArgs.nearJsonRpc, taskArgs.nearNetwork, taskArgs.erc20TokenAddressInAurora);
        console.log(`NEP-141 account Id for ${taskArgs.erc20TokenAddressInAurora} in Aurora: ${nep141Address}`);
    });

task('aurora-set-erc20-metadata', 'Sets metadata for the given Aurora ERC-20 token in Aurora')
    .addParam('nearAccount', 'Near account that submits the transaction')
    .addParam('erc20TokenAddressInAurora', 'ERC-20 token address in Aurora')
    .addParam('name', 'ERC-20 Metadata: name')
    .addParam('symbol', 'ERC-20 Metadata: symbol')
    .addParam('decimals', 'ERC-20 Metadata: decimals')
    .addOptionalParam('nearJsonRpc', 'Near JSON RPC address (default: "https://rpc.testnet.near.org/"', 'https://rpc.testnet.near.org/')
    .addOptionalParam('nearNetwork', 'Near network (default: default)', 'default')
    .setAction(async taskArgs => {
        const { auroraSetErc20Metadata } = require('./scripts/aurora_utils');

        await auroraSetErc20Metadata(taskArgs.nearAccount, taskArgs.nearJsonRpc, taskArgs.nearNetwork, taskArgs.erc20TokenAddressInAurora, taskArgs.name, taskArgs.symbol, taskArgs.decimals);
    });

task('aurora-bridge-erc20-token-and-metadata', 'Gets ERC-20 token from Ethereum and bridges it along with metadata to the Aurora')
    .addParam('nearAccount', 'Near account that submits the transaction')
    .addParam('erc20TokenAddressInEthereum', 'ERC-20 token address in Ethereum')
    .addOptionalParam('nearJsonRpc', 'Near JSON RPC address (default: "https://rpc.testnet.near.org/"', 'https://rpc.testnet.near.org/')
    .addOptionalParam('nearNetwork', 'Near network (default: default)', 'default')
    .setAction(async taskArgs => {
        // Get ERC-20 Metadata
        const { getErc20TokenMetadata } = require('./scripts/eth_utils');
        const metadata = await getErc20TokenMetadata(hre.ethers.provider, taskArgs.erc20TokenAddressInEthereum);
        console.log(`Metadata for ERC-20 token at ${taskArgs.erc20TokenAddressInEthereum}:\n ${JSON.stringify(metadata)}`);
        const {name, symbol, decimals} = metadata;
        console.log(`Metadata unwrapped: ${name}, ${symbol}, ${decimals}`);

        // Get NEP-141 account for ERC-20 token
        const { nearGetBridgedTokenAccountId } = require('./scripts/near_utils.js');
        const nep141AccountId = nearGetBridgedTokenAccountId(taskArgs.erc20TokenAddressInEthereum);
        console.log(`NEP-141 address for ${taskArgs.erc20TokenAddressInEthereum}: ${nep141AccountId}`);

        let erc20TokenAddressInAurora;
        try {
            const { auroraDeployErc20Token } = require('./scripts/aurora_utils');

            // Deploy ERC-20 token
            erc20TokenAddressInAurora = await auroraDeployErc20Token(taskArgs.nearAccount, taskArgs.nearJsonRpc, taskArgs.nearNetwork, nep141AccountId);
            console.log(`Deployed ERC-20 token for ${nep141AccountId} to Aurora at: ${erc20TokenAddressInAurora}`);
        } catch {
            const { auroraGetErc20FromNep141 } = require('./scripts/aurora_utils');

            // Get ERC-20 adddress of the deployed token in Aurora
            erc20TokenAddressInAurora = await auroraGetErc20FromNep141(taskArgs.nearAccount, taskArgs.nearJsonRpc, taskArgs.nearNetwork, nep141AccountId);
            console.log(`We already have ERC-20 token for ${nep141AccountId} to Aurora at: ${erc20TokenAddressInAurora}`);
        }

        const { auroraSetErc20Metadata } = require('./scripts/aurora_utils');
        await auroraSetErc20Metadata(taskArgs.nearAccount, taskArgs.nearJsonRpc, taskArgs.nearNetwork,
                                     erc20TokenAddressInAurora,
                                     name, symbol, decimals);

        const auroraProvider = hre.ethers.getDefaultProvider(AURORA_WEB3_RPC_ENDPOINT);
        const metadataInAurora = await getErc20TokenMetadata(auroraProvider, erc20TokenAddressInAurora);
        console.log(`Metadata for ERC-20 token in Aurora at ${erc20TokenAddressInAurora}:\n ${JSON.stringify(metadataInAurora)}`);
    });


module.exports = {
  paths: {
    sources: "./contracts",
    artifacts: "./build",
  },
  solidity: {
    compilers: [
      {
        version: "0.8.20",
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
      url: `${ROPSTEN_WEB3_RPC_ENDPOINT}`,
      accounts: [`0x${ROPSTEN_PRIVATE_KEY}`]
    },
    goerli: {
      url: `${GOERLI_WEB3_RPC_ENDPOINT}`,
      accounts: [`0x${GOERLI_PRIVATE_KEY}`]
    },
    mainnet: {
      url: `${MAINNET_WEB3_RPC_ENDPOINT}`,
      accounts: [`0x${MAINNET_PRIVATE_KEY}`]
    },
    developAurora: {
      url: `${AURORA_WEB3_RPC_ENDPOINT}`,
      chain_id: 1313161555,
      accounts: [`0x${AURORA_PRIVATE_KEY}`]
    },
    testnetAurora: {
      url: `${AURORA_WEB3_RPC_ENDPOINT}`,
      chain_id: 1313161555,
      accounts: [`0x${AURORA_PRIVATE_KEY}`]
    },
    mainnetAurora: {
      url: `${AURORA_WEB3_RPC_ENDPOINT}`,
      chain_id: 1313161554,
      accounts: [`0x${AURORA_PRIVATE_KEY}`]
    },
  },
  gasReporter: {
    currency: 'USD',
    enabled: false
  }
};
