use crate::connector::prover::{validate_eth_address, Proof};
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::LookupMap;
use near_sdk::{env, near_bindgen, AccountId, Balance, Promise, PromiseResult};

#[global_allocator]
static ALLOC: near_sdk::wee_alloc::WeeAlloc<'_> = near_sdk::wee_alloc::WeeAlloc::INIT;

pub mod connector;
pub mod fungible_token;

pub type EthAddress = String;

/// Eth Connector contract
#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize)]
pub struct EthConnector {
    pub eth_addresses: LookupMap<EthAddress, Balance>,
}

impl Default for EthCennector {
    fn default() -> Self {
        env::panic(b"Contract is not initialized");
    }
}

#[ext_contract(ext_self)]
pub trait ExtEthConnector {
    #[result_serializer(borsh)]
    fn finish_deposit(
        &self,
        #[callback]
        #[serializer(borsh)]
        verification_success: bool,
        #[serializer(borsh)] token: String,
        #[serializer(borsh)] new_owner_id: AccountId,
        #[serializer(borsh)] amount: Balance,
        #[serializer(borsh)] proof: Proof,
    ) -> Promise;
}

#[ext_contract(ext_fungible_token)]
pub trait ExtFungibleToken {
    fn mint(&self, account_id: AccountId, amount: U128) -> Promise;
}

pub fn assert_self() {
    assert_eq!(env::predecessor_account_id(), env::current_account_id());
}

pub fn is_promise_success() -> bool {
    assert_eq!(
        env::promise_results_count(),
        1,
        "Contract expected a result on the callback"
    );
    match env::promise_result(0) {
        PromiseResult::Successful(_) => true,
        _ => false,
    }
}

#[near_bindgen]
impl EthCennector {
    /// Initialise ETH Connector contract
    #[init]
    pub fn new() -> Self {
        Self {
            eth_addresses: LookupMap::new(b"e".to_vec()),
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

        ext_fungible_token::mint(
            new_owner_id,
            amount.into(),
            &self.get_bridge_token_account_id(token),
            NO_DEPOSIT,
            env::prepaid_gas() / 2,
        )
    }

    /// Burn given amount of tokens and unlock it on the Ethereum side for the recipient address.
    /// We return the amount as u128 and the address of the beneficiary as `[u8; 20]` for ease of
    /// processing on Solidity side.
    /// Caller must be <token_address>.<current_account_id>, where <token_address> exists in the `tokens`.
    #[result_serializer(borsh)]
    pub fn finish_withdraw(
        &mut self,
        #[serializer(borsh)] amount: Balance,
        #[serializer(borsh)] recipient: String,
    ) -> (ResultType, u128, [u8; 20], [u8; 20]) {
        let token = env::predecessor_account_id();
        let parts: Vec<&str> = token.split(".").collect();
        assert_eq!(
            token,
            format!("{}.{}", parts[0], env::current_account_id()),
            "Only EthConnector can call this method."
        );
        assert!(
            self.tokens.contains(&parts[0].to_string()),
            "Such BridgeToken does not exist."
        );
        let token_address = validate_eth_address(parts[0].to_string());
        let recipient_address = validate_eth_address(recipient);
        (
            ResultType::Withdraw,
            amount.into(),
            token_address,
            recipient_address,
        )
    }
}
