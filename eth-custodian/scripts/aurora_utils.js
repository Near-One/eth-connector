require('dotenv').config();

const ethereumConfig = require('./json/ethereum-config.json');
const nearAPI = require('near-api-js');
const { serialize: serializeBorsh } = require('near-api-js/lib/utils/serialize');

const NEAR_KEY_STORE_PATH = process.env.NEAR_KEY_STORE_PATH;
// NEAR keystore init
const keyStore = new nearAPI.keyStores.UnencryptedFileSystemKeyStore(NEAR_KEY_STORE_PATH);

const PROVER_ACCOUNT_TESTNET = 'prover.ropsten.testnet';

class BorshInitEthConnectorArgs {
  constructor (initArgs) {
    Object.assign(this, initArgs)
  }
};

const initEthConnectorArgsBorshSchema = new Map([
  [BorshInitEthConnectorArgs, {
    kind: 'struct',
    fields: [
      ['prover_account', 'string'],
      ['eth_custodian_address', 'string'],
    ]
  }]
]);

async function auroraInitEthConnector (nearAccount, nearJsonRpc, nearNetwork) {
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
        }
    );

    const formattedArgs = new BorshInitEthConnectorArgs({
        prover_account: PROVER_ACCOUNT_TESTNET,
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

exports.auroraInitEthConnector = auroraInitEthConnector;
exports.auroraRegisterRelayer = auroraRegisterRelayer;
