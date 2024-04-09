// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8;
import '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import 'rainbow-bridge-sol/nearprover/contracts/INearProver.sol';
import 'rainbow-bridge-sol/nearprover/contracts/ProofDecoder.sol';
import 'rainbow-bridge-sol/nearbridge/contracts/Borsh.sol';
import {EthCustodian} from './EthCustodian.sol';
import {SelectivePausableUpgradable} from './SelectivePausableUpgradable.sol';

contract EthCustodianProxy is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    SelectivePausableUpgradable
{
    using SafeERC20 for IERC20;
    using Borsh for Borsh.Data;
    using ProofDecoder for Borsh.Data;

    bytes32 public constant PAUSABLE_ADMIN_ROLE = keccak256('PAUSABLE_ADMIN_ROLE');
    bytes32 public constant UNPAUSABLE_ADMIN_ROLE = keccak256('UNPAUSABLE_ADMIN_ROLE');

    uint constant UNPAUSED_ALL = 0;
    uint constant PAUSED_DEPOSIT_TO_EVM = 1 << 0;
    uint constant PAUSED_DEPOSIT_TO_NEAR = 1 << 1;
    uint constant PAUSED_WITHDRAW = 1 << 2;
    uint constant PAUSED_WITHDRAW_PRE_MIGRATION = 1 << 3;

    event Withdrawn(address indexed recipient, uint128 amount);

    struct BurnResult {
        uint128 amount;
        address recipient;
        address ethCustodian;
    }

    INearProver public prover;
    bytes public preMigrationProducerAccount;
    uint64 public minBlockAcceptanceHeight;
    uint64 public maxBlockAcceptanceHeight;

    mapping(bytes32 => bool) public usedEvents;
    EthCustodian public ethCustodianImpl;

    // @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        bytes memory _preMigrationProducerAccount,
        INearProver _prover,
        uint64 _minBlockAcceptanceHeight,
        uint64 _maxBlockAcceptanceHeight,
        EthCustodian _ethCustodianImpl
    ) public initializer {
        preMigrationProducerAccount = _preMigrationProducerAccount;
        prover = _prover;
        minBlockAcceptanceHeight = _minBlockAcceptanceHeight;
        maxBlockAcceptanceHeight = _maxBlockAcceptanceHeight;
        ethCustodianImpl = _ethCustodianImpl;
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(PAUSABLE_ADMIN_ROLE, _msgSender());
        _grantRole(UNPAUSABLE_ADMIN_ROLE, _msgSender());
    }

    function pauseAll() external onlyRole(PAUSABLE_ADMIN_ROLE) {
        uint flags = PAUSED_DEPOSIT_TO_EVM |
            PAUSED_DEPOSIT_TO_NEAR |
            PAUSED_WITHDRAW |
            PAUSED_WITHDRAW_PRE_MIGRATION;
        ethCustodianImpl.adminPause(flags);
        _pause(flags);
    }

    function pauseImpl(uint flags) external onlyRole(UNPAUSABLE_ADMIN_ROLE) {
        ethCustodianImpl.adminPause(flags);
    }

    function pauseProxy(uint flags) external onlyRole(UNPAUSABLE_ADMIN_ROLE) {
        _pause(flags);
    }

    function depositToNear(
        string memory nearRecipientAccountId
    ) external payable whenNotPaused(PAUSED_DEPOSIT_TO_NEAR) {
        ethCustodianImpl.depositToNear{value: msg.value}(nearRecipientAccountId, 0);
    }

    function withdraw(
        bytes calldata proofData,
        uint64 proofBlockHeight
    ) external whenNotPaused(PAUSED_WITHDRAW) {
        ethCustodianImpl.withdraw(proofData, proofBlockHeight);
    }

    function withdraw_pre_migration_s1(
        bytes calldata proofData,
        uint64 proofBlockHeight
    ) external whenNotPaused(PAUSED_WITHDRAW_PRE_MIGRATION) {
        require(
            proofBlockHeight < maxBlockAcceptanceHeight,
            'Proof is from a post merge block'
        );

        bytes memory postMergeProducer = ethCustodianImpl.nearProofProducerAccount();
        ethCustodianImpl.adminSstore(1, uint(bytes32(preMigrationProducerAccount)));
        ethCustodianImpl.withdraw(proofData, proofBlockHeight);
        ethCustodianImpl.adminSstore(1, uint(bytes32(postMergeProducer)));
    }

    function withdraw_pre_migration_s2(
        bytes calldata proofData,
        uint64 proofBlockHeight
    ) external whenNotPaused(PAUSED_WITHDRAW_PRE_MIGRATION) {
        ProofDecoder.ExecutionStatus memory status = _parseAndConsumeProof(
            proofData,
            proofBlockHeight
        );

        BurnResult memory result = _decodeBurnResult(status.successValue);
        require(
            result.ethCustodian == address(ethCustodianImpl),
            'Can only withdraw coins that were expected for the custodian contract'
        );

        ethCustodianImpl.adminSendEth(payable(result.recipient), result.amount);

        emit Withdrawn(result.recipient, result.amount);
    }

    function _parseAndConsumeProof(
        bytes memory proofData,
        uint64 proofBlockHeight
    ) internal returns (ProofDecoder.ExecutionStatus memory result) {
        require(
            proofBlockHeight >= minBlockAcceptanceHeight,
            'Proof is from an ancient block'
        );
        require(
            proofBlockHeight < maxBlockAcceptanceHeight,
            'Proof is from a recent block'
        );
        require(
            prover.proveOutcome(proofData, proofBlockHeight),
            'Proof should be valid'
        );

        // Unpack the proof and extract the execution outcome.
        Borsh.Data memory borshData = Borsh.from(proofData);

        ProofDecoder.FullOutcomeProof memory fullOutcomeProof = borshData
            .decodeFullOutcomeProof();
        borshData.done();

        bytes32 receiptId = fullOutcomeProof
            .outcome_proof
            .outcome_with_id
            .outcome
            .receipt_ids[0];

        require(!ethCustodianImpl.usedEvents(receiptId), 'The burn event cannot be reused');
        require(!usedEvents[receiptId], 'The burn event cannot be reused');
        usedEvents[receiptId] = true;

        require(
            keccak256(
                fullOutcomeProof
                    .outcome_proof
                    .outcome_with_id
                    .outcome
                    .executor_id
            ) == keccak256(preMigrationProducerAccount),
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

    function _decodeBurnResult(
        bytes memory data
    ) internal pure returns (BurnResult memory result) {
        Borsh.Data memory borshData = Borsh.from(data);
        result.amount = borshData.decodeU128();
        bytes20 recipient = borshData.decodeBytes20();
        result.recipient = address(uint160(recipient));
        bytes20 ethCustodian = borshData.decodeBytes20();
        result.ethCustodian = address(uint160(ethCustodian));
        borshData.done();
    }

    /**
     * @dev Internal function called by the proxy contract to authorize an upgrade to a new implementation address
     * using the UUPS proxy upgrade pattern. Overrides the default `_authorizeUpgrade` function from the `UUPSUpgradeable` contract.
     * This function does not need to perform any extra authorization checks other than restricting the execution of the function to the admin and reverting otherwise.
     * @param newImplementation Address of the new implementation contract.
     * Requirements:
     * - The caller must have the `DEFAULT_ADMIN_ROLE`.
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
