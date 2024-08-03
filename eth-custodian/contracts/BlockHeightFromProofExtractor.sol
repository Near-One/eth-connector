// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8;

import "rainbow-bridge-sol/nearbridge/contracts/Borsh.sol";

library BlockHeightFromProofExtractor {
    using Borsh for Borsh.Data;
    using BlockHeightFromProofExtractor for Borsh.Data;

    function skipNBytes(Borsh.Data memory data, uint skipBytesCount) internal pure {
        data.requireSpace(skipBytesCount);
        unchecked {
            data.ptr += skipBytesCount;
        }
    }

    function skipArray(Borsh.Data memory data, uint32 itemSizeInBytes) internal pure {
        uint32 itemsCount = data.decodeU32();
        uint32 skipBytesCount = itemsCount * itemSizeInBytes;

        data.skipNBytes(skipBytesCount);
    }

    function skipBytesArray(Borsh.Data memory data) internal pure {
        uint32 itemCount = data.decodeU32();
        for (uint32 i = 0; i < itemCount; i++) {
            data.skipBytes();
        }
    }

    function skipMerklePath(Borsh.Data memory data) internal pure {
        uint32 MerklePathItemSize = 32 + 1;
        data.skipArray(MerklePathItemSize);
    }

    function skipExecutionStatus(Borsh.Data memory data) internal pure {
        uint8 enumIndex = data.decodeU8();
        if (enumIndex == 2) {
            data.skipBytes();
        } else if (enumIndex == 3) {
            data.skipNBytes(32);
        }
    }

    function skipExecutionOutcomeWithIdAndProof(Borsh.Data memory data) internal pure  {
        //proof
        data.skipMerklePath();

        //block_hash(bytes32) + outcome.id(bytes32)
        data.skipNBytes(32 + 32);

        //logs
        data.skipBytesArray();

        //receipt_ids(bytes32[])
        data.skipArray(32);

        //gas_burnt(uint64) + tokens_burnt(uint128)
        data.skipNBytes(8 + 16);

        //executor_id
        data.skipBytes();

        data.skipExecutionStatus();
    }

    function getBlockHeightFromProof(bytes calldata proofData) internal pure returns(uint64) {
        Borsh.Data memory data = Borsh.from(proofData);

        //outcome_proof
        data.skipExecutionOutcomeWithIdAndProof();

        //outcome_root_proof
        data.skipMerklePath();

        // prev_block_hash(bytes32) + inner_rest_hash(bytes32)
        data.skipNBytes(32 + 32);

        return data.decodeU64();
    }
}
