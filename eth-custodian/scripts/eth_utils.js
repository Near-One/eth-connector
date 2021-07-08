require('dotenv').config();

const ethereumConfig = require('./json/ethereum-config.json');

const handleError = () => {
  return undefined;
};

async function getErc20TokenMetadata(ethersProvider, erc20TokenAddress,) {
    const metadataAbi = [
        'function name() view returns (string name)',
        'function symbol() view returns (string symbol)',
        'function decimals() view returns (uint8 decimals)',
    ];

    const address = ethers.utils.getAddress(erc20TokenAddress);
    const contract = new ethers.Contract(address, metadataAbi, ethersProvider);

    const [name, symbol, decimals] = await Promise.all([
        contract.name().catch(handleError),
        contract.symbol().catch(handleError),
        contract.decimals().catch(handleError),
    ]);

    return { decimals, name, symbol };
}

exports.getErc20TokenMetadata = getErc20TokenMetadata;
