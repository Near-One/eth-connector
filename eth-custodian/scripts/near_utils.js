require('dotenv').config();

const ethereumConfig = require('./json/ethereum-config.json');

const { ethers } = require('hardhat');
const nearAPI = require('near-api-js');
const { serialize: serializeBorsh } = require('near-api-js/lib/utils/serialize');

const NEAR_KEY_STORE_PATH = process.env.NEAR_KEY_STORE_PATH;
const keyStore = new nearAPI.keyStores.UnencryptedFileSystemKeyStore(NEAR_KEY_STORE_PATH);

class BorshObject {
  constructor (obj) {
    Object.assign(this, obj)
  }
};

const logIndexBorshSchema = new Map([
  [BorshObject, {
    kind: 'struct',
    fields: [
      ['log_index', 'u64'],
    ]
  }]
]);

const receiptIndexBorshSchema = new Map([
  [BorshObject, {
    kind: 'struct',
    fields: [
      ['receipt_index', 'u64'],
    ]
  }]
]);

const pausedFlagsBorshSchema = new Map([
  [BorshObject, {
    kind: 'struct',
    fields: [
      ['paused', 'u8'],
    ]
  }]
]);

async function nearFtBalanceOf(nearAccount, nearJsonRpc, nearNetwork, queryNearAccount) {
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
            viewMethods: ['ft_balance_of'],
        }
    );

    const accountBalance = await nearEvmContract.ft_balance_of({ account_id: queryNearAccount.toString() });
    return ethers.BigNumber.from(accountBalance.toString());
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

    const address = ethers.utils.arrayify(ethers.utils.getAddress(ethAddress));

    const accountBalance = await nearEvmContract.ft_balance_of_eth(address);
    return ethers.BigNumber.from(accountBalance.toString());
}

async function nearSetPausedFlags(nearAccount, nearJsonRpc, nearNetwork, _pausedFlags) {
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
            changeMethods: ['set_paused_flags'],
        }
    );

    const pausedFlags = new BorshObject({ paused: 0 });
    await nearEvmContract.set_paused_flags(serializeBorsh(pausedFlagsBorshSchema, pausedFlags));

    console.log(`Successfully set paused flags`);
}

async function nearCheckIfProofExists(nearAccount, nearJsonRpc, nearNetwork, proof) {
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
            changeMethods: ['is_used_proof'],
        }
    );

    const res = await nearEvmContract.is_used_proof(proof);
    console.log(`Res: ${JSON.stringify(res)}`);
}


exports.nearFtBalanceOf = nearFtBalanceOf;
exports.nearFtBalanceOfEth = nearFtBalanceOfEth;
exports.nearSetPausedFlags = nearSetPausedFlags;
exports.nearCheckIfProofExists = nearCheckIfProofExists;
