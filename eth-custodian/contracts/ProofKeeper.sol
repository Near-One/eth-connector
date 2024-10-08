// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8;

import 'rainbow-bridge-sol/nearprover/contracts/INearProver.sol';
import 'rainbow-bridge-sol/nearprover/contracts/ProofDecoder.sol';
import 'rainbow-bridge-sol/nearbridge/contracts/Borsh.sol';

contract ProofKeeper {
    using Borsh for Borsh.Data;
    using ProofDecoder for Borsh.Data;

    INearProver public prover_;
    bytes public nearProofProducerAccount_;

    /// Proofs from blocks that are below the acceptance height will be rejected.
    // If `minBlockAcceptanceHeight` value is zero - proofs from block with any height are accepted.
    uint64 public minBlockAcceptanceHeight_;

    // OutcomeReciptId -> Used
    mapping(bytes32 => bool) public usedEvents_;

    constructor(
        bytes memory _nearProofProducerAccount,
        INearProver _prover,
        uint64 _minBlockAcceptanceHeight
    )
    {
        require(
            _nearProofProducerAccount.length > 0,
            'Invalid Near ProofProducer address'
        );
        require(
            address(_prover) != address(0),
            'Invalid Near prover address'
        );

        nearProofProducerAccount_ = _nearProofProducerAccount;
        prover_ = _prover;
        minBlockAcceptanceHeight_ = _minBlockAcceptanceHeight;
    }

    /// Parses the provided proof and consumes it if it's not already used.
    /// The consumed event cannot be reused for future calls.
    function _parseAndConsumeProof(
        bytes memory proofData, 
        uint64 proofBlockHeight
    )
        internal
        returns(ProofDecoder.ExecutionStatus memory result)
    {
        require(
            proofBlockHeight >= minBlockAcceptanceHeight_,
            'Proof is from an ancient block'
        );
        require(
            prover_.proveOutcome(proofData,proofBlockHeight),
            'Proof should be valid'
        );

        // Unpack the proof and extract the execution outcome.
        Borsh.Data memory borshData = Borsh.from(proofData);

        ProofDecoder.FullOutcomeProof memory fullOutcomeProof = borshData.decodeFullOutcomeProof();
        borshData.done();

        bytes32 receiptId = fullOutcomeProof.outcome_proof.outcome_with_id.outcome.receipt_ids[0];

        require(
            !usedEvents_[receiptId],
            'The burn event cannot be reused'
        );
        usedEvents_[receiptId] = true;

        require(
            keccak256(fullOutcomeProof.outcome_proof.outcome_with_id.outcome.executor_id) == 
            keccak256(nearProofProducerAccount_),
            'Can only withdraw coins from the linked proof producer on Near blockchain'
        );

        result = fullOutcomeProof.outcome_proof.outcome_with_id.outcome.status;
        require(
            !result.failed, 
            'Cannot use failed execution outcome for unlocking the tokens'
        );
        require(
            !result.unknown,
            'Cannot use unknown execution outcome for unlocking the tokens'
        );
    }
}
