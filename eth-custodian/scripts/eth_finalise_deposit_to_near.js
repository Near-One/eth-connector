require('dotenv').config();

const ethereumConfig = require('./json/ethereum-config.json');

const { BN } = require('bn.js');
const Proof = require('./eth_generate_proof');
const NEAR_KEY_STORE_PATH = process.env.NEAR_KEY_STORE_PATH;

// NEAR keystore init
const nearAPI = require('near-api-js');
const keyStore = new nearAPI.keyStores.UnencryptedFileSystemKeyStore(NEAR_KEY_STORE_PATH);

async function ethFinaliseDepositToNear (nearAccount, nearJsonRpc, nearNetwork, depositedToNear, depositTxHash, nearRecipient) {
    const shouldBorshifyProof = false;
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
            viewMethods: ['ft_balance_of'],
            changeMethods: ['deposit']
        }
    );

    if (nearRecipient) {
        const initialBalance = await connector.ft_balance_of({ 'account_id': nearRecipient });
        console.log(`Bridged ETH balance of ${nearRecipient} before finalisation of the deposit: ${initialBalance}`);
    }

    const gas_limit = new BN('300000000000000'); // Gas limit
    const payment_for_storage = new BN('100000000000000000000').mul(new BN('600')); // Attached payment to pay for the storage
    console.log(`Submitting deposit transaction from: ${nearAccount} account`);
    if (depositedToNear) {
        await connector.deposit({'proof': proof});//, 'gas': gas_limit, 'storage': payment_for_storage});
    } else {
        await connector.deposit(proof);//, gas_limit, payment_for_storage);
    }

    if (nearRecipient) {
        const finalBalance = await connector.ft_balance_of({ 'account_id': nearRecipient });
        console.log(`Bridged ETH balance of ${nearRecipient} after finalisation of the deposit: ${finalBalance}`);
    }
}

exports.ethFinaliseDepositToNear = ethFinaliseDepositToNear;
