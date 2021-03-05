require('dotenv').config();

const hre = require('hardhat');
const { expect } = require('chai');

const ethereumConfig = require('./json/ethereum-config.json');


async function main() {
    [deployerAccount] = await hre.ethers.getSigners();

    console.log(`Call deposit with the account: ${deployerAccount.address}`);

    const accountBalanceBefore = await deployerAccount.getBalance();
    console.log(`Account balance before: ${accountBalanceBefore} wei`);
    console.log(`Account balance before: ${hre.ethers.utils.formatEther(accountBalanceBefore)} ETH`);

    const ethCustodianContractFactory = await hre.ethers.getContractFactory('EthCustodian');
    const ethCustodian = await ethCustodianContractFactory.attach(ethereumConfig.ethConnectorAddress);

    console.log(`EthCustodian address: ${ethCustodian.address}`);

    const deployerWallet = new hre.ethers.Wallet(process.env.ROPSTEN_PRIVATE_KEY, hre.ethers.getDefaultProvider());
    let unsignedTx = await ethCustodian
        .connect(deployerWallet)
        .populateTransaction
        .depositToNear(ethereumConfig.nearRecipient, ethereumConfig.fee);

    unsignedTx.nonce = await hre.ethers.provider.getTransactionCount(deployerWallet.address);
    unsignedTx.value = ethereumConfig.amountToTransfer;
    unsignedTx.gasPrice = 100000000000;
    unsignedTx.gasLimit = 70000;

    console.log(`Amount to transfer: ${ethereumConfig.amountToTransfer}; fee: ${ethereumConfig.fee}`);

    // Sign and send tx
    const signedTx = await deployerWallet.signTransaction(unsignedTx);
    const tx = await hre.ethers.provider.sendTransaction(signedTx);
    console.log(`Sent Tx with hash: ${tx.hash}`);

    await hre.ethers.provider.waitForTransaction(tx.hash).then(function(receipt) {
        console.log(`Transaction mined: ${tx.hash}`);
        console.log(receipt);
    });

    const accountBalanceAfter = await deployerAccount.getBalance();
    console.log(`Account balance after: ${accountBalanceAfter} wei`);
    console.log(`Account balance after: ${hre.ethers.utils.formatEther(accountBalanceAfter)} ETH`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
