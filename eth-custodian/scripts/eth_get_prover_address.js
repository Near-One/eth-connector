const hre = require('hardhat');

const erc20ConnectorAbi = require('./json/erc20-connector.json');
const erc20ConnectorAddress = '0xa5289b6d5dcc13e48f2cc6382256e51589849f86';


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
