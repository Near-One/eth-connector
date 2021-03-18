require('dotenv').config();

const hre = require('hardhat');

const ethereumConfig = require('./json/ethereum-config.json');
const Path = require('path');
const fs = require('fs').promises;

const { borshifyOutcomeProof } = require('rainbow-bridge-lib/rainbow/borshify-proof.js');

async function main() {
    [deployerAccount] = await hre.ethers.getSigners();

    console.log(`Call withdraw from the account: ${deployerAccount.address}`);

    const accountBalanceBefore = await deployerAccount.getBalance();
    console.log(`Account balance before: ${accountBalanceBefore} wei`);
    console.log(`Account balance before: ${hre.ethers.utils.formatEther(accountBalanceBefore)} ETH`);

    const ethCustodianContractFactory = await hre.ethers.getContractFactory('EthCustodian');
    const ethCustodian = await ethCustodianContractFactory.attach(ethereumConfig.ethConnectorAddress);

    console.log(`EthCustodian address: ${ethCustodian.address}`);

    const proofJson = require('../test/proof_template_from_testnet.json');
    const clientHeight = 1099;
    console.log(`Client height: ${clientHeight}`);

    const proof = borshifyOutcomeProof(proofJson);

    const deployerWallet = new hre.ethers.Wallet(process.env.ROPSTEN_PRIVATE_KEY, hre.ethers.getDefaultProvider());
    let unsignedTx = await ethCustodian
        .connect(deployerWallet)
        .populateTransaction
        .withdraw(proof, clientHeight);

    unsignedTx.nonce = await hre.ethers.provider.getTransactionCount(deployerWallet.address);
    unsignedTx.value = 0;
    unsignedTx.gasPrice = 100000000000;
    unsignedTx.gasLimit = 800000;

    // Sign and send tx
    const signedTx = await deployerWallet.signTransaction(unsignedTx);
    const tx = await hre.ethers.provider.sendTransaction(signedTx);
    console.log(`Sent Tx with hash: ${tx.hash}`);

    await hre.ethers.provider.waitForTransaction(tx.hash).then(function(receipt) {
        console.log(`Transaction mined: ${tx.hash}`);
        console.log(receipt);
    }, (error) => {
        // This is entered if the status of the receipt is failure
        return error.checkCall().then((error) => {
            console.log("Error", error);
            return false;
        });
    }
    );

    const accountBalanceAfter = await deployerAccount.getBalance();
    console.log(`Account balance after: ${accountBalanceAfter} wei`);
    console.log(`Account balance after: ${hre.ethers.utils.formatEther(accountBalanceAfter)} ETH`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    })
