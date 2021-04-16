// Sources flattened with hardhat v2.0.10 https://hardhat.org

// File rainbow-bridge/contracts/eth/nearprover/contracts/INearProver.sol@v1.0.0

pragma solidity ^0.6;

interface INearProver {
    function proveOutcome(bytes calldata proofData, uint64 blockHeight) external view returns(bool);
}


// File contracts/test/NearProverMock.sol

pragma solidity ^0.6.12;

contract NearProverMock is INearProver {
    function proveOutcome(bytes memory proofData, uint64 blockHeight) override public view returns(bool) {
        return true;
    }
}

contract NearNegativeProverMock is INearProver {
    function proveOutcome(bytes memory proofData, uint64 blockHeight) override public view returns(bool) {
        return false;
    }
}
