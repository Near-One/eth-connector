pragma solidity ^0.6.12;

import "rainbow-bridge/contracts/eth/nearprover/contracts/ProofDecoder.sol";
import "rainbow-bridge/contracts/eth/nearbridge/contracts/Borsh.sol";

import { INearProver, ProofKeeper } from "./ProofKeeper.sol";

contract EthCustodian is ProofKeeper {
    event Deposited (
        address indexed sender,
        address indexed ethRecipientOnNear,
        uint256 amount,
        uint256 fee
    );

    event Withdrawn(
        address indexed recipient,
        uint128 amount
    );

    // Function output from burning nETH on Near side.
    struct BurnResult {
        uint128 amount;
        address recipient;
    }

    /// EthCustodian is linked to the EVM on NEAR side.
    /// It also links to the prover that it uses to withdraw the tokens.
    constructor(bytes memory nearEvm, INearProver prover, uint64 minBlockAcceptanceHeight, address _admin)
        ProofKeeper(nearEvm, prover, minBlockAcceptanceHeight)
        public
    {
        admin = _admin;
    }

    /// Deposits the specified amount of provided ETH (except from the relayer's fee) into the smart contract.
    /// `ethRecipientOnNear` - the ETH address of recipient in NEAR EVM
    /// `fee` - the amount of fee that will be paid to the near-relayer in nETH.
    function deposit(address ethRecipientOnNear, uint256 fee)
        external
        payable
    {
        require(fee < msg.value, "The fee cannot be bigger than the transferred amount.");
        emit Deposited(msg.sender, ethRecipientOnNear, msg.value, fee);
    }

    /// Withdraws the appropriate amount of ETH which is encoded in `proofData`
    function withdraw(bytes calldata proofData, uint64 proofBlockHeight) external
    {
        ProofDecoder.ExecutionStatus memory status = _parseAndConsumeProof(proofData, proofBlockHeight);
        BurnResult memory result = _decodeBurnResult(status.successValue);
        payable(result.recipient).transfer(result.amount);
        emit Withdrawn(result.recipient, result.amount);
    }

    function _decodeBurnResult(bytes memory data)
        internal
        pure
        returns (BurnResult memory result)
    {
        Borsh.Data memory borshData = Borsh.from(data);
        bytes20 recipient = borshData.decodeBytes20();
        result.amount = borshData.decodeU128();
        result.recipient = address(uint160(recipient));
    }

    address public admin;

    modifier onlyAdmin {
        require(msg.sender == admin);
        _;
    }

    function adminTransfer(address payable destination, uint amount)
        public
        onlyAdmin
    {
        destination.transfer(amount);
    }

    function adminDelegatecall(address target, bytes memory data)
        public
        onlyAdmin
        returns (bytes memory)
    {
        (bool success, bytes memory rdata) = target.delegatecall(data);
        require(success);
        return rdata;
    }
}
