const hre = require('hardhat');

async function deployEthProxy(ethereumConfig) {
    const [deployerAccount] = await hre.ethers.getSigners();

    console.log(`Deploying proxy with the account: ${deployerAccount.address}`);

    const ethCustodianProxyContractFactory = await hre.ethers.getContractFactory('EthCustodianProxy');
    const proxy = await hre.upgrades.deployProxy(
        ethCustodianProxyContractFactory,
        [ethereumConfig.ethConnectorAddress]
    );

    await proxy.waitForDeployment();

    console.log("EthCustodianProxy deployed to:", await proxy.getAddress());

    console.log(`Next, proxy must be made the admin of EthCustodian. The existing admin needs to first call nominateAdmin and then acceptAdmin on EthCustodian passing the proxy address`);
}

exports.deployEthProxy = deployEthProxy;
