require('dotenv').config();

const ethereumConfig = require('./json/ethereum-config.json');

const { BN } = require('bn.js');
const nearAPI = require('near-api-js');

const Proof = require('./eth_generate_proof');
const { nearFtBalanceOf, nearFtBalanceOfEth } = require('./near_utils');

const NEAR_KEY_STORE_PATH = process.env.NEAR_KEY_STORE_PATH;
const keyStore = new nearAPI.keyStores.UnencryptedFileSystemKeyStore(NEAR_KEY_STORE_PATH);

async function nearFinaliseDepositFromEth (nearAccount, nearJsonRpc, nearNetwork, depositedToNear, depositTxHash, nearRecipient) {
    const shouldBorshifyProof = true;
    const proof = await Proof.findProof(depositTxHash, shouldBorshifyProof);
    console.log(`The proof was successfully found for txHash=${depositTxHash}`);

    // Init NEAR API
    const near = await nearAPI.connect({
        deps: {
            keyStore,
        },
        nodeUrl: nearJsonRpc,
        networkId: nearNetwork
    });

    const account = await near.account(nearAccount);

    const connector = new nearAPI.Contract(
        account,
        ethereumConfig.nearEvmAccount,
        {
            changeMethods: ['deposit']
        }
    );

    if (nearRecipient && depositedToNear) {
        const initialBalance = await nearFtBalanceOf(nearRecipient, nearJsonRpc, nearNetwork);
        console.log(`Bridged ETH balance of ${nearRecipient} before finalisation of the deposit: ${initialBalance} yoctoNEAR`);
    }
    //TODO: display balances for nETH accounts

    const gas_limit = new BN('300000000000000'); // Gas limit
    const payment_for_storage = new BN('100000000000000000000').mul(new BN('600')); // Attached payment to pay for the storage
    console.log(`Submitting deposit transaction from: ${nearAccount} account`);
    await connector.deposit(proof, gas_limit, payment_for_storage);

    if (nearRecipient && depositedToNear) {
        const finalBalance = await nearFtBalanceOf(nearRecipient, nearJsonRpc, nearNetwork);
        console.log(`Bridged ETH balance of ${nearRecipient} after finalisation of the deposit: ${finalBalance} yoctoNEAR`);
    }
}

exports.nearFinaliseDepositFromEth = nearFinaliseDepositFromEth;
