const { ethers } = require('hardhat');
const { expect } = require('chai');

const { serialize } = require('rainbow-bridge-lib/rainbow/borsh.js');
const { borshifyOutcomeProof } = require('rainbow-bridge-lib/rainbow/borshify-proof.js');

const SCHEMA = {
  'Withdrawn': {
    kind: 'struct', fields: [
      ['amount', 'u128'],
      ['recipient', [20]],
      ['ethCustodian', [20]],
    ]
  }
};

const UNPAUSED_ALL = 0;
const PAUSED_DEPOSIT_TO_EVM = 1 << 0;
const PAUSED_DEPOSIT_TO_NEAR = 1 << 1;
const PAUSED_WITHDRAW = 1 << 2;

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
    let minBlockAcceptanceHeight;

    const nearEvmAccount = Buffer.from('v1.eth-connector.testnet');

    beforeEach(async () => {
        [deployerAccount, ethRecipientOnNear, user2] = await ethers.getSigners();

        // Make the deployer admin
        adminAccount = deployerAccount;

        nearProverMockContractFactory = await ethers.getContractFactory('NearProverMock')
        nearProver = await nearProverMockContractFactory.deploy();

        // Proofs coming from blocks below this value should be rejected
        minBlockAcceptanceHeight = 1000;

        ethCustodianContractFactory = await ethers.getContractFactory('EthCustodian');
        ethCustodian = await ethCustodianContractFactory.deploy(
            nearEvmAccount,
            nearProver.address,
            minBlockAcceptanceHeight,
            adminAccount.address,
            UNPAUSED_ALL);

        const hardhatTestMnemonic = 'test test test test test test test test test test test junk';
        const derivationPathUser1 = 'm/44\'/60\'/0\'/0/5';
        walletUser1 = await ethers.Wallet.fromMnemonic(hardhatTestMnemonic, derivationPathUser1);
    });

    describe('Deployment', () => {
        it('Should revert when prover is zero address', async () => {
            await expect(
                ethCustodianContractFactory.deploy(
                    nearEvmAccount,
                    ethers.constants.AddressZero,
                    minBlockAcceptanceHeight,
                    adminAccount.address,
                    UNPAUSED_ALL)
            )
                .to
                .be
                .revertedWith('Invalid Near prover address');
        });

        it('Should revert when nearEvmAccount is zero address', async () => {
            await expect(
                ethCustodianContractFactory.deploy(
                    Buffer.from(''),
                    nearProver.address,
                    minBlockAcceptanceHeight,
                    adminAccount.address,
                    UNPAUSED_ALL)
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
            const fee = 100;  // wei
            let unsigned_tx = await ethCustodian
                .connect(walletUser1)
                .populateTransaction
                .depositToEVM(ethRecipientOnNear.address, fee);

            unsigned_tx.nonce = await ethers.provider.getTransactionCount(walletUser1.address);
            // Set the value equal to fee. This should fail as the fee should be less than the transferred amount
            unsigned_tx.value = fee;

            const signed_tx = await walletUser1.signTransaction(unsigned_tx);
            await expect(
                ethers.provider.sendTransaction(signed_tx)
            )
                .to
                .be
                .revertedWith('The fee cannot be bigger than the transferred amount');
        });

        it('Should change the balance of the custodian when calling depositToEVM and emit the Deposited event', async () => {
            const fee = 100;  // wei
            let unsigned_tx = await ethCustodian
                .connect(walletUser1)
                .populateTransaction
                .depositToEVM(ethRecipientOnNear.address, fee);

            unsigned_tx.nonce = await ethers.provider.getTransactionCount(walletUser1.address);
            unsigned_tx.value = 50000;

            const balanceBefore = ethers.BigNumber.from(await ethers.provider.getBalance(ethCustodian.address));

            // The protocol is `<nearAccount>:<ethRecipientOnNear>`
            const protocolMessage = nearEvmAccount + ':' + String(ethRecipientOnNear.address);
            const signed_tx = await walletUser1.signTransaction(unsigned_tx);
            await expect(
                ethers.provider.sendTransaction(signed_tx)
            )
                .to
                .emit(ethCustodian, 'Deposited')
                .withArgs(walletUser1.address, protocolMessage, unsigned_tx.value, fee);

            const balanceAfter = ethers.BigNumber.from(await ethers.provider.getBalance(ethCustodian.address));
            const balanceDiff = balanceAfter.sub(balanceBefore);
            await expect(
                balanceDiff
            )
                .to
                .equal(unsigned_tx.value);
        });

        it('Should change the balance of the custodian when calling depositToNear and emit the Deposited event', async () => {
            const nearRecipientAccountId = 'recipient.near';

            const fee = 100;  // wei
            let unsigned_tx = await ethCustodian
                .connect(walletUser1)
                .populateTransaction
                .depositToNear(nearRecipientAccountId, fee);

            unsigned_tx.nonce = await ethers.provider.getTransactionCount(walletUser1.address);
            unsigned_tx.value = 50000;

            const balanceBefore = ethers.BigNumber.from(await ethers.provider.getBalance(ethCustodian.address));

            const signed_tx = await walletUser1.signTransaction(unsigned_tx);
            await expect(
                ethers.provider.sendTransaction(signed_tx)
            )
                .to
                .emit(ethCustodian, 'Deposited')
                .withArgs(walletUser1.address, nearRecipientAccountId, unsigned_tx.value, fee);

            const balanceAfter = ethers.BigNumber.from(await ethers.provider.getBalance(ethCustodian.address));
            const balanceDiff = balanceAfter.sub(balanceBefore);
            await expect(
                balanceDiff
            )
                .to
                .equal(unsigned_tx.value);
        });
    });

    describe('Withdraw', () => {
        let proof = require('./proof_template_from_testnet.json');
        const proofExecutorId = proof.outcome_proof.outcome.executor_id;

        beforeEach(async () => {
            const fee = 100;  // wei
            let unsigned_tx = await ethCustodian
                .connect(walletUser1)
                .populateTransaction
                .depositToEVM(ethRecipientOnNear.address, fee);

            unsigned_tx.nonce = await ethers.provider.getTransactionCount(walletUser1.address);
            unsigned_tx.value = 123000;

            const signed_tx = await walletUser1.signTransaction(unsigned_tx);
            await ethers.provider.sendTransaction(signed_tx)

            // Manually set the executor id to the original one before each call
            proof.outcome_proof.outcome.executor_id = proofExecutorId;
        });

        it('Should revert when the proof producer (nearEvmAccount) differs from the linked one', async () => {
            const amount = 5000;
            proof.outcome_proof.outcome.status.SuccessValue = serialize(SCHEMA, 'Withdrawn', {
                amount: amount,
                recipient: ethers.utils.arrayify(user2.address),
                ethCustodian: ethers.utils.arrayify(ethCustodian.address),
            }).toString('base64');
            // Manually set the incorrect proof producer
            proof.outcome_proof.outcome.executor_id = 'evm2.near';

            await expect(
                ethCustodian.withdraw(borshifyOutcomeProof(proof), 1099)
            )
                .to
                .be
                .revertedWith('Can only withdraw coins from the linked proof producer on Near blockchain');
        });

        it('Should revert when the proof\'s ethCustodian address differs from the current contract', async () => {
            const amount = 5000;
            proof.outcome_proof.outcome.status.SuccessValue = serialize(SCHEMA, 'Withdrawn', {
                amount: amount,
                recipient: ethers.utils.arrayify(user2.address),
                // Manually setting the incorrect eth custodian address
                ethCustodian: ethers.utils.arrayify("0xabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd"),
            }).toString('base64');

            await expect(
                ethCustodian.withdraw(borshifyOutcomeProof(proof), 1099)
            )
                .to
                .be
                .revertedWith('Can only withdraw coins that were expected for the current contract');
        });

        it('Should successfully withdraw and emit the withdrawn event', async () => {
            const amount = 5000;
            proof.outcome_proof.outcome.status.SuccessValue = serialize(SCHEMA, 'Withdrawn', {
                amount: amount,
                recipient: ethers.utils.arrayify(user2.address),
                ethCustodian: ethers.utils.arrayify(ethCustodian.address),
            }).toString('base64');

            console.log(`User2 address: ${user2.address}`);
            const balanceBefore = ethers.BigNumber.from(await ethers.provider.getBalance(user2.address));

            await expect(
                ethCustodian.withdraw(borshifyOutcomeProof(proof), 1099)
            )
                .to
                .emit(ethCustodian, 'Withdrawn')
                .withArgs(user2.address, amount);

            const balanceAfter = ethers.BigNumber.from(await ethers.provider.getBalance(user2.address));
            const balanceDiff = balanceAfter.sub(balanceBefore);

            await expect(
                balanceDiff
            )
                .to
                .equal(amount)
        });

        it('Should revert when trying to use the same proof twice', async () => {
            const amount = 5000;
            proof.outcome_proof.outcome.status.SuccessValue = serialize(SCHEMA, 'Withdrawn', {
                amount: amount,
                recipient: ethers.utils.arrayify(user2.address),
                ethCustodian: ethers.utils.arrayify(ethCustodian.address),
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

        it('Should revert when the proof is coming from the ancient block', async () => {
            const amount = 5000;
            proof.outcome_proof.outcome.status.SuccessValue = serialize(SCHEMA, 'Withdrawn', {
                amount: amount,
                recipient: ethers.utils.arrayify(user2.address),
                ethCustodian: ethers.utils.arrayify(ethCustodian.address),
            }).toString('base64');

            const proofBlockHeight = minBlockAcceptanceHeight - 1;

            await expect(
                ethCustodian.withdraw(borshifyOutcomeProof(proof), proofBlockHeight)
            )
                .to
                .be
                .revertedWith('Proof is from the ancient block');
        });
    });
});
