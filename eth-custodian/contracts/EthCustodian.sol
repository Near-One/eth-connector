pragma solidity ^0.6.12;

import "rainbow-bridge/contracts/eth/nearprover/contracts/ProofDecoder.sol";
import "rainbow-bridge/contracts/eth/nearbridge/contracts/Borsh.sol";

import { INearProver, ProofKeeper } from "./ProofKeeper.sol";

contract EthCustodian is ProofKeeper {
    event Deposited (
        address indexed sender,
        string recipient,
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
        address ethCustodian;
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
    /// `ethRecipientOnNear` - the ETH address of the recipient in NEAR EVM
    /// `fee` - the amount of fee that will be paid to the near-relayer in nETH.
    function depositToEVM(string memory ethRecipientOnNear, uint256 fee)
        external
        payable
    {
        require(fee < msg.value, "The fee cannot be bigger than the transferred amount.");

        string memory separator = ":";
        string memory protocolMessage = string(abi.encodePacked(string(nearProofProducerAccount_), separator, ethRecipientOnNear));

        emit Deposited(msg.sender, protocolMessage, msg.value, fee);
    }

    /// Deposits the specified amount of provided ETH (except from the relayer's fee) into the smart contract.
    /// `nearRecipientAccountId` - the AccountID of the recipient in NEAR
    /// `fee` - the amount of fee that will be paid to the near-relayer in nETH.
    function depositToNear(string memory nearRecipientAccountId, uint256 fee)
        external
        payable
    {
        require(fee < msg.value, "The fee cannot be bigger than the transferred amount.");
        emit Deposited(msg.sender, nearRecipientAccountId, msg.value, fee);
    }

    /// Withdraws the appropriate amount of ETH which is encoded in `proofData`
    function withdraw(bytes calldata proofData, uint64 proofBlockHeight) external
    {
        ProofDecoder.ExecutionStatus memory status = _parseAndConsumeProof(proofData, proofBlockHeight);
        BurnResult memory result = _decodeBurnResult(status.successValue);
        require(result.ethCustodian == address(this),
                "Can only withdraw coins that were expected for the current contract");
        payable(result.recipient).transfer(result.amount);
        emit Withdrawn(result.recipient, result.amount);
    }

    function _decodeBurnResult(bytes memory data)
        internal
        pure
        returns (BurnResult memory result)
    {
        Borsh.Data memory borshData = Borsh.from(data);
        result.amount = borshData.decodeU128();
        bytes20 recipient = borshData.decodeBytes20();
        result.recipient = address(uint160(recipient));
        bytes20 ethCustodian = borshData.decodeBytes20();
        result.ethCustodian = address(uint160(ethCustodian));
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
