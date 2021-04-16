require('dotenv').config();

const { ethers } = require('hardhat');
const ethereumConfig = require('./json/ethereum-config.json');
const BN = require('bn.js');

const NEAR_KEY_STORE_PATH = process.env.NEAR_KEY_STORE_PATH;

// NEAR keystore init
const nearAPI = require('near-api-js');
const keyStore = new nearAPI.keyStores.UnencryptedFileSystemKeyStore(NEAR_KEY_STORE_PATH);

async function nearWithdrawToEth(nearAccount, nearJsonRpc, nearNetwork, nostd, ethRecipient, amount, fee) {
    console.log(`Starting the withdrawal. ETH recipient: ${ethRecipient}; amount: ${amount} wei; fee: ${fee} wei`);
    console.log(`--------------------------------------------------------------------------------`);

    const near = await nearAPI.connect({
        deps: {
            keyStore,
        },
        nodeUrl: nearJsonRpc,
        networkId: nearNetwork
    });
    const account = await near.account(nearAccount);

    const nearEvmContract = new nearAPI.Contract(
        account,
        ethereumConfig.nearEvmAccount,
        {
            viewMethods: ['ft_balance_of'],
            changeMethods: ['withdraw'],
        }
    );
    const accountBalanceBefore = await nearEvmContract.ft_balance_of({
        account_id: nearAccount,
    });
    console.log(`Account balance before: ${ethers.utils.formatEther(accountBalanceBefore)} ETH`
                + ` (${accountBalanceBefore} wei)`);

    const withdrawTx = await account.functionCall(
        ethereumConfig.nearEvmAccount,
        'withdraw',
        {
            recipient_id: ethRecipient.replace('0x', ''),
            amount: nostd ? amount : amount.toString(),
            //fee: fee.toString(),
        },
        new BN('300' + '0'.repeat(12)) // 300 TGas
    );

    if (withdrawTx.status.Failure) {
        console.log('Because of some reason transaction was not applied as expected');
        return;
    } else {
        console.log(`Withdraw transaction succeeded. Hash: ${withdrawTx.transaction.hash}`);
    }

    const successReceiptId = withdrawTx.transaction_outcome.outcome.status.SuccessReceiptId;
    console.log(`The receipt of the transaction: ${successReceiptId}`);
    console.log(`This receipt should be used in the withdraw finalisation step`);
    const txReceiptBlockHash = withdrawTx.receipts_outcome.find(
        (r) => r.id === successReceiptId
    ).block_hash;

    const receiptBlock = await account.connection.provider.block({
        blockId: txReceiptBlockHash,
    });
    console.log(`Now you need to wait until NEAR Client on Ethereum will get a block with a height higher than ${receiptBlock.header.height}`);
}

exports.nearWithdrawToEth = nearWithdrawToEth;

