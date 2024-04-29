const { ethers } = require('hardhat');
const { expect } = require('chai');
const { serialize } = require('rainbow-bridge-lib/rainbow/borsh.js');
const { borshifyOutcomeProof } = require('rainbow-bridge-lib/rainbow/borshify-proof.js');

const UNPAUSED_ALL = 0;
const PAUSED_DEPOSIT_TO_EVM = 1 << 0;
const PAUSED_DEPOSIT_TO_NEAR = 1 << 1;
const PAUSED_WITHDRAW = 1 << 2;
const PAUSED_WITHDRAW_PRE_MIGRATION = 1 << 3;
const PAUSED_ALL = PAUSED_DEPOSIT_TO_EVM | PAUSED_DEPOSIT_TO_NEAR | PAUSED_WITHDRAW | PAUSED_WITHDRAW_PRE_MIGRATION;

const SCHEMA = {
  'Withdrawn': {
    kind: 'struct', fields: [
      ['amount', 'u128'],
      ['recipient', [20]],
      ['ethCustodian', [20]],
    ]
  }
};

describe('EthCustodianProxy contract', () => {
    let ethCustodian;
    let ethCustodianProxy;
    let nearProver;

    let adminAccount;
    let ethRecipientOnNear;
    let user1;
    let user2;

    const nearEvmAccount = Buffer.from('v1.eth-connector.testnet');
    const newProofProducerData = Buffer.from('new-producer.testnet');
    const migrationBlock = 19672697;

    beforeEach(async () => {
        [adminAccount, ethRecipientOnNear, user1, user2] = await ethers.getSigners();

        const nearProverMockContractFactory = await ethers.getContractFactory('NearProverMock')
        nearProver = await nearProverMockContractFactory
            .connect(adminAccount)
            .deploy();

        const ethCustodianContractFactory = await ethers.getContractFactory('EthCustodian');
        ethCustodian = await ethCustodianContractFactory
            .connect(adminAccount)
            .deploy(
                nearEvmAccount,
                nearProver.address,
                0,
                adminAccount.address,
                UNPAUSED_ALL);

        const ethCustodianProxyContractFactory = await ethers.getContractFactory('EthCustodianProxy');
        ethCustodianProxy = await upgrades.deployProxy(
            ethCustodianProxyContractFactory,
            [ethCustodian.address]
        );

        const nominateTx = await ethCustodian.nominateAdmin(ethCustodianProxy.address);
        await nominateTx.wait();
    
        const acceptTx = await ethCustodian.acceptAdmin(ethCustodianProxy.address);
        await acceptTx.wait();

        const pauseTx = await ethCustodianProxy.pauseImpl(PAUSED_ALL);
        await pauseTx.wait();
    });

    describe('EthCustodian', () => {
        it('Should be paused', async () => {
            const paused = await ethCustodian.paused();

            expect(paused & PAUSED_DEPOSIT_TO_EVM).to.not.equal(0);
            expect(paused & PAUSED_DEPOSIT_TO_NEAR).to.not.equal(0);
            expect(paused & PAUSED_WITHDRAW).to.not.equal(0);
        });
    });

    describe('Deposit', () => {
        it('to EVM Should change the balance and emit the event', async () => {
            const amountToTransfer = 50000;
            const balanceBefore = ethers.BigNumber.from(
                await ethers.provider.getBalance(ethCustodian.address));

            const protocolMessage = nearEvmAccount + ':' + String(ethRecipientOnNear.address);
            const options = { value: amountToTransfer };
            await expect(
                ethCustodianProxy
                    .connect(user1)
                    .depositToEVM(ethRecipientOnNear.address, options)
            )
                .to.emit(ethCustodian, 'Deposited')
                .withArgs(ethCustodianProxy.address, protocolMessage, amountToTransfer, 0);

            const balanceAfter = ethers.BigNumber.from(
                await ethers.provider.getBalance(ethCustodian.address));
            const balanceDiff = balanceAfter.sub(balanceBefore);
            expect(balanceDiff).to.equal(amountToTransfer);
        });

        it('to Near Should change the balance and emit the event', async () => {
            const nearRecipientAccountId = 'recipient.near';

            const amountToTransfer = 50000;
            const balanceBefore = ethers.BigNumber.from(
                await ethers.provider.getBalance(ethCustodian.address));

            const options = { value: amountToTransfer };
            await expect(
                ethCustodianProxy
                    .connect(user1)
                    .depositToNear(nearRecipientAccountId, options)
            )
                .to.emit(ethCustodian, 'Deposited')
                .withArgs(ethCustodianProxy.address, nearRecipientAccountId, amountToTransfer, 0);

            const balanceAfter = ethers.BigNumber.from(
                await ethers.provider.getBalance(ethCustodian.address));
            const balanceDiff = balanceAfter.sub(balanceBefore);
            expect(balanceDiff).to.equal(amountToTransfer);
        });
    });

    describe('Pause', () => {
        it('Should pause deposit to NEAR', async () => {
            await ethCustodianProxy.pauseProxy(PAUSED_DEPOSIT_TO_NEAR);

            await expect(ethCustodianProxy.depositToNear('recipient.near', { value: 50000 }))
                .to.be.revertedWith('Pausable: paused');
        });

        it('Should pause deposit to EVM', async () => {
            await ethCustodianProxy.pauseProxy(PAUSED_DEPOSIT_TO_EVM);

            await expect(ethCustodianProxy.depositToEVM(ethRecipientOnNear.address, { value: 50000 }))
                .to.be.revertedWith('Pausable: paused');
        });

        it('Should pause withdraw', async () => {
            await ethCustodianProxy.migrateToNewProofProducer(newProofProducerData, migrationBlock);
            await ethCustodianProxy.pauseProxy(PAUSED_WITHDRAW);
            const proof = require('./proof_template_from_testnet.json');

            await expect(ethCustodianProxy.withdraw(borshifyOutcomeProof(proof), migrationBlock + 1))
                .to.be.revertedWith('Pausable: paused');
        });

        it('Should pause withdraw pre-migration', async () => {
            await ethCustodianProxy.migrateToNewProofProducer(newProofProducerData, migrationBlock);
            await ethCustodianProxy.pauseProxy(PAUSED_WITHDRAW_PRE_MIGRATION);
            const proof = require('./proof_template_from_testnet.json');

            await expect(ethCustodianProxy.withdraw(borshifyOutcomeProof(proof), 1099))
                .to.be.revertedWith('Pausable: paused');
        });

        it('Should pause all', async () => {
            await ethCustodianProxy.migrateToNewProofProducer(newProofProducerData, migrationBlock);
            await ethCustodianProxy.pauseAll();

            await expect(ethCustodianProxy.depositToNear('recipient.near', { value: 50000 }))
                .to.be.revertedWith('Pausable: paused');

            await expect(ethCustodianProxy.depositToEVM(ethRecipientOnNear.address, { value: 50000 }))
                .to.be.revertedWith('Pausable: paused');

            const proof = require('./proof_template_from_testnet.json');

            await expect(ethCustodianProxy.withdraw(borshifyOutcomeProof(proof), 1099))
                .to.be.revertedWith('Pausable: paused');

            await expect(ethCustodianProxy.withdraw(borshifyOutcomeProof(proof), migrationBlock + 1))
                .to.be.revertedWith('Pausable: paused');
        });
    });

    describe('Migrate', () => {
        it('Should change proof producer for EthCustodian', async () => {
            const oldProofProducer = await ethCustodian.nearProofProducerAccount_();

            await ethCustodianProxy.migrateToNewProofProducer(newProofProducerData, migrationBlock);

            expect(await ethCustodianProxy.migrationBlockHeight())
                .to.equal(migrationBlock);

            expect(await ethCustodianProxy.preMigrationProducerAccount())
                .to.equal(oldProofProducer);

            expect(await ethCustodian.nearProofProducerAccount_())
                .to.equal('0x' + newProofProducerData.toString('hex'));
        });

        it('Should fail when invoked for the second time', async () => {
            await ethCustodianProxy.migrateToNewProofProducer(newProofProducerData, migrationBlock);
            
            await expect(ethCustodianProxy.migrateToNewProofProducer(newProofProducerData, migrationBlock))
                .to.be.revertedWith('AlreadyMigrated');
        });

        it('Should fail when block producer id is too long', async () => {            
            await expect(
                ethCustodianProxy.migrateToNewProofProducer(Buffer.from('new-loooooooong-producer.testnet'), migrationBlock)
            )
                .to.be.revertedWith('ProducerAccountIdTooLong');
        });
    });

    describe('Withdraw', () => {
        const amount = 5000;
        const proof = require('./proof_template_from_testnet.json');

        beforeEach(async () => {
            await ethCustodianProxy
                .connect(user1)
                .depositToEVM(ethRecipientOnNear.address, { value: 200000 });

            await ethCustodianProxy.migrateToNewProofProducer(newProofProducerData, migrationBlock);

            proof.outcome_proof.outcome.status.SuccessValue = serialize(SCHEMA, 'Withdrawn', {
                amount: amount,
                recipient: ethers.utils.arrayify(user2.address),
                ethCustodian: ethers.utils.arrayify(ethCustodian.address),
            }).toString('base64');
        });

        it('Should successfully withdraw and emit the event post-migration', async () => {
            const postMigrationProof = structuredClone(proof);
            postMigrationProof.outcome_proof.outcome.executor_id = 'new-producer.testnet';

            const proofProducerBefore = await ethCustodian.nearProofProducerAccount_();
            const balanceBefore = ethers.BigNumber.from(
                await ethers.provider.getBalance(user2.address));

            await expect(
                ethCustodianProxy.withdraw(borshifyOutcomeProof(postMigrationProof), migrationBlock + 1)
            )
                .to.emit(ethCustodian, 'Withdrawn')
                .withArgs(user2.address, amount);

            const proofProducerAfter = await ethCustodian.nearProofProducerAccount_();
            const balanceAfter = ethers.BigNumber.from(
                await ethers.provider.getBalance(user2.address));
            const balanceDiff = balanceAfter.sub(balanceBefore);

            expect(proofProducerBefore).to.equal(proofProducerAfter);
            expect(balanceDiff).to.equal(amount)
        });
        
        it('Should successfully withdraw and emit the event pre-migration', async () => {
            const balanceBefore = ethers.BigNumber.from(await ethers.provider.getBalance(user2.address));

            await expect(
                ethCustodianProxy.withdraw(borshifyOutcomeProof(proof), 1099)
            )
                .to.emit(ethCustodian, 'Withdrawn')
                .withArgs(user2.address, amount);

            const balanceAfter = ethers.BigNumber.from(await ethers.provider.getBalance(user2.address));
            const balanceDiff = balanceAfter.sub(balanceBefore);

            expect(balanceDiff).to.equal(amount)
        });
    });

    describe('callImpl', () => {
        it('Should change the admin of the implementation', async () => {
            const implInterface = new ethers.utils.Interface(['function nominateAdmin(address)', 'function acceptAdmin(address)']);
            
            const nominate = implInterface.encodeFunctionData('nominateAdmin', [user2.address]);
            const nominateTx = await ethCustodianProxy.callImpl(nominate);
            await nominateTx.wait();

            const accept = implInterface.encodeFunctionData('acceptAdmin', [user2.address]);
            const acceptTx = await ethCustodianProxy.callImpl(accept);
            await acceptTx.wait();

            expect(await ethCustodian.admin()).to.equal(user2.address);
        });

        it('Should fail when called by non-admin', async () => {
            const implInterface = new ethers.utils.Interface(['function nominateAdmin(address)']);
            
            const nominate = implInterface.encodeFunctionData('nominateAdmin', [user2.address]);
            await expect(ethCustodianProxy.connect(user2).callImpl(nominate))
                .to.be.revertedWith('AccessControlUnauthorizedAccount');
        });
    });
});