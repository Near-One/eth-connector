const hre = require('hardhat');

async function updateAdminProxy(ethereumConfig, newAdmin) {
    const privateKey = hre.network.config.accounts[0];
    const signerWallet = new hre.ethers.Wallet(privateKey, hre.ethers.provider);

    console.log(`Update admin proxy with the account: ${signerWallet.address}`);

    const ethCustodianProxyContractFactory = await hre.ethers.getContractFactory('EthCustodianProxy');
    const ethCustodianProxy = await ethCustodianProxyContractFactory.attach(ethereumConfig.proxyAddress);

    console.log(`EthCustodian Proxy address: ${await ethCustodianProxy.getAddress()}`);

    let tx_grant_admin = await ethCustodianProxy
        .connect(signerWallet)
        .grantRole("0x0000000000000000000000000000000000000000000000000000000000000000", newAdmin);
    console.log(`Grant Admin Role for ${newAdmin} Tx Hash: ${tx_grant_admin.hash}`);

    let tx_grant_pausable = await ethCustodianProxy
        .connect(signerWallet)
        .grantRole("0x1e1db0d9c63b4a23ec134ff71a2f56610c32f638cbff81e96e14734c4daf0b4d", newAdmin);
    console.log(`Grant Pausable Admin Role for ${newAdmin} Tx Hash: ${tx_grant_pausable.hash}`);

    let tx_revoke_pausable = await ethCustodianProxy
        .connect(signerWallet)
        .revokeRole("0x1e1db0d9c63b4a23ec134ff71a2f56610c32f638cbff81e96e14734c4daf0b4d", signerWallet.address);
    console.log(`Revoke Pausable Admin Role for ${signerWallet.address} Tx Hash: ${tx_revoke_pausable.hash}`);
}

exports.updateAdminProxy = updateAdminProxy;
