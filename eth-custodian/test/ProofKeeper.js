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

describe('ProofKeeper contract', () => {
    let nearProverMockContractFactory;
    let nearProver;
    let proofKeeperContractFactory;
    let proofKeeper;
    let ethRecipient;
    let minBlockAcceptanceHeight;

    const nearProofProducerAccount = Buffer.from('v1.eth-connector.testnet');

    beforeEach(async () => {
        [ethRecipient] = await ethers.getSigners();

        nearProverMockContractFactory = await ethers.getContractFactory('NearProverMock')
        nearProver = await nearProverMockContractFactory.deploy();

        // Proofs coming from blocks below this value should be rejected
        minBlockAcceptanceHeight = 1000;

        proofKeeperContractFactory = await ethers.getContractFactory('ProofKeeperInheritorMock');
        proofKeeper = await proofKeeperContractFactory.deploy(nearProofProducerAccount, await nearProver.getAddress(), minBlockAcceptanceHeight);
    });

    describe('Deployment', () => {
        it('Should revert when prover is zero address', async () => {
            await expect(
                proofKeeperContractFactory.deploy(nearProofProducerAccount, ethers.ZeroAddress, minBlockAcceptanceHeight)
            )
                .to
                .be
                .revertedWith('Invalid Near prover address');
        });

        it('Should revert when nearProofProducerAccount is zero address', async () => {
            await expect(
                proofKeeperContractFactory.deploy(Buffer.from(''), await nearProver.getAddress(), minBlockAcceptanceHeight)
            )
                .to
                .be
                .revertedWith('Invalid Near ProofProducer address');
        });
    });

    describe('Parse and Consume proof', () => {
        let proof = require('./proof_template_from_testnet.json');
        let proofBlockHeight;
        let serializedProof;

        beforeEach(async() => {
            let amount = 1000;
            proof.outcome_proof.outcome.status.SuccessValue = serialize(SCHEMA, 'Withdrawn', {
                amount: amount,
                recipient: ethers.getBytes(ethRecipient.address),
                ethCustodian: ethers.getBytes("0xabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd"),
            }).toString('base64');
            proofBlockHeight = 1099

            // Manually set the executor id to the original one before each call
            proof.outcome_proof.outcome.executor_id = nearProofProducerAccount;
            serializedProof = borshifyOutcomeProof(proof);
        });

        it('Should revert when the proof is coming from an ancient block', async () => {
            proofBlockHeight = 999;

            await expect(
                proofKeeper.parseAndConsumeProof(serializedProof, proofBlockHeight)
            )
                .to
                .be
                .revertedWith('Proof is from an ancient block');
        });

        it('Should revert when the proof is invalid', async () => {
            // Create negative prover mock which always rejects proofs
            let nearNegativeProverMockContractFactory = await ethers.getContractFactory('NearNegativeProverMock')
            let nearNegativeProver = await nearNegativeProverMockContractFactory.deploy();
            let proofKeeperWithNegativeMockProver
                = await proofKeeperContractFactory.deploy(nearProofProducerAccount, await nearNegativeProver.getAddress(), minBlockAcceptanceHeight);

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
                .revertedWith('Can only withdraw coins from the linked proof producer on Near blockchain');
        });
    });
});
