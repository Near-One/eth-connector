require('dotenv').config();

const ethereumConfig = require('./json/ethereum-config.json');

const { ethers } = require('hardhat');
const BN = require('bn.js');
const nearAPI = require('near-api-js');
const { serialize: serializeBorsh } = require('near-api-js/lib/utils/serialize');

const { nearFtBalanceOf, nearFtBalanceOfEth } = require('./near_utils');

const NEAR_KEY_STORE_PATH = process.env.NEAR_KEY_STORE_PATH;
const keyStore = new nearAPI.keyStores.UnencryptedFileSystemKeyStore(NEAR_KEY_STORE_PATH);

class BorshWithdrawArgs {
  constructor (args) {
    Object.assign(this, args)
  }
};

const withdrawCallArgsSchema = new Map([
  [BorshWithdrawArgs, {
    kind: 'struct',
    fields: [
      ['recipient_id', 'string'],
      ['amount', 'u128']
    //TODO
    //['fee', 'u128']
    ]
  }]
]);

async function nearWithdrawBridgedEth(nearAccount, nearJsonRpc, nearNetwork, ethRecipient, amount, fee) {
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
            changeMethods: ['withdraw'],
        }
    );
    const accountBalanceBefore = await nearFtBalanceOf(nearAccount, nearJsonRpc, nearNetwork);
    console.log(`Account ${nearAccount} balance before: ${ethers.utils.formatEther(accountBalanceBefore)} bridgedETH`
                + ` (${accountBalanceBefore} bridgedWei)`);

    const args = new BorshWithdrawArgs({
        recipient_id: ethRecipient.replace('0x', ''),
        amount: amount,
        //fee: fee,
    });

    const serializedArgs = serializeBorsh(withdrawCallArgsSchema, args);

    const gas_limit = new BN('300' + '0'.repeat(12)); // Gas limit
    const payment_for_storage = new BN('1'); // Attached payment to pay for the storage

    const withdrawTx = await account.functionCall(
        ethereumConfig.nearEvmAccount,
        'withdraw',
        serializedArgs,
        gas_limit,
        payment_for_storage
    );

    if (withdrawTx.status.Failure) {
        console.log('Because of some reason transaction was not applied as expected');
        return;
    }

    console.log(`Withdraw transaction succeeded. Hash: ${withdrawTx.transaction.hash}`);
    const accountBalanceAfter = await nearFtBalanceOf(nearAccount, nearJsonRpc, nearNetwork);
    console.log(`Account ${nearAccount} balance after: ${ethers.utils.formatEther(accountBalanceAfter)} bridgedETH`
                + ` (${accountBalanceAfter} bridgedWei)`);

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

exports.nearWithdrawBridgedEth = nearWithdrawBridgedEth;

