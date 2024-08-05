const hre = require('hardhat');
const ethereumConfig = require("./json/ethereum-config.json");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log("Upgrading contracts with the account:", signer.address);
  console.log(
    "Account balance:",
    (await signer.provider.getBalance(signer.address)).toString()
  );

  const EthCustodianProxy = (
    await hre.ethers.getContractFactory("EthCustodianProxy")
  ).connect(signer);

  const proxyAddress = ethereumConfig.proxyAddress;
  console.log(
    "Current implementation address:",
    await hre.upgrades.erc1967.getImplementationAddress(proxyAddress)
  );
  console.log(
    "Upgrade EthCustodianProxy contract, proxy address",
    proxyAddress
  );
  const proxy = await hre.upgrades.upgradeProxy(
    proxyAddress,
    EthCustodianProxy,
    {
      gasLimit: 6000000,
    }
  );
  await proxy.waitForDeployment();

  console.log(
    "EthCustodianProxy impl deployed to: ",
    await hre.upgrades.erc1967.getImplementationAddress(
      await proxy.getAddress()
    )
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
