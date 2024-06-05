require('dotenv').config();

const hre = require('hardhat');

const ethereumConfig = require('./json/ethereum-config.json');

async function nominateAdmin(provider, newAdmin) {
    [deployerAccount] = await hre.ethers.getSigners();

    console.log(`Call nominateAdmin with the account: ${deployerAccount.address}`);

    const ethCustodianContractFactory = await hre.ethers.getContractFactory('EthCustodian');
    const ethCustodian = await ethCustodianContractFactory.attach(ethereumConfig.ethConnectorAddress);

    console.log(`EthCustodian address: ${ethCustodian.address}`);

    const deployerWallet = new hre.ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);
    let unsignedTx = await ethCustodian
            .connect(deployerWallet)
            .populateTransaction
            .nominateAdmin(newAdmin);

    unsignedTx.nonce = await provider.getTransactionCount(deployerWallet.address);
    unsignedTx.value = 0;
    unsignedTx.gasPrice = 100000000000;

    await ethCustodian
        .connect(deployerWallet)
        .estimateGas
        .nominateAdmin(newAdmin)
        .then(function(estimatedGas) {
            unsignedTx.gasLimit = estimatedGas;
        });

    // Sign and send tx
    const signedTx = await deployerWallet.signTransaction(unsignedTx);
    const tx = await provider.sendTransaction(signedTx);
    console.log(`Sent Tx with hash: ${tx.hash}`);

    await provider.waitForTransaction(tx.hash).then(function(receipt) {
        console.log(`Transaction mined: ${tx.hash}`);
        console.log(receipt);
    });
}

async function acceptAdmin(provider, newAdmin) {
    [deployerAccount] = await hre.ethers.getSigners();

    console.log(`Call acceptAdmin with the account: ${deployerAccount.address}`);

    const ethCustodianContractFactory = await hre.ethers.getContractFactory('EthCustodian');
    const ethCustodian = await ethCustodianContractFactory.attach(ethereumConfig.ethConnectorAddress);

    console.log(`EthCustodian address: ${ethCustodian.address}`);

    const deployerWallet = new hre.ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);
    let unsignedTx = await ethCustodian
        .connect(deployerWallet)
        .populateTransaction
        .acceptAdmin(newAdmin);

    unsignedTx.nonce = await provider.getTransactionCount(deployerWallet.address);
    unsignedTx.value = 0;
    unsignedTx.gasPrice = 100000000000;

    await ethCustodian
        .connect(deployerWallet)
        .estimateGas
        .acceptAdmin(newAdmin)
        .then(function(estimatedGas) {
            unsignedTx.gasLimit = estimatedGas;
        });

    // Sign and send tx
    const signedTx = await deployerWallet.signTransaction(unsignedTx);
    const tx = await provider.sendTransaction(signedTx);
    console.log(`Sent Tx with hash: ${tx.hash}`);

    await provider.waitForTransaction(tx.hash).then(function(receipt) {
        console.log(`Transaction mined: ${tx.hash}`);
        console.log(receipt);
    });
}

exports.nominateAdmin = nominateAdmin;
exports.acceptAdmin = acceptAdmin;
