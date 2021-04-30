require('dotenv').config();

const ethereumConfig = require('./json/ethereum-config.json');

const { ethers } = require('hardhat');
const nearAPI = require('near-api-js');
const { serialize: serializeBorsh } = require('near-api-js/lib/utils/serialize');

const { hexToBytes } = require('./misc_utils');

const NEAR_KEY_STORE_PATH = process.env.NEAR_KEY_STORE_PATH;
const keyStore = new nearAPI.keyStores.UnencryptedFileSystemKeyStore(NEAR_KEY_STORE_PATH);


class BorshArgs {
  constructor (args) {
    Object.assign(this, args)
  }
};

const ftBalanceOfSchema = new Map([
  [BorshArgs, {
    kind: 'struct',
    fields: [
      ['account_id', 'string'],
    ]
  }]
]);

const ftBalanceOfEthSchema = new Map([
  [BorshArgs, {
    kind: 'struct',
    fields: [
      ['address', ['u8']],
    ]
  }]
]);

async function nearFtBalanceOf(nearAccount, nearJsonRpc, nearNetwork) {
    const near = await nearAPI.connect({
        deps: {
            keyStore
        },
        nodeUrl: nearJsonRpc,
        networkId: nearNetwork
    });

    const account = await near.account(nearAccount);

    const nearEvmContract = new nearAPI.Contract(
        account,
        ethereumConfig.nearEvmAccount,
        {
            changeMethods: ['ft_balance_of'],
        }
    );

    const args = new BorshArgs({
        account_id: nearAccount.toString()
    });

    const serializedArgs = serializeBorsh(ftBalanceOfSchema, args);

    const accountBalance = await nearEvmContract.ft_balance_of(serializedArgs);
    return Number(accountBalance);
}

async function nearFtBalanceOfEth(nearAccount, nearJsonRpc, nearNetwork, ethAddress) {
    const near = await nearAPI.connect({
        deps: {
            keyStore
        },
        nodeUrl: nearJsonRpc,
        networkId: nearNetwork
    });

    const account = await near.account(nearAccount);

    const nearEvmContract = new nearAPI.Contract(
        account,
        ethereumConfig.nearEvmAccount,
        {
            changeMethods: ['ft_balance_of_eth'],
        }
    );

    //console.log(`Address in bytes: ${hexToBytes(ethAddress)} len: ${hexToBytes(ethAddress).length}`);
    const args = new BorshArgs({
        address: hexToBytes(ethAddress.replace('0x', ''))
    });

    const serializedArgs = serializeBorsh(ftBalanceOfEthSchema, args);
    //console.log(`Serialized args: ${serializedArgs} len: ${serializedArgs.length}`);

    const accountBalance = await nearEvmContract.ft_balance_of_eth(serializedArgs);
    return Number(accountBalance);
}

exports.nearFtBalanceOf = nearFtBalanceOf;
exports.nearFtBalanceOfEth = nearFtBalanceOfEth;
