require('dotenv').config();

const { ethers } = require('hardhat');
const ethereumConfig = require('./json/ethereum-config.json');

const bs58 = require('bs58');
const clientAbi = require('./json/client-abi.json');
const { toBuffer } = require('eth-util-lite');

const { borshifyOutcomeProof } = require('rainbow-bridge-lib/rainbow/borshify-proof.js');

require('path');
require('fs');

const NEAR_KEY_STORE_PATH = process.env.NEAR_KEY_STORE_PATH;

// NEAR keystore init
const nearAPI = require('near-api-js');
const keyStore = new nearAPI.keyStores.UnencryptedFileSystemKeyStore(NEAR_KEY_STORE_PATH);

async function ethFinalizeWithdrawFromNear(provider, nearAccount, nearJsonRpc, nearNetwork, receiptId) {
    console.log(`Finalizing withdraw having receipt: ${receiptId}`);
    console.log(`--------------------------------------------------------------------------------`)
    console.log(`Eth Custodian address: ${ethereumConfig.ethConnectorAddress}`);

    const signerAccount = new ethers.Wallet(process.env.ROPSTEN_PRIVATE_KEY, provider);
    const client = new ethers.Contract(ethereumConfig.clientAddress, clientAbi, signerAccount);

    const ethCustodianContractFactory = await ethers.getContractFactory('EthCustodian');
    const ethCustodian = await ethCustodianContractFactory.attach(ethereumConfig.ethConnectorAddress);

    // Init NEAR API
    const near = await nearAPI.connect({
        deps: {
            keyStore,
        },
        nodeUrl: nearJsonRpc,
        networkId: nearNetwork
    });
    const account = await near.account(nearAccount);

    // Check current NEAR client height
    const clientHeight = Number((await client.bridgeState()).currentHeight);
    console.log(`Current NEAR client height on Ethereum: ${clientHeight}`);
    const clientBlockHashB58 = bs58.encode(
        toBuffer(await client.blockHashes(clientHeight))
    );
    console.log(`Current NEAR client height on Ethereum Block hash: ${clientBlockHashB58}`);

    let proof;
    try {
        proof = await account.connection.provider.sendJsonRpc(
            'light_client_proof',
            {
                type: 'receipt',
                receipt_id: receiptId,
                receiver_id: nearAccount,
                light_client_head: clientBlockHashB58,
            }
        );
    } catch (e) {
        console.log('NEAR client is not synced, please wait a bit more');
        return;
    }

    //console.log(`Proof: ${JSON.stringify(proof)}`);
    const borshProof = borshifyOutcomeProof(proof);

    const accountBalanceBefore = await signerAccount.getBalance();
    console.log(`Account balance before: ${ethers.utils.formatEther(accountBalanceBefore)} ETH`
                + ` (${accountBalanceBefore} wei)`);

    // Send the 'withdraw' transaction
    let withdrawTx;
    try {
        let options = { gasPrice: 1000000000, gasLimit: 700000 };
        withdrawTx = await ethCustodian.withdraw(borshProof, clientHeight, options);
    }
    catch (e) {
        console.log('Because of some reason transaction was not applied as expected.');
        console.log(e);
        return;
    }
    if (!(await provider.waitForTransaction(withdrawTx.hash)).status) {

        console.log('Because of some reason transaction was not applied as expected. Perhaps the execution outcome was already used.');
        return;
    }
    console.log(`Withdraw transaction completed. Hash: ${withdrawTx.hash}`);

    const accountBalanceAfter = await signerAccount.getBalance();
    console.log(`Account balance after: ${ethers.utils.formatEther(accountBalanceAfter)} ETH`
                + ` (${accountBalanceAfter} wei)`);
}

exports.ethFinalizeWithdrawFromNear = ethFinalizeWithdrawFromNear;
