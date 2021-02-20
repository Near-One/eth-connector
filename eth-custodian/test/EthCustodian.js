const { ethers } = require('hardhat');
const { expect } = require('chai');

const { serialize } = require('rainbow-bridge-lib/rainbow/borsh.js');
const { borshifyOutcomeProof } = require('rainbow-bridge-lib/rainbow/borshify-proof.js');

const SCHEMA = {
  'Withdrawn': {
    kind: 'struct', fields: [
      ['recipient', [20]],
      ['amount', 'u128'],
    ]
  }
};

describe('EthCustodian contract', () => {
    let nearProverMockContractFactory;
    let nearProver;
    let ethCustodianContractFactory;
    let ethCustodian;
    let deployerAccount;
    let adminAccount;
    let walletUser1;
    let user2;
    let ethRecipientOnNear;

    const nearEvmAccount = Buffer.from('evm.near');

    beforeEach(async () => {
        [deployerAccount, ethRecipientOnNear, user2] = await ethers.getSigners();

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
                ethCustodianContractFactory.deploy(nearEvmAccount, ethers.constants.AddressZero, adminAccount.address)
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
            // Set the value equal to fee. This should fail as the fee should be less than the transferred amount
            unsigned_tx.value = fee;

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

            let balanceBefore = ethers.BigNumber.from(await ethers.provider.getBalance(ethCustodian.address));

            let signed_tx = await walletUser1.signTransaction(unsigned_tx);
            await expect(
                ethers.provider.sendTransaction(signed_tx)
            )
                .to
                .emit(ethCustodian, 'Deposited')
                .withArgs(walletUser1.address, ethRecipientOnNear.address, unsigned_tx.value, 100);

            let balanceAfter = ethers.BigNumber.from(await ethers.provider.getBalance(ethCustodian.address));
            let balanceDiff = balanceAfter.sub(balanceBefore);
            await expect(
                balanceDiff
            )
                .to
                .equal(unsigned_tx.value);
        });
    });

    describe('Withdraw', () => {
        let proof = require('./proof_template.json');
        const proofExecutorId = proof.outcome_proof.outcome.executor_id;

        beforeEach(async () => {
            let fee = 100;  // wei
            let unsigned_tx = await ethCustodian
                .connect(walletUser1)
                .populateTransaction
                .deposit(ethRecipientOnNear.address, fee);

            unsigned_tx.nonce = await ethers.provider.getTransactionCount(walletUser1.address);
            unsigned_tx.value = 123000;

            let signed_tx = await walletUser1.signTransaction(unsigned_tx);
            await ethers.provider.sendTransaction(signed_tx)

            // Manually set the executor id to the original one before each call
            proof.outcome_proof.outcome.executor_id = proofExecutorId;
        });

        it('Should revert when the proof producer (nearEvmAccount) differs from the linked one', async () => {
            let amount = 5000;
            proof.outcome_proof.outcome.status.SuccessValue = serialize(SCHEMA, 'Withdrawn', {
                recipient: ethers.utils.arrayify(user2.address),
                amount: amount,
            }).toString('base64');
            // Manually set the incorrect proof producer
            proof.outcome_proof.outcome.executor_id = 'evm2.near';

            await expect(
                ethCustodian.withdraw(borshifyOutcomeProof(proof), 1099)
            )
                .to
                .be
                .revertedWith('Can only unlock tokens from the linked proof producer on Near blockchain');
        });

        it('Should successfully withdraw and emit the withdrawn event', async () => {
            let amount = 5000;
            proof.outcome_proof.outcome.status.SuccessValue = serialize(SCHEMA, 'Withdrawn', {
                recipient: ethers.utils.arrayify(user2.address),
                amount: amount,
            }).toString('base64');

            let balanceBefore = ethers.BigNumber.from(await ethers.provider.getBalance(user2.address));

            await expect(
                ethCustodian.withdraw(borshifyOutcomeProof(proof), 1099)
            )
                .to
                .emit(ethCustodian, 'Withdrawn')
                .withArgs(user2.address, amount);

            let balanceAfter = ethers.BigNumber.from(await ethers.provider.getBalance(user2.address));
            let balanceDiff = balanceAfter.sub(balanceBefore);

            await expect(
                balanceDiff
            )
                .to
                .equal(amount)
        });

        it('Should revert when trying to use the same proof twice', async () => {
            let amount = 5000;
            proof.outcome_proof.outcome.status.SuccessValue = serialize(SCHEMA, 'Withdrawn', {
                recipient: ethers.utils.arrayify(user2.address),
                amount: amount,
            }).toString('base64');

            // Withdraw for the first time
            await ethCustodian.withdraw(borshifyOutcomeProof(proof), 1099);

            // Try to withdraw for the second time providing the same proof
            await expect(
                ethCustodian.withdraw(borshifyOutcomeProof(proof), 1099)
            )
                .to
                .be
                .revertedWith('The burn event cannot be reused');
        });
    });
});
