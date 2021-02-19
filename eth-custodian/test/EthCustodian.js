const { BN, constants } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;

const { ethers } = require('hardhat');
const { expect } = require('chai');

const { serialize } = require('rainbow-bridge-lib/rainbow/borsh.js');
const { borshifyOutcomeProof } = require('rainbow-bridge-lib/rainbow/borshify-proof.js');

//const NearProverMock = artifacts.require('test/NearProverMock')

//const { toWei, fromWei, hexToBytes } = web3.utils;


describe('EthCustodian contract', () => {
    let nearProverMockContractFactory;
    let nearProver;
    let ethCustodianContractFactory;
    let ethCustodian;
    let deployerAccount;
    let adminAccount;
    let walletUser1;
    let ethRecipientOnNear;

    const nearEvmAccount = Buffer.from('evm.near');

    beforeEach(async () => {
        [deployerAccount, ethRecipientOnNear] = await ethers.getSigners();

        // Make the deployer admin
        adminAccount = deployerAccount;

        nearProverMockContractFactory = await ethers.getContractFactory('NearProverMock')
        nearProver = await nearProverMockContractFactory.deploy();

        ethCustodianContractFactory = await ethers.getContractFactory('EthCustodian');
        ethCustodian = await ethCustodianContractFactory.deploy(nearEvmAccount, nearProver.address, adminAccount.address);

        let hardhatTestMnemonic = 'test test test test test test test test test test test junk';
        let derivationPathUser1 = 'm/44\'/60\'/0\'/0/5';
        walletUser1 = await ethers.Wallet.fromMnemonic(hardhatTestMnemonic, derivationPathUser1);
    });

    describe('Deployment', () => {
        // TODO move this test to ProofKeeper tests
        it('Should revert when prover is zero address', async () => {
            await expect(
                ethCustodianContractFactory.deploy(nearEvmAccount, ZERO_ADDRESS, adminAccount.address)
            )
                .to
                .be
                .revertedWith('Invalid Near prover address');
        });

        // TODO move this test to ProofKeeper tests
        it('Should revert when nearEvmAccount is zero address', async () => {
            await expect(
                ethCustodianContractFactory.deploy(Buffer.from(''), nearProver.address, adminAccount.address)
            )
                .to
                .be
                .revertedWith('Invalid Near ProofProducer address');
        });

        it('Should set the right admin', async () => {
            expect(
                await ethCustodian.admin()
            )
                .to
                .equal(adminAccount.address);
        });
    });

    describe('Deposit', () => {
        it('Should revert when the provided fee is bigger than the transferred amount', async () => {
            let fee = 100;  // wei
            let unsigned_tx = await ethCustodian
                .connect(walletUser1)
                .populateTransaction
                .deposit(ethRecipientOnNear.address, fee);

            unsigned_tx.nonce = await ethers.provider.getTransactionCount(walletUser1.address);
            unsigned_tx.value = 100;

            let signed_tx = await walletUser1.signTransaction(unsigned_tx);
            await expect(
                ethers.provider.sendTransaction(signed_tx)
            )
                .to
                .be
                .revertedWith('The fee cannot be bigger than the transferred amount');
        });

        it('Should change the balance of the custodian and emit the deposited event', async () => {
            let fee = 100;  // wei
            let unsigned_tx = await ethCustodian
                .connect(walletUser1)
                .populateTransaction
                .deposit(ethRecipientOnNear.address, fee);

            unsigned_tx.nonce = await ethers.provider.getTransactionCount(walletUser1.address);
            unsigned_tx.value = 50000;

            let balanceBefore = await ethers.provider.getBalance(ethCustodian.address);

            let signed_tx = await walletUser1.signTransaction(unsigned_tx);
            await expect(
                ethers.provider.sendTransaction(signed_tx)
            )
                .to
                .emit(ethCustodian, 'Deposited')
                .withArgs(walletUser1.address, ethRecipientOnNear.address, unsigned_tx.value, 100);

            let balanceAfter = await ethers.provider.getBalance(ethCustodian.address);
            await expect(
                balanceAfter
            )
                .to
                .equal(balanceBefore + unsigned_tx.value);
        });
    });

});
