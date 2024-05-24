// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8;
import '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol';
import {EthCustodian} from './EthCustodian.sol';
import {SelectivePausableUpgradable} from './SelectivePausableUpgradable.sol';

contract EthCustodianProxy is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    SelectivePausableUpgradable
{
    bytes32 public constant PAUSABLE_ADMIN_ROLE = keccak256('PAUSABLE_ADMIN_ROLE');

    uint constant UNPAUSED_ALL = 0;
    uint constant PAUSED_DEPOSIT_TO_EVM = 1 << 0;
    uint constant PAUSED_DEPOSIT_TO_NEAR = 1 << 1;
    uint constant PAUSED_WITHDRAW_POST_MIGRATION = 1 << 2;
    uint constant PAUSED_WITHDRAW_PRE_MIGRATION = 1 << 3;

    error AlreadyMigrated();
    error ProducerAccountIdTooLong(bytes newProducerAccount);
    error ProofFromPostMergeBlock();

    bytes public preMigrationProducerAccount;
    uint64 public migrationBlockHeight;

    EthCustodian public ethCustodianImpl;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        EthCustodian _ethCustodianImpl
    ) public initializer {
        ethCustodianImpl = _ethCustodianImpl;
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(PAUSABLE_ADMIN_ROLE, _msgSender());
    }

    function depositToNear(
        string memory nearRecipientAccountId
    ) external payable whenNotPaused(PAUSED_DEPOSIT_TO_NEAR) {
        ethCustodianImpl.depositToNear{value: msg.value}(nearRecipientAccountId, 0);
    }

    function depositToEVM(
        string memory ethRecipientOnNear
    ) external payable whenNotPaused(PAUSED_DEPOSIT_TO_EVM) {
        ethCustodianImpl.depositToEVM{value: msg.value}(ethRecipientOnNear, 0);
    }

    function withdraw(
        bytes calldata proofData,
        uint64 proofBlockHeight
    ) external {
        if (proofBlockHeight > migrationBlockHeight) {
            _requireNotPaused(PAUSED_WITHDRAW_POST_MIGRATION);
            ethCustodianImpl.withdraw(proofData, proofBlockHeight);
        } else {
            _requireNotPaused(PAUSED_WITHDRAW_PRE_MIGRATION);
            bytes memory postMigrationProducer = ethCustodianImpl.nearProofProducerAccount_();
            _writeProofProducerSlot(preMigrationProducerAccount);
            ethCustodianImpl.withdraw(proofData, proofBlockHeight);
            _writeProofProducerSlot(postMigrationProducer);
        }
    }

    function migrateToNewProofProducer(
        bytes calldata newProducerAccount,
        uint64 migrationBlockNumber
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (keccak256(preMigrationProducerAccount) != keccak256(hex"")) {
            revert AlreadyMigrated();
        }

        // Needs to fit in one slot
        if (newProducerAccount.length > 31) {
            revert ProducerAccountIdTooLong(newProducerAccount);
        }

        migrationBlockHeight = migrationBlockNumber;
        preMigrationProducerAccount = ethCustodianImpl.nearProofProducerAccount_();
        _writeProofProducerSlot(newProducerAccount);
    }

    function callImpl(bytes calldata data) external payable onlyRole(DEFAULT_ADMIN_ROLE) {
        (bool success, ) = address(ethCustodianImpl).call{value: msg.value}(data);
        require(success, 'EthCustodian call failed');
    }

    function pauseAll() external onlyRole(PAUSABLE_ADMIN_ROLE) {
        uint flags = PAUSED_DEPOSIT_TO_EVM |
            PAUSED_DEPOSIT_TO_NEAR |
            PAUSED_WITHDRAW_POST_MIGRATION |
            PAUSED_WITHDRAW_PRE_MIGRATION;
        ethCustodianImpl.adminPause(flags);
        _pause(flags);
    }

    function pauseImpl(uint flags) external onlyRole(DEFAULT_ADMIN_ROLE) {
        ethCustodianImpl.adminPause(flags);
    }

    function pauseProxy(uint flags) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause(flags);
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

    function _writeProofProducerSlot(bytes memory proofProducer) private {
        uint dataLength = proofProducer.length * 2;
        ethCustodianImpl.adminSstore(1, uint(bytes32(proofProducer)) + dataLength);
    }
}
