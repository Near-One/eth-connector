const hre = require('hardhat');

const ethereumConfig = require('./json/ethereum-config.json');

const UNPAUSED_ALL = 0;

async function main() {
    [deployerAccount] = await ethers.getSigners();

    console.log(`Deploying contracts with the account: ${deployerAccount.address}`);

    const accountBalance = await deployerAccount.getBalance();
    console.log(`Account balance: ${accountBalance} wei`);
    console.log(`Account balance: ${ethers.utils.formatEther(accountBalance)} ETH`);

    // Make the deployer admin
    const adminAccount = deployerAccount;

    console.log(`Prover address: ${ethereumConfig.proverAddress}`);

    //const nearProverMockContractFactory = await hre.ethers.getContractFactory('NearProverMock')
    //const nearProver = await nearProverMockContractFactory.deploy();

    const nearEvmAccount = Buffer.from(ethereumConfig.nearEvmAccount);
    console.log(`Near EVM account: ${nearEvmAccount.toString()}`);

    // Proofs coming from blocks below this value should be rejected
    const minBlockAcceptanceHeight = 0;
    console.log(`Minimum block acceptance height: ${minBlockAcceptanceHeight}`);

    const ethCustodianContractFactory = await hre.ethers.getContractFactory('EthCustodian');
    const ethCustodian = await ethCustodianContractFactory.deploy(
        nearEvmAccount,
        ethereumConfig.proverAddress,
        minBlockAcceptanceHeight,
        adminAccount.address,
        UNPAUSED_ALL);

    await ethCustodian.deployed();

    console.log("EthCustodian deployed to:", ethCustodian.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
