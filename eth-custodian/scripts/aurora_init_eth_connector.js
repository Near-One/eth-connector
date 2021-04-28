const ethereumConfig = require('./json/ethereum-config.json');

const { serialize: serializeBorsh } = require('near-api-js/lib/utils/serialize');

class BorshInitEthConnectorArgs {
  constructor (initArgs) {
    Object.assign(this, initArgs)
  }
};

const initEthConnectorArgsBorshSchema = new Map([
  [BorshInitCallArgs, {
    kind: 'struct',
    fields: [
      ['prover_account', 'AccountId'],
      ['eth_custodian_address', ['AccountId']],
    ]
  }]
]);

const PROVER_ACCOUNT_TESTNET = 'prover.ropsten.testnet';

// NEAR keystore init
const nearAPI = require('near-api-js');
const keyStore = new nearAPI.keyStores.UnencryptedFileSystemKeyStore(NEAR_KEY_STORE_PATH);

async function evmInitEthConnector (nearAccount, nearJsonRpc, nearNetwork) {
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
        eth_custodian_address: ethereumConfig.ethConnectorAddress,
    });
    const borshCallArgs = serializeBorsh(initEthConnectorArgsBorshSchema, formattedArgs);

    await aurora.new_eth_connector(borshCallArgs);
    console.log('Gotcha!');
}

exports.evmInitEthConnector = evmInitEthConnector;

