// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8;

import 'rainbow-bridge/contracts/eth/nearprover/contracts/ProofDecoder.sol';

import { INearProver, ProofKeeper } from '../ProofKeeper.sol';

contract ProofKeeperInheritorMock is ProofKeeper {
    constructor(
        bytes memory nearProofProducerAccount,
        INearProver prover,
        uint64 minBlockAcceptanceHeight
    )
        ProofKeeper(nearProofProducerAccount, prover, minBlockAcceptanceHeight)
    {
    }

    function parseAndConsumeProof(
        bytes memory proofData,
        uint64 blockHeight
    )
        public
    {
        _parseAndConsumeProof(proofData, blockHeight);
    }
}
