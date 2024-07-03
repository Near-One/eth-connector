require('dotenv').config();

const hre = require('hardhat');
const assert = require('node:assert');
const readlineSync = require('readline-sync');
const ethereumConfig = require('./json/ethereum-config.json');

async function updateAdminLegacy(provider, newAdmin) {
    let signer = new hre.ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);
    const ethCustodianContractFactory = await hre.ethers.getContractFactory('EthCustodian');
    const ethCustodian = await ethCustodianContractFactory.attach(ethereumConfig.ethConnectorAddress);
    console.log(`EthCustodian address: ${ethCustodian.address}`);
    console.log(`New admin address: ${newAdmin}`);

    // Mask matches only on the latest 20 bytes (to store the address)
    const adminAddressSlot = 4;
    const mask = ethers.BigNumber.from('0x000000000000000000000000ffffffffffffffffffffffffffffffffffffffff');
    console.log(`Used mask: ${mask}`);

    const slotContent = ethers.BigNumber.from(await provider.getStorageAt(ethCustodian.address, Number(adminAddressSlot))).toHexString();
    assert.equal(
        slotContent.toUpperCase(),
        signer.address.toUpperCase(),
        `The current admin doesn't match at the slot ${adminAddressSlot} contract ${ethCustodian.address}`,
    );

    console.log(`Call adminSstoreWithMask with the account: ${signer.address}`);

    const inputResult = readlineSync.question('WARRING! Please verify all data. This change can not be reverted,' +
        ' do you confirm that you are aware of this and want to change the admin address?\n Enter CONFIRM if yes: ');

    if (inputResult.toUpperCase() !== 'CONFIRM') {
        console.log('The task was aborted');
        return;
    }

    let unsignedTx = await ethCustodian
            .connect(signer)
            .populateTransaction
            .adminSstoreWithMask(adminAddressSlot, newAdmin, mask);

    unsignedTx.nonce = await provider.getTransactionCount(signer.address);
    unsignedTx.value = 0;
    unsignedTx.gasLimit= 50000;
    unsignedTx.gasPrice = 100000000000;

    // Sign and send tx
    const signedTx = await signer.signTransaction(unsignedTx);
    const tx = await provider.sendTransaction(signedTx);
    console.log(`Sent Tx with hash: ${tx.hash}`);

    await provider.waitForTransaction(tx.hash).then(function(receipt) {
        console.log(`Transaction mined: ${tx.hash}`);
        console.log(receipt);
    });
}

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
exports.updateAdminLegacy = updateAdminLegacy;