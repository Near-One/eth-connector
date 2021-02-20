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

describe('ProofKeeper contract', () => {
    let nearProverMockContractFactory;
    let nearProver;
    let proofKeeperContractFactory;
    let proofKeeper;
    let ethRecipient;

    const nearProofProducerAccount = Buffer.from('evm.near');

    beforeEach(async () => {
        [ethRecipient] = await ethers.getSigners();

        nearProverMockContractFactory = await ethers.getContractFactory('NearProverMock')
        nearProver = await nearProverMockContractFactory.deploy();

        proofKeeperContractFactory = await ethers.getContractFactory('ProofKeeperInheritorMock');
        proofKeeper = await proofKeeperContractFactory.deploy(nearProofProducerAccount, nearProver.address);
    });

    describe('Deployment', () => {
        it('Should revert when prover is zero address', async () => {
            await expect(
                proofKeeperContractFactory.deploy(nearProofProducerAccount, ethers.constants.AddressZero)
            )
                .to
                .be
                .revertedWith('Invalid Near prover address');
        });

        it('Should revert when nearProofProducerAccount is zero address', async () => {
            await expect(
                proofKeeperContractFactory.deploy(Buffer.from(''), nearProver.address)
            )
                .to
                .be
                .revertedWith('Invalid Near ProofProducer address');
        });

    });

    describe('Parse and Consume proof', () => {
        let proof = require('./proof_template.json');
        let proofBlockHeight;
        let serializedProof;

        beforeEach(async() => {
            let amount = 1000;
            proof.outcome_proof.outcome.status.SuccessValue = serialize(SCHEMA, 'Withdrawn', {
                recipient: ethers.utils.arrayify(ethRecipient.address),
                amount: amount,
            }).toString('base64');
            proofBlockHeight = 1099

            // Manually set the executor id to the original one before each call
            proof.outcome_proof.outcome.executor_id = nearProofProducerAccount;
            serializedProof = borshifyOutcomeProof(proof);
        });

        it('Should revert when the proof is invalid', async () => {
            // Create negative prover mock which always rejects proofs
            let nearNegativeProverMockContractFactory = await ethers.getContractFactory('NearNegativeProverMock')
            let nearNegativeProver = await nearNegativeProverMockContractFactory.deploy();
            let proofKeeperWithNegativeMockProver
                = await proofKeeperContractFactory.deploy(nearProofProducerAccount, nearNegativeProver.address);

            await expect(
                proofKeeperWithNegativeMockProver.parseAndConsumeProof(serializedProof, proofBlockHeight)
            )
                .to
                .be
                .revertedWith('Proof should be valid');
        });

        it('Should revert when trying to use the same proof twice', async () => {
            await proofKeeper.parseAndConsumeProof(serializedProof, proofBlockHeight);

            await expect(
                proofKeeper.parseAndConsumeProof(serializedProof, proofBlockHeight)
            )
                .to
                .be
                .revertedWith('The burn event cannot be reused');
        });

        it('Should revert when the proof producer differs from the linked one', async () => {
            // Manually set the incorrect proof producer
            proof.outcome_proof.outcome.executor_id = 'evm2.near';
            serializedProof = borshifyOutcomeProof(proof);

            await expect(
                proofKeeper.parseAndConsumeProof(serializedProof, proofBlockHeight)
            )
                .to
                .be
                .revertedWith('Can only unlock tokens from the linked proof producer on Near blockchain');
        });
    });
});
