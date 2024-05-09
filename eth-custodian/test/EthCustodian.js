const { ethers } = require('hardhat');
const { expect } = require('chai');

const { serialize } = require('rainbow-bridge-lib/rainbow/borsh.js');
const { borshifyOutcomeProof } = require('rainbow-bridge-lib/rainbow/borshify-proof.js');

const SCHEMA = {
  'WithdrawResult': {
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
    let adminAccount;
    let user1;
    let user2;
    let user3;
    let ethRecipientOnNear;
    let minBlockAcceptanceHeight;

    const nearEvmAccount = Buffer.from('v1.eth-connector.testnet');

    beforeEach(async () => {
        [deployerAccount, ethRecipientOnNear, user1, user2, user3] = await ethers.getSigners();

        // Make the deployer admin
        adminAccount = deployerAccount;

        nearProverMockContractFactory = await ethers.getContractFactory('NearProverMock')
        nearProver = await nearProverMockContractFactory
            .connect(adminAccount)
            .deploy();

        // Proofs coming from blocks below this value should be rejected
        minBlockAcceptanceHeight = 1000;

        ethCustodianContractFactory = await ethers.getContractFactory('EthCustodian');
        ethCustodian = await ethCustodianContractFactory
            .connect(adminAccount)
            .deploy(
                nearEvmAccount,
                nearProver.address,
                minBlockAcceptanceHeight,
                adminAccount.address,
                UNPAUSED_ALL);
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
            const options = { value: fee };
            await expect (ethCustodian
                .connect(user1)
                .depositToEVM(ethRecipientOnNear.address, fee, options)
            )
                .to
                .be
                .revertedWith('The fee cannot be bigger than the transferred amount');
        });

        it('Should change the balance of the custodian when calling depositToEVM and emit the Deposited event', async () => {
            const fee = 100;  // wei
            const amountToTransfer = 50000; // wei
            const balanceBefore = ethers.BigNumber.from(await ethers.provider.getBalance(ethCustodian.address));

            // The protocol is `<nearAccount>:<ethRecipientOnNear>`
            const protocolMessage = nearEvmAccount + ':' + String(ethRecipientOnNear.address);
            const options = { value: amountToTransfer };
            await expect(
                ethCustodian
                    .connect(user1)
                    .depositToEVM(ethRecipientOnNear.address, fee, options)
            )
                .to
                .emit(ethCustodian, 'Deposited')
                .withArgs(user1.address, protocolMessage, amountToTransfer, fee);

            const balanceAfter = ethers.BigNumber.from(await ethers.provider.getBalance(ethCustodian.address));
            const balanceDiff = balanceAfter.sub(balanceBefore);
            expect(balanceDiff)
                .to
                .equal(amountToTransfer);
        });

        it('Should change the balance of the custodian when calling depositToNear and emit the Deposited event', async () => {
            const nearRecipientAccountId = 'recipient.near';

            const fee = 100;  // wei
            const amountToTransfer = 50000; // wei
            const balanceBefore = ethers.BigNumber.from(await ethers.provider.getBalance(ethCustodian.address));

            const options = { value: amountToTransfer };
            await expect(
                ethCustodian
                    .connect(user1)
                    .depositToNear(nearRecipientAccountId, fee, options)
            )
                .to
                .emit(ethCustodian, 'Deposited')
                .withArgs(user1.address, nearRecipientAccountId, amountToTransfer, fee);

            const balanceAfter = ethers.BigNumber.from(await ethers.provider.getBalance(ethCustodian.address));
            const balanceDiff = balanceAfter.sub(balanceBefore);
            expect(balanceDiff)
                .to
                .equal(amountToTransfer);
        });
    });

    describe('Withdraw', () => {
        let proof = require('./proof_template_from_testnet.json');
        const proofExecutorId = proof.outcome_proof.outcome.executor_id;
        const proofBlockHeight = 1099;

        beforeEach(async () => {
            const fee = 100;  // wei
            const amountToTransfer = 123000; // wei
            const options = { value: amountToTransfer };
            await ethCustodian
                .connect(user1)
                .depositToEVM(ethRecipientOnNear.address, fee, options);

            // Manually set the executor id to the original one before each call
            proof.outcome_proof.outcome.executor_id = proofExecutorId;
        });

        it('Should revert when the proof producer (nearEvmAccount) differs from the linked one', async () => {
            const amount = 5000; // wei
            proof.outcome_proof.outcome.status.SuccessValue = serialize(SCHEMA, 'WithdrawResult', {
                amount: amount,
                recipient: ethers.utils.arrayify(user2.address),
                ethCustodian: ethers.utils.arrayify(ethCustodian.address),
            }).toString('base64');
            // Manually set the incorrect proof producer
            proof.outcome_proof.outcome.executor_id = 'evm2.near';

            await expect(
                ethCustodian.withdraw(borshifyOutcomeProof(proof), proofBlockHeight)
            )
                .to
                .be
                .revertedWith('Can only withdraw coins from the linked proof producer on Near blockchain');
        });

        it('Should revert when the proof\'s ethCustodian address differs from the current contract', async () => {
            const amount = 5000; // wei
            proof.outcome_proof.outcome.status.SuccessValue = serialize(SCHEMA, 'WithdrawResult', {
                amount: amount,
                recipient: ethers.utils.arrayify(user2.address),
                // Manually setting the incorrect eth custodian address
                ethCustodian: ethers.utils.arrayify("0xabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd"),
            }).toString('base64');

            await expect(
                ethCustodian.withdraw(borshifyOutcomeProof(proof), proofBlockHeight)
            )
                .to
                .be
                .revertedWith('Can only withdraw coins that were expected for the current contract');
        });

        it('Should successfully withdraw and emit the withdrawn event', async () => {
            const amount = 5000; // wei
            proof.outcome_proof.outcome.status.SuccessValue = serialize(SCHEMA, 'WithdrawResult', {
                amount: amount,
                recipient: ethers.utils.arrayify(user2.address),
                ethCustodian: ethers.utils.arrayify(ethCustodian.address),
            }).toString('base64');

            console.log(`User2 address: ${user2.address}`);
            const balanceBefore = ethers.BigNumber.from(await ethers.provider.getBalance(user2.address));

            await expect(
                ethCustodian.withdraw(borshifyOutcomeProof(proof), proofBlockHeight)
            )
                .to
                .emit(ethCustodian, 'Withdrawn')
                .withArgs(user2.address, amount);

            const balanceAfter = ethers.BigNumber.from(await ethers.provider.getBalance(user2.address));
            const balanceDiff = balanceAfter.sub(balanceBefore);

            expect(balanceDiff)
                .to
                .equal(amount)
        });

        it('Should revert when trying to use the same proof twice', async () => {
            const amount = 5000; // wei
            proof.outcome_proof.outcome.status.SuccessValue = serialize(SCHEMA, 'WithdrawResult', {
                amount: amount,
                recipient: ethers.utils.arrayify(user2.address),
                ethCustodian: ethers.utils.arrayify(ethCustodian.address),
            }).toString('base64');

            // Withdraw for the first time
            await ethCustodian.withdraw(borshifyOutcomeProof(proof), proofBlockHeight);

            // Try to withdraw for the second time providing the same proof
            await expect(
                ethCustodian.withdraw(borshifyOutcomeProof(proof), proofBlockHeight)
            )
                .to
                .be
                .revertedWith('The burn event cannot be reused');
        });

        it('Should revert when the proof is coming from the ancient block', async () => {
            const amount = 5000; // wei
            proof.outcome_proof.outcome.status.SuccessValue = serialize(SCHEMA, 'WithdrawResult', {
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
                .revertedWith('Proof is from an ancient block');
        });
    });

    describe('Pausability', () => {
        it('Deposit to Near', async () => {
            const nearRecipientAccountId = 'recipient.near';
            const fee = 100; // wei

            // Let's try to deposit some tokens to Near NEP-141
            // The balance should be changed and the `Deposited` event emitted
            const balanceBefore = ethers.BigNumber.from(await ethers.provider.getBalance(ethCustodian.address));

            // Prepare the 1st TX (should succeed)
            const amountToTransfer = 5000; // wei
            const options = { value: amountToTransfer };
            await expect(
                ethCustodian
                    .connect(user1)
                    .depositToNear(nearRecipientAccountId, fee, options)
            )
                .to
                .emit(ethCustodian, 'Deposited')
                .withArgs(user1.address, nearRecipientAccountId, amountToTransfer, fee);

            const balanceAfter = ethers.BigNumber.from(await ethers.provider.getBalance(ethCustodian.address));
            const balanceDiff = balanceAfter.sub(balanceBefore);
            expect(balanceDiff)
                .to
                .equal(amountToTransfer);

            // Let's pause the DepositToNear method
            await ethCustodian
                .connect(adminAccount)
                .adminPause(PAUSED_DEPOSIT_TO_NEAR);

            const balanceBefore2 = balanceAfter;

            // Prepare the 2nd TX (should revert)
            const amountToTransfer2 = 8000; // wei
            const options2 = { value: amountToTransfer2 };
            await expect(
                ethCustodian
                    .connect(user1)
                    .depositToNear(nearRecipientAccountId, fee, options2)
            )
                .to
                .be
                .reverted;

            const balanceAfter2 = ethers.BigNumber.from(await ethers.provider.getBalance(ethCustodian.address));
            const balanceDiff2 = balanceAfter2.sub(balanceBefore2);
            // The balance should not be changed
            expect(balanceDiff2)
                .to
                .equal(0);

            // Let's unpause all
            await ethCustodian
                .connect(adminAccount)
                .adminPause(UNPAUSED_ALL);

            const balanceBefore3 = balanceAfter2;

            // Prepare the 3rd TX (should succeed)
            const amountToTransfer3 = 2700; // wei
            const options3 = { value: amountToTransfer3 };
            await expect(
                ethCustodian
                    .connect(user1)
                    .depositToNear(nearRecipientAccountId, fee, options3)
            )
                .to
                .emit(ethCustodian, 'Deposited')
                .withArgs(user1.address, nearRecipientAccountId, amountToTransfer3, fee);

            const balanceAfter3 = ethers.BigNumber.from(await ethers.provider.getBalance(ethCustodian.address));
            const balanceDiff3 = balanceAfter3.sub(balanceBefore3);

            expect(balanceDiff3)
                .to
                .equal(amountToTransfer3);
        });

        it('Deposit to EVM', async () => {
            const fee = 100; // wei

            // The protocol is `<nearAccount>:<ethRecipientOnNear>`
            const protocolMessage = nearEvmAccount + ':' + String(ethRecipientOnNear.address);

            // Let's try to deposit some tokens to Near NEP-141
            // The balance should be changed and the `Deposited` event emitted
            const balanceBefore = ethers.BigNumber.from(await ethers.provider.getBalance(ethCustodian.address));

            // Prepare the 1st TX (should suceed)
            const amountToTransfer = 5000; // wei
            const options = { value: amountToTransfer };
            await expect(
                ethCustodian
                    .connect(user1)
                    .depositToEVM(ethRecipientOnNear.address, fee, options)
            )
                .to
                .emit(ethCustodian, 'Deposited')
                .withArgs(user1.address, protocolMessage, amountToTransfer, fee);

            const balanceAfter = ethers.BigNumber.from(await ethers.provider.getBalance(ethCustodian.address));
            const balanceDiff = balanceAfter.sub(balanceBefore);
            expect(balanceDiff)
                .to
                .equal(amountToTransfer);

            // Let's pause the DepositToEVM method
            await ethCustodian
                .connect(adminAccount)
                .adminPause(PAUSED_DEPOSIT_TO_EVM);

            const balanceBefore2 = balanceAfter;

            // Prepare the 2nd tx (should fail)
            const amountToTransfer2 = 8000; // wei
            const options2 = { value: amountToTransfer2 };
            await expect(
                ethCustodian
                    .connect(user1)
                    .depositToEVM(ethRecipientOnNear.address, fee, options2)
            )
                .to
                .be
                .reverted;

            const balanceAfter2 = ethers.BigNumber.from(await ethers.provider.getBalance(ethCustodian.address));
            const balanceDiff2 = balanceAfter2.sub(balanceBefore2);
            // The balance should not be changed
            expect(balanceDiff2)
                .to
                .equal(0);

            // Let's unpause all
            await ethCustodian
                .connect(adminAccount)
                .adminPause(UNPAUSED_ALL);

            const balanceBefore3 = balanceAfter2;

            // Prepare the 3rd tx (should suceed)
            const amountToTransfer3 = 2700; // wei
            const options3 = { value: amountToTransfer3 };
            await expect(
                ethCustodian
                    .connect(user1)
                    .depositToEVM(ethRecipientOnNear.address, fee, options3)
            )
                .to
                .emit(ethCustodian, 'Deposited')
                .withArgs(user1.address, protocolMessage, amountToTransfer3, fee);

            const balanceAfter3 = ethers.BigNumber.from(await ethers.provider.getBalance(ethCustodian.address));
            const balanceDiff3 = balanceAfter3.sub(balanceBefore3);

            expect(balanceDiff3)
                .to
                .equal(amountToTransfer3);
        });

        it('Withdraw method', async () => {
            // Deposit some ETH first
            const amountToTransfer = 12000; // wei
            const fee = 100;  // wei

            const options = { value: amountToTransfer };
            await ethCustodian
                .connect(user1)
                .depositToNear(ethRecipientOnNear.address, fee, options);

            const proof = require('./proof_template_from_testnet.json');
            const proofHeight = 1099;

            // Prepare the 1st TX (should succeed)
            const amountToWithdraw = 5000; // wei
            proof.outcome_proof.outcome.status.SuccessValue = serialize(SCHEMA, 'WithdrawResult', {
                amount: amountToWithdraw,
                recipient: ethers.utils.arrayify(user2.address),
                ethCustodian: ethers.utils.arrayify(ethCustodian.address),
            }).toString('base64');

            const recipientBalanceBefore = ethers.BigNumber.from(await ethers.provider.getBalance(user2.address));

            await expect(
                ethCustodian
                    .connect(user1)
                    .withdraw(borshifyOutcomeProof(proof), proofHeight)
            )
                .to
                .emit(ethCustodian, 'Withdrawn')
                .withArgs(user2.address, amountToWithdraw);

            const recipientBalanceAfter = ethers.BigNumber.from(await ethers.provider.getBalance(user2.address));
            const recipientBalanceDiff = recipientBalanceAfter.sub(recipientBalanceBefore);

            expect(recipientBalanceDiff)
                .to
                .equal(amountToWithdraw);

            // Let's pause the Withdraw method
            await ethCustodian
                .connect(adminAccount)
                .adminPause(PAUSED_WITHDRAW);

            const recipientBalanceBefore2 = ethers.BigNumber.from(await ethers.provider.getBalance(user2.address));

            // Prepare the 2nd TX (should fail)
            let proof2 = proof;
            // Change the receipt_id (to 'AAA..AAA') for the proof2 to make it another proof
            proof2.outcome_proof.outcome.receipt_ids[0] = 'A'.repeat(44);
            // Try to withdraw while it's paused
            await expect(
                ethCustodian
                    .connect(user1)
                    .withdraw(borshifyOutcomeProof(proof2), proofHeight)
            )
                .to
                .be
                .reverted;

            const recipientBalanceAfter2 = ethers.BigNumber.from(await ethers.provider.getBalance(user2.address));
            const recipientBalanceDiff2 = recipientBalanceAfter2.sub(recipientBalanceBefore2);

            expect(recipientBalanceDiff2)
                .to
                .equal(0);

            // Let's unpause all
            await ethCustodian
                .connect(adminAccount)
                .adminPause(UNPAUSED_ALL);

            const recipientBalanceBefore3 = ethers.BigNumber.from(await ethers.provider.getBalance(user2.address));

            // Prepare the 3rd TX (should succeed)
            let proof3 = proof;
            // Change the receipt_id (to 'BBB..BBB') for the proof3 to make it another proof
            proof3.outcome_proof.outcome.receipt_ids[0] = 'B'.repeat(44);
            // Try to withdraw again
            await expect(
                ethCustodian
                    .connect(user1)
                    .withdraw(borshifyOutcomeProof(proof3), proofHeight)
            )
                .to
                .emit(ethCustodian, 'Withdrawn')
                .withArgs(user2.address, amountToWithdraw);

            const recipientBalanceAfter3 = ethers.BigNumber.from(await ethers.provider.getBalance(user2.address));
            const recipientBalanceDiff3 = recipientBalanceAfter3.sub(recipientBalanceBefore3);
            expect(recipientBalanceDiff3)
                .to
                .equal(amountToWithdraw);
        });
    });

    describe('AdminControlled', () => {
        it('Admin account matches', async() => {
            expect(
                await ethCustodian.admin()
            )
                .to
                .be
                .equal(adminAccount.address);
        });

        it('Regular user can not perform admin functions', async() => {
            const recipientBalanceBefore = ethers.BigNumber.from(await ethers.provider.getBalance(user3.address));
            const contractBalanceBefore = ethers.BigNumber.from(await ethers.provider.getBalance(ethCustodian.address));

            const amountToTransfer = 4000; // wei
            // user2 tries to perform `adminSendEth()` to replenish user3 balance
            await expect(
                ethCustodian
                    .connect(user2)
                    .adminSendEth(user3.address, amountToTransfer)
            )
                .to
                .be
                .reverted;

            const recipientBalanceAfter = ethers.BigNumber.from(await ethers.provider.getBalance(user3.address));
            const contractBalanceAfter = ethers.BigNumber.from(await ethers.provider.getBalance(ethCustodian.address));

            expect(recipientBalanceAfter)
                .to
                .be
                .equal(recipientBalanceBefore);
            expect(contractBalanceAfter)
                .to
                .be
                .equal(contractBalanceBefore);

            // Try to pause and unpause
            await expect(ethCustodian.connect(user2).adminPause(PAUSED_DEPOSIT_TO_NEAR)).to.be.reverted;
            await expect(ethCustodian.connect(user2).adminPause(PAUSED_DEPOSIT_TO_EVM)).to.be.reverted;
            await expect(ethCustodian.connect(user2).adminPause(PAUSED_WITHDRAW)).to.be.reverted;
            await expect(ethCustodian.connect(user2).adminPause(UNPAUSED_ALL)).to.be.reverted;
            // ------------------------------------------

            // Try to use adminSstore
            await expect(
                ethCustodian
                    .connect(user2)
                    .adminSstore(0, 1)
            )
                .to
                .be
                .reverted;

            // Try to use adminSstoreWithMask
            await expect(
                ethCustodian
                    .connect(user2)
                    .adminSstoreWithMask(0, 1, ethers.BigNumber.from('0x0000ffff'))
            )
                .to
                .be
                .reverted;

            //TODO: add check for `adminDelegateCall()` though even it's obviously shouldn't work for the regular user
        });

        it('Admin receive eth and transfer eth', async () => {
            const replenishBalanceValue = 1_500_000;

            const options = { value: replenishBalanceValue };
            await ethCustodian
                .connect(adminAccount)
                .adminReceiveEth(options);

            const recipientBalanceBefore = ethers.BigNumber.from(await ethers.provider.getBalance(user2.address));
            const contractBalanceBefore = ethers.BigNumber.from(await ethers.provider.getBalance(ethCustodian.address));

            // Check the contract has the specified balance available
            expect(contractBalanceBefore)
                .to
                .be
                .equal(replenishBalanceValue);

            // Send eth using admin access
            const amountToTransfer = 4000; // wei
            await ethCustodian
                .connect(adminAccount)
                .adminSendEth(user2.address, amountToTransfer);

            const recipientBalanceAfter = ethers.BigNumber.from(await ethers.provider.getBalance(user2.address));
            const contractBalanceAfter = ethers.BigNumber.from(await ethers.provider.getBalance(ethCustodian.address));

            expect(recipientBalanceAfter)
                .to
                .be
                .equal(recipientBalanceBefore.add(amountToTransfer));
            expect(contractBalanceAfter)
                .to
                .be
                .equal(contractBalanceBefore.sub(amountToTransfer));
        });
    });
});
