use crate::connector::prover::Proof;
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::LookupMap;
use near_sdk::{env, near_bindgen, AccountId, Balance};

#[global_allocator]
static ALLOC: near_sdk::wee_alloc::WeeAlloc<'_> = near_sdk::wee_alloc::WeeAlloc::INIT;

pub mod connector;
pub mod fungible_token;

/// Eth Connector contract
#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize)]
pub struct EthCennector {
    pub evm_addresses: LookupMap<AccountId, Balance>,
}

impl Default for EthCennector {
    fn default() -> Self {
        env::panic(b"Contract is not initialized");
    }
}

#[near_bindgen]
impl EthCennector {
    /// Initialise ETH Connector contract
    #[init]
    pub fn new() -> Self {
        Self {
            evm_addresses: LookupMap::new(b"e".to_vec()),
        }
    }

    /// Deposit from Ethereum to NEAR based on the proof of the locked tokens.
    /// Must attach enough NEAR funds to cover for storage of the proof.
    #[payable]
    pub fn deposit(&mut self, #[serializer(borsh)] proof: Proof) -> Promise {
        let event = EthLockedEvent::from_log_entry_data(&proof.log_entry_data);
        assert_eq!(
            event.locker_address,
            self.locker_address,
            "Event's address {} does not match locker address of this token {}",
            hex::encode(&event.locker_address),
            hex::encode(&self.locker_address),
        );

        let proof_1 = proof.clone();
        ext_prover::verify_log_entry(
            proof.log_index,
            proof.log_entry_data,
            proof.receipt_index,
            proof.receipt_data,
            proof.header_data,
            proof.proof,
            false, // Do not skip bridge call. This is only used for development and diagnostics.
            &self.prover_account,
            NO_DEPOSIT,
            env::prepaid_gas() / 4,
        )
        .then(ext_self::finish_deposit(
            event.token,
            event.recipient,
            event.amount,
            proof_1,
            &env::current_account_id(),
            env::attached_deposit(),
            env::prepaid_gas() / 2,
        ))
    }

    /// Finish depositing once the proof was successfully validated. Can only be called by the contract
    /// itself.
    #[payable]
    pub fn finish_deposit(
        &mut self,
        #[callback]
        #[serializer(borsh)]
        verification_success: bool,
        #[serializer(borsh)] token: String,
        #[serializer(borsh)] new_owner_id: AccountId,
        #[serializer(borsh)] amount: Balance,
        #[serializer(borsh)] proof: Proof,
    ) -> Promise {
        assert_self();
        assert!(verification_success, "Failed to verify the proof");
        self.record_proof(&proof);

        ext_bridge_token::mint(
            new_owner_id,
            amount.into(),
            &self.get_bridge_token_account_id(token),
            NO_DEPOSIT,
            env::prepaid_gas() / 2,
        )
    }
}
