require('dotenv').config();

const ethereumConfig = require('./json/ethereum-config.json');
const { BN } = require('bn.js');
const nearAPI = require('near-api-js');
const { serialize: serializeBorsh } = require('near-api-js/lib/utils/serialize');

const NEAR_KEY_STORE_PATH = process.env.NEAR_KEY_STORE_PATH;
// NEAR keystore init
const keyStore = new nearAPI.keyStores.UnencryptedFileSystemKeyStore(NEAR_KEY_STORE_PATH);


class BorshArgs {
  constructor (initArgs) {
    Object.assign(this, initArgs)
  }
};

const initEthConnectorArgsBorshSchema = new Map([
  [BorshArgs, {
    kind: 'struct',
    fields: [
      ['prover_account', 'string'],
      ['eth_custodian_address', 'string'],
    ]
  }]
]);

const nep141TokenArgsBorshSchema = new Map([
  [BorshArgs, {
    kind: 'struct',
    fields: [
      ['nep141', 'string'],
    ]
  }]
]);

const functionCallArgsBorshSchema = new Map([
    [BorshArgs, {
        kind: 'struct',
        fields: [
            ['contract', [20]],
            ['input', ['u8']],
        ]
    }]
]);

async function auroraInitEthConnector (nearAccount, nearJsonRpc, nearNetwork, proverAccount) {
    console.log(`Aurora-engine: ${ethereumConfig.nearEvmAccount}. Initializing ETH-connector with following values:\
                \nProver account: ${proverAccount}; EthCustodian address: ${ethereumConfig.ethConnectorAddress}.`);

    // Init NEAR API
    const near = await nearAPI.connect({
        deps: {
            keyStore,
        },
        nodeUrl: nearJsonRpc,
        networkId: nearNetwork
    });

    const account = await near.account(nearAccount);

    const aurora = new nearAPI.Contract(
        account,
        ethereumConfig.nearEvmAccount,
        {
            changeMethods: ['new_eth_connector']
            //changeMethods: ['set_eth_connector_contract_data']
        }
    );

    const formattedArgs = new BorshArgs({
        prover_account: proverAccount,
        eth_custodian_address: ethereumConfig.ethConnectorAddress.replace('0x', ''),
    });
    const borshCallArgs = serializeBorsh(initEthConnectorArgsBorshSchema, formattedArgs);

    await aurora.new_eth_connector(borshCallArgs);
}

async function auroraRegisterRelayer (nearAccount, nearJsonRpc, nearNetwork, relayerAddressInAurora) {
    relayerAddressInAurora = ethers.utils.getAddress(relayerAddressInAurora);

    // Init NEAR API
    const near = await nearAPI.connect({
        deps: {
            keyStore,
        },
        nodeUrl: nearJsonRpc,
        networkId: nearNetwork
    });

    const account = await near.account(nearAccount);

    const aurora = new nearAPI.Contract(
        account,
        ethereumConfig.nearEvmAccount,
        {
            changeMethods: ['register_relayer']
        }
    );

    const args = ethers.utils.arrayify(relayerAddressInAurora);
    await aurora.register_relayer(args);
}

async function auroraMakeItRain(nearAccount, nearJsonRpc, nearNetwork, rainReceiverAddress) {
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
            changeMethods: ['make_it_rain'],
        }
    );

    const address = ethers.utils.arrayify(ethers.utils.getAddress(rainReceiverAddress));
    await nearEvmContract.make_it_rain(address);
}

async function auroraNewState(nearAccount, nearJsonRpc, nearNetwork, chain_id, owner_id, bridge_owner_id) {
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
            changeMethods: ['new'],
        }
    );

    //const address = ethers.utils.arrayify(ethers.utils.getAddress(rainReceiverAddress));
    //await nearEvmContract.new(address);
}

