const hre = require('hardhat');

const ethereumConfig = require('./json/ethereum-config.json');

async function main() {
    const [deployerAccount] = await hre.ethers.getSigners();

    console.log(`Deploying proxy with the account: ${deployerAccount.address}`);

    const ethCustodianProxyContractFactory = await hre.ethers.getContractFactory('EthCustodianProxy');
    const proxy = await hre.upgrades.deployProxy(
        ethCustodianProxyContractFactory,
        [ethereumConfig.ethConnectorAddress]
    );

    await proxy.deployed();

    console.log("EthCustodianProxy deployed to:", proxy.address);

    const ethCustodianContractFactory = await hre.ethers.getContractFactory('EthCustodian');
    const ethCustodian = ethCustodianContractFactory.attach(ethereumConfig.ethConnectorAddress);

    const nominateTx = await ethCustodian.nominateAdmin(proxy.address);
    await nominateTx.wait();

    const acceptTx = await ethCustodian.acceptAdmin(proxy.address);
    await acceptTx.wait();

    console.log("Proxy configured as admin of EthCustodian");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
