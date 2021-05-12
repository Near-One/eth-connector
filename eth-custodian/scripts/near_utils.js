require('dotenv').config();

const ethereumConfig = require('./json/ethereum-config.json');

const { ethers } = require('hardhat');
const nearAPI = require('near-api-js');
const { serialize: serializeBorsh } = require('near-api-js/lib/utils/serialize');

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

exports.nearFtBalanceOf = nearFtBalanceOf;
exports.nearFtBalanceOfEth = nearFtBalanceOfEth;