async function auroraDeployErc20Token(nearAccount, nearJsonRpc, nearNetwork, bridgedTokenAccountId) {
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
            changeMethods: ['deploy_erc20_token'],
        }
    );

    const formattedArgs = new BorshArgs({
        nep141: bridgedTokenAccountId,
    });
    const borshCallArgs = serializeBorsh(nep141TokenArgsBorshSchema, formattedArgs);
    const gas_limit = new BN('100' + '0'.repeat(12)); // Gas limit
    const payment_for_storage = new BN('0'); // Attached payment to pay for the storage
    await nearEvmContract.deploy_erc20_token(borshCallArgs, gas_limit, payment_for_storage);

    const tokenAddressInAurora = auroraGetErc20FromNep141(nearAccount, nearJsonRpc, nearNetwork, bridgedTokenAccountId);

    return tokenAddressInAurora;
}

async function auroraGetErc20FromNep141(nearAccount, nearJsonRpc, nearNetwork, bridgedTokenAccountId) {
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
            viewMethods: ['get_erc20_from_nep141'],
        }
    );

    const formattedArgs = new BorshArgs({
        nep141: bridgedTokenAccountId,
    });
    const borshCallArgs = serializeBorsh(nep141TokenArgsBorshSchema, formattedArgs);

    const tokenAddressInAurora
        = await nearEvmContract.get_erc20_from_nep141(borshCallArgs.slice(4), options = { parse: parseToHex });
    return tokenAddressInAurora;
}

async function auroraGetNep141FromErc20(nearAccount, nearJsonRpc, nearNetwork, erc20TokenAddressInAurora) {
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
            // temporarily use this as a change method until near-api-js is fixed
            changeMethods: ['get_nep141_from_erc20'],
        }
    );

    const erc20Address = ethers.utils.getAddress(erc20TokenAddressInAurora);
    const nep141Address = await nearEvmContract.get_nep141_from_erc20(ethers.utils.arrayify(erc20Address));
    return nep141Address;
}

async function auroraSetErc20Metadata(nearAccount, nearJsonRpc, nearNetwork, erc20TokenAddressInAurora, erc20Name, erc20Symbol, erc20Decimals) {
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
            changeMethods: ['call'],
        }
    );

    const handleError = () => {
        return undefined;
    };

    const evmErc20Abi = [
        'function setMetadata(string memory metadata_name, string memory metadata_symbol, uint8 metadata_decimals)'
    ];

    const address = ethers.utils.getAddress(erc20TokenAddressInAurora);
    const contract = new ethers.Contract(address, evmErc20Abi, ethers.getDefaultProvider());
    const unsignedTx = await contract
        .populateTransaction
        .setMetadata(erc20Name, erc20Symbol, erc20Decimals);

    console.log(`UnsignedTx: ${JSON.stringify(unsignedTx)}`);

    const formattedArgs = new BorshArgs({
        contract: ethers.utils.arrayify(address),
        input: ethers.utils.arrayify(unsignedTx.data),
    });
    const borshCallArgs = serializeBorsh(functionCallArgsBorshSchema, formattedArgs);
    const gas_limit = new BN('300' + '0'.repeat(12)); // Gas limit
    const payment_for_storage = new BN('0'); // Attached payment to pay for the storage

    const res = await nearEvmContract.call(borshCallArgs, gas_limit, payment_for_storage);
    console.log(JSON.stringify(res));
}

function parseToHex(data) {
    return Buffer.from(data, 'base64').toString('hex');
}

exports.auroraInitEthConnector = auroraInitEthConnector;
exports.auroraRegisterRelayer = auroraRegisterRelayer;
exports.auroraMakeItRain = auroraMakeItRain;
exports.auroraDeployErc20Token = auroraDeployErc20Token;
exports.auroraGetErc20FromNep141 = auroraGetErc20FromNep141;
exports.auroraGetNep141FromErc20 = auroraGetNep141FromErc20;
exports.auroraSetErc20Metadata = auroraSetErc20Metadata;
