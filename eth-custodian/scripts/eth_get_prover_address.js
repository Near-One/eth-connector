const hre = require('hardhat');

const erc20ConnectorAbi = require('./json/erc20-connector.json');
const erc20ConnectorAddress = '0xc115851ca60aed2ccc6ee3d5343f590834e4a3ab';


// Gets the prover address from the deployed ERC20Connector with the provided address
async function main() {
    console.log(`Erc20 Connector address: ${erc20ConnectorAddress}`);

    [deployerAccount] = await ethers.getSigners();

    // Connect to Erc20Connector to get the prover address
    const erc20Connector = new hre.ethers.Contract(erc20ConnectorAddress, erc20ConnectorAbi, deployerAccount);
    const proverAddress = await erc20Connector.prover();

    console.log(`Prover address: ${proverAddress}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
