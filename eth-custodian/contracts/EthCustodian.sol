pragma solidity ^0.6;
import "rainbow-bridge/contracts/eth/nearprover/contracts/INearProver.sol";
import "rainbow-bridge/contracts/eth/nearprover/contracts/ProofDecoder.sol";
import "rainbow-bridge/contracts/eth/nearbridge/contracts/Borsh.sol";

contract EthCustodian {
    using Borsh for Borsh.Data;
    using ProofDecoder for Borsh.Data;

    INearProver public prover_;
    bytes public nearEvm_;

    // OutcomeReciptId -> Used
    mapping(bytes32 => bool) public usedEvents_;

    event Locked (
        address indexed sender,
        uint256 amount,
        uint256 fee,
        address ethRecipientOnNear,
    );

    event Unlocked (
        uint128 amount,
        address recipient
    );

    // Function output from burning fungible token on Near side.
    struct BurnResult {
        uint128 amount;
        address recipient;
    }

    // EthLocker is linked to the bridge token factory on NEAR side.
    // It also links to the prover that it uses to unlock the tokens.
    constructor(bytes memory nearEvm, INearProver prover, address admin) public {
        require(nearEvm.length > 0, "Invalid Near EVM address");
        require(address(prover) != address(0), "Invalid Near prover");

        nearEvm_ = nearEvm;
        prover_ = prover;
        admin_ = admin;
    }

    /// Deposits the specified amount of provided ETH (except from the relayer's fee) into the smart contract.
    /// `ethRecipientOnNear` - the ETH address of recipient in NEAR EVM
    /// `fee` - the amount of fee that will be paid to the near-relayer in nETH.
    function deposit(address ethRecipientOnNear, uint256 fee) payable external {
        require(fee < msg.value, "The fee cannot be bigger than the transferred amount.");
        emit Locked(msg.sender, msg.value - fee, fee, ethRecipientOnNear);
    }

    /// Withdraws the appropriate amount of ETH which is encoded in `proofData`
    function withdraw(bytes memory proofData, uint64 proofBlockHeight) external {
        ProofDecoder.ExecutionStatus memory status = _parseAndConsumeProof(proofData, proofBlockHeight);
        BurnResult memory result = _decodeBurnResult(status.successValue);
        address(this).transfer(result.recipient, result.amount);
        emit Unlocked(result.amount, result.recipient);
    }

    function _parseAndConsumeProof(bytes memory proofData, uint64 proofBlockHeight)
        internal
        returns (ProofDecoder.ExecutionStatus memory result)
    {
        require(prover_.proveOutcome(proofData, proofBlockHeight), "Proof should be valid");

        // Unpack the proof and extract the execution outcome.
        Borsh.Data memory borshData = Borsh.from(proofData);
        ProofDecoder.FullOutcomeProof memory fullOutcomeProof = borshData.decodeFullOutcomeProof();
        require(borshData.finished(), "Argument should be exact borsh serialization");

        bytes32 receiptId = fullOutcomeProof.outcome_proof.outcome_with_id.outcome.receipt_ids[0];
        require(!usedEvents_[receiptId], "The burn event cannot be reused");
        usedEvents_[receiptId] = true;

        require(keccak256(fullOutcomeProof.outcome_proof.outcome_with_id.outcome.executor_id) == keccak256(nearTokenFactory_),
                "Can only unlock tokens from the linked mintable fungible token on Near blockchain.");

        result = fullOutcomeProof.outcome_proof.outcome_with_id.outcome.status;
        require(!result.failed, "Cannot use failed execution outcome for unlocking the tokens.");
        require(!result.unknown, "Cannot use unknown execution outcome for unlocking the tokens.");
    }

    function _decodeBurnResult(bytes memory data) internal pure returns (BurnResult memory result) {
        Borsh.Data memory borshData = Borsh.from(data);
        result.amount = borshData.decodeU128();
        bytes20 recipient = borshData.decodeBytes20();
        result.recipient = address(uint160(recipient));
    }

    address public admin_;

    modifier onlyAdmin {
        require(msg.sender == admin_);
        _;
    }

    function adminTransfer(IERC20 token, address destination, uint amount) public onlyAdmin {
        token.safeTransfer(destination, amount);
    }

    function adminDelegatecall(address target, bytes memory data) public onlyAdmin returns(bytes memory) {
        (bool success, bytes memory rdata) = target.delegatecall(data);
        require(success);
        return rdata;
    }
}
