pragma solidity ^0.6.12;

import "rainbow-bridge/contracts/eth/nearprover/contracts/ProofDecoder.sol";

import { INearProver, ProofKeeper } from "../ProofKeeper.sol";

contract ProofKeeperInheritorMock is ProofKeeper {
    constructor(bytes memory nearProofProducerAccount, INearProver prover)
        ProofKeeper(nearProofProducerAccount, prover)
        public
    {
    }

    function parseAndConsumeProof(bytes memory proofData, uint64 blockHeight)
        public
    {
        _parseAndConsumeProof(proofData, blockHeight);
    }
}
