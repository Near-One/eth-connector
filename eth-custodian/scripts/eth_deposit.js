require('dotenv').config();

const hre = require('hardhat');

const ethereumConfig = require('./json/ethereum-config.json');


async function ethDeposit(provider, depositToNear, recipient, amountToTransfer, fee) {
    amountToTransfer = ethers.BigNumber.from(amountToTransfer);
    fee = ethers.BigNumber.from(fee);

    if (amountToTransfer.lte(ethers.constants.Zero) || fee.gt(amountToTransfer)) {
        throw new Error(
            'The amount to transfer should be greater than 0 and bigger than fee'
        );
    }

    [deployerAccount] = await hre.ethers.getSigners();

    console.log(`Call deposit with the account: ${deployerAccount.address}`);

    const accountBalanceBefore = await deployerAccount.getBalance();
    console.log(`Account balance before: ${hre.ethers.utils.formatEther(accountBalanceBefore)} ETH`
                + ` (${accountBalanceBefore} wei)`);

    const ethCustodianContractFactory = await hre.ethers.getContractFactory('EthCustodian');
    const ethCustodian = await ethCustodianContractFactory.attach(ethereumConfig.ethConnectorAddress);

    console.log(`EthCustodian address: ${ethCustodian.address}`);

    const deployerWallet = new hre.ethers.Wallet(process.env.ROPSTEN_PRIVATE_KEY, provider);
    let unsignedTx;

    if (depositToNear) {
        unsignedTx = await ethCustodian
            .connect(deployerWallet)
            .populateTransaction
            .depositToNear(recipient, fee);
    } else {
        recipient = ethers.utils.getAddress(recipient).replace('0x', '');
        unsignedTx = await ethCustodian
            .connect(deployerWallet)
            .populateTransaction
            .depositToEVM(recipient, fee);
    }

    unsignedTx.nonce = await provider.getTransactionCount(deployerWallet.address);
    unsignedTx.value = amountToTransfer;

    if (network.name == 'ropsten') {
        unsignedTx.gasLimit = 800000;
        unsignedTx.gasPrice = 100000000000;
        console.log(`We are on the Ropsten network, use custom ` +
                    `gasLimit=${unsignedTx.gasLimit}; gasPrice=${unsignedTx.gasPrice}`);
    } else if (network.name == 'mainnet') {
        unsignedTx.gasLimit = 900000;
        unsignedTx.gasPrice = 40200000000;
        console.log(`We currently can not estimate gas on Mainnet network, use custom ` +
                    `gasLimit=${unsignedTx.gasLimit}; gasPrice=${unsignedTx.gasPrice}`);
    } else {
        if (depositToNear) {
            await ethCustodian
                .connect(deployerWallet)
                .estimateGas
                .depositToNear(recipient, fee)
                .then(function(estimatedGas) {
                    unsignedTx.gasLimit = estimatedGas;
                });
        } else {
            await ethCustodian
                .connect(deployerWallet)
                .estimateGas
                .depositToEVM(recipient, fee)
                .then(function(estimatedGas) {
                    unsignedTx.gasLimit = estimatedGas;
                });
        }
        console.log(`Estimated gas: ${unsignedTx.gasLimit}`);
    }

    console.log(`Amount to transfer: ${hre.ethers.utils.formatEther(amountToTransfer)} ETH`
                + ` (${amountToTransfer} wei); fee: ${fee} wei`);

    // Sign and send tx
    const signedTx = await deployerWallet.signTransaction(unsignedTx);
    const tx = await provider.sendTransaction(signedTx);
    console.log(`Sent Tx with hash: ${tx.hash}`);

    await provider.waitForTransaction(tx.hash).then(function(receipt) {
        console.log(`Transaction mined: ${tx.hash}`);
        console.log(receipt);
    });

    const accountBalanceAfter = await deployerAccount.getBalance();
    console.log(`Account balance after: ${hre.ethers.utils.formatEther(accountBalanceAfter)} ETH`
                + ` (${accountBalanceAfter} wei)`);

    console.log(`Use the following TX hash for the following steps:\nTX hash: ${tx.hash}`);
}

exports.ethDeposit = ethDeposit;
