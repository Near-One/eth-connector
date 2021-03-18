require('dotenv').config();

const hre = require('hardhat');

const ethereumConfig = require('./json/ethereum-config.json');

const ROPSTEN_NETWORK = true;

async function main() {
    [deployerAccount] = await hre.ethers.getSigners();

    console.log(`Call deposit with the account: ${deployerAccount.address}`);

    const accountBalanceBefore = await deployerAccount.getBalance();
    console.log(`Account balance before: ${hre.ethers.utils.formatEther(accountBalanceBefore)} ETH`
                + ` (${accountBalanceBefore} wei)`);

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

    await ethCustodian
        .connect(deployerWallet)
        .estimateGas
        .depositToNear(ethereumConfig.nearRecipient, ethereumConfig.fee)
        .then(function(estimatedGas) {
            unsignedTx.gasLimit = estimatedGas;
    });
    console.log(`Estimated gas: ${unsignedTx.gasLimit}`);

    if (ROPSTEN_NETWORK) {
        unsignedTx.gasLimit = 80000;
        unsignedTx.gasPrice = 100000000000;
        console.log(`We are on the Ropsten network, use custom ` +
                    `gasLimit=${unsignedTx.gasLimit}; gasPrice=${unsignedTx.gasPrice}`);
    }

    console.log(`Amount to transfer: ${hre.ethers.utils.formatEther(ethereumConfig.amountToTransfer)} ETH`
                + ` (${ethereumConfig.amountToTransfer} wei); fee: ${ethereumConfig.fee} wei`);

    // Sign and send tx
    const signedTx = await deployerWallet.signTransaction(unsignedTx);
    const tx = await hre.ethers.provider.sendTransaction(signedTx);
    console.log(`Sent Tx with hash: ${tx.hash}`);

    await hre.ethers.provider.waitForTransaction(tx.hash).then(function(receipt) {
        console.log(`Transaction mined: ${tx.hash}`);
        console.log(receipt);
    });

    const accountBalanceAfter = await deployerAccount.getBalance();
    console.log(`Account balance after: ${hre.ethers.utils.formatEther(accountBalanceAfter)} ETH`
                + ` (${accountBalanceAfter} wei)`);

    console.log(`Use the following TX hash for the following steps:\nTX hash: ${tx.hash}`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
