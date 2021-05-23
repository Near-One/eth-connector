// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8;

import 'rainbow-bridge/contracts/eth/nearprover/contracts/INearProver.sol';

contract NearProverMock is INearProver {
    function proveOutcome(
        bytes memory, // proofData
        uint64 // blockHeight
    )
        public
        pure
        override
        returns(bool)
    {
        return true;
    }
}

contract NearNegativeProverMock is INearProver {
    function proveOutcome(
        bytes memory, // proofData
        uint64 // blockHeight
    )
        public
        pure
        override
        returns(bool)
    {
        return false;
    }
}
