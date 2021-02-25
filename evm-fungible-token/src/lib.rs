#![allow(dead_code, unused_imports, unused_variables)]
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupSet, UnorderedMap};
use near_sdk::json_types::{ValidAccountId, U128};
use near_sdk::serde_json::{self, json};
use near_sdk::{
    env, log, near_bindgen, AccountId, Balance, Gas, PanicOnDefault, Promise, PromiseOrValue,
    PromiseResult,
};

use crate::fungible_token::{FungibleToken, FungibleTokenCore, FungibleTokenMetadataProvider};
use connector::deposit_event::EthDepositedEvent;
pub use connector::prover::{validate_eth_address, EthAddress, Proof};
use connector::withdraw_event::EthWithdrawEvent;

mod connector;
mod fungible_token;

near_sdk::setup_alloc!();

/// Price per 1 byte of storage from mainnet genesis config.
const STORAGE_PRICE_PER_BYTE: Balance = 100_000_000_000_000_000_000; // 1e20yN, 0.0001N

const NO_DEPOSIT: Balance = 0;
const TRANSFER_FROM_GAS: Gas = 10_000_000_000_000;
const TRANSFER_GAS: Gas = 10_000_000_000_000;

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct EthConnector {
    /// The account of the prover that we can use to prove
    pub prover_account: AccountId,
    /// Address of the Ethereum custodian contract.
    pub eth_custodian_address: EthAddress,
    // Hashes of the events that were already used.
    pub used_events: LookupSet<Vec<u8>>,
    pub token: FungibleToken,
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
impl EthConnector {
    /// Test solution for Eth verify log contract
    pub fn deploy(&self, account_id: String, amount: U128) {
        let promise_idx = env::promise_batch_create(&account_id);
        env::promise_batch_action_create_account(promise_idx);
        env::promise_batch_action_transfer(promise_idx, amount.0);
        env::promise_batch_action_add_key_with_full_access(
            promise_idx,
            &env::signer_account_pk(),
            0,
        );
        let code: &[u8] = include_bytes!("../res/eth_prover.wasm");
        env::promise_batch_action_deploy_contract(promise_idx, code);
    }

    /// Initializes the contract.
    /// `prover_account`: NEAR account of the Near Prover contract;
    /// `eth_custodian_address`: Ethereum address of the custodian contract, in hex.
    #[init]
    pub fn new(prover_account: AccountId, eth_custodian_address: String) -> Self {
        assert!(!env::state_exists(), "Already initialized");
        Self {
            prover_account,
            eth_custodian_address: validate_eth_address(eth_custodian_address),
            used_events: LookupSet::new(b"u".to_vec()),
            token: FungibleToken::fungible_token(
                U128::from(1000),
                "v1".into(),
                "nETH".into(),
                "nETH".into(),
                "".into(),
                0,
            ),
        }
    }

    /// Deposit from Ethereum to NEAR based on the proof of the locked tokens.
    /// Must attach enough NEAR funds to cover for storage of the proof.
    #[payable]
    pub fn deposit(&mut self, proof: Proof) {
        log!("Deposit started");
        //let event = EthDepositedEvent::from_log_entry_data(&proof.log_entry_data);
        //================================
        // TODO: for testing only
        let event = EthDepositedEvent {
            eth_custodian_address: self.eth_custodian_address,
            sender: "sender1".into(),
            amount: U128::from(100),
            recipient: "rcv1".into(),
            fee: U128::from(2),
        };
        //================================

        assert_eq!(
            event.eth_custodian_address,
            self.eth_custodian_address,
            "Event's address {} does not match custodian address {}",
            hex::encode(&event.eth_custodian_address),
            hex::encode(&self.eth_custodian_address),
        );
        let proof_1 = proof.clone();
        let account_id = env::current_account_id();
        let prepaid_gas = env::prepaid_gas();
        log!("Deposit verify_log_entry");
        let promise0 = env::promise_create(
            account_id.clone(),
            b"verify_log_entry",
            json!({
                "log_index": proof.log_index,
                "log_entry_data": proof.log_entry_data,
                "receipt_index": proof.receipt_index,
                "receipt_data": proof.receipt_data,
                "header_data": proof.header_data,
                "proof": proof.proof,
                "skip_bridge_call": false,
            })
            .to_string()
            .as_bytes(),
            NO_DEPOSIT,
            prepaid_gas / 4,
        );
        let promise1 = env::promise_then(
            promise0,
            account_id,
            b"finish_deposit",
            json!({
                "new_owner_id": event.recipient,
                "amount": event.amount,
                "proof": proof_1,
            })
            .to_string()
            .as_bytes(),
            NO_DEPOSIT,
            prepaid_gas / 4,
        );
        env::promise_return(promise0);
    }

    /// Finish depositing once the proof was successfully validated.
    /// Can only be called by the contract itself.
    #[private]
    pub fn finish_deposit(&mut self, new_owner_id: AccountId, amount: U128, proof: Proof) {
        log!(
            "finish_deposit - Promise results: {:?}",
            env::promise_results_count()
        );
        log!("Amount: {:?}", amount);
        assert_eq!(env::promise_results_count(), 1);
        let data0: Vec<u8> = match env::promise_result(0) {
            PromiseResult::Successful(x) => x,
            _ => panic!("Promise with index 0 failed"),
        };
        let verification_success: bool = serde_json::from_slice(&data0).unwrap();
        assert!(verification_success, "Failed to verify the proof");
        self.record_proof(&proof.get_key());
        let md = self.token.ft_metadata();
        log!("Metadata: {:?}", md.symbol);

        self.mint(new_owner_id, amount.into());
    }

    /// Mint Fungible Token for account
    /// TODO: should be related to NEP-145
    #[private]
    fn mint(&mut self, owner_id: AccountId, amount: Balance) {
        log!("Mint {:?} tokens for: {:?}", amount, owner_id);
        if self.token.accounts.get(&owner_id).is_none() {
            self.token.accounts.insert(&owner_id, &amount);
        } else {
            self.token.internal_deposit(&owner_id, amount);
        }
    }

    /// Burn Fungible Token for account
    #[private]
    fn burn(&mut self, owner_id: AccountId, amount: Balance) {
        log!("Burn {:?} tokens for: {:?}", amount, owner_id);
        self.token.internal_withdraw(&owner_id, amount);
    }

    #[payable]
    pub fn withdraw(&mut self, proof: Proof) {
        log!("Start withdraw");
        let event = EthWithdrawEvent::from_log_entry_data(&proof.log_entry_data);
        assert_eq!(
            event.eth_custodian_address,
            self.eth_custodian_address,
            "Event's address {} does not match custodian address of this token {}",
            hex::encode(&event.eth_custodian_address),
            hex::encode(&self.eth_custodian_address),
        );
        let proof_1 = proof.clone();
        let account_id = env::current_account_id();
        let prepaid_gas = env::prepaid_gas();
        log!("Withdraw verify_log_entry");
        let promise0 = env::promise_create(
            account_id.clone(),
            b"verify_log_entry",
            json!({
                "log_index": proof.log_index,
                "log_entry_data": proof.log_entry_data,
                "receipt_index": proof.receipt_index,
                "receipt_data": proof.receipt_data,
                "header_data": proof.header_data,
                "proof": proof.proof,
                "skip_bridge_call": false,
            })
            .to_string()
            .as_bytes(),
            NO_DEPOSIT,
            prepaid_gas / 4,
        );
        let promise1 = env::promise_then(
            promise0,
            account_id,
            b"finish_withdraw",
            json!({
                "owner_id": event.recipient,
                "amount": event.amount,
                "proof": proof_1,
            })
            .to_string()
            .as_bytes(),
            NO_DEPOSIT,
            prepaid_gas / 4,
        );
        env::promise_return(promise0);
    }

    /// Record proof to make sure it is not re-used later for anther deposit.
    #[private]
    fn record_proof(&mut self, key: &Vec<u8>) -> Balance {
        let initial_storage = env::storage_usage();
        assert!(
            !self.used_events.contains(&key),
            "Event cannot be reused for depositing. Proof already exist."
        );
        self.used_events.insert(&key);
        let current_storage = env::storage_usage();
        let attached_deposit = env::attached_deposit();
        let required_deposit =
            Balance::from(current_storage - initial_storage) * STORAGE_PRICE_PER_BYTE;
        attached_deposit - required_deposit
    }

    pub fn balance_of(&self, account_id: ValidAccountId) -> U128 {
        self.token.ft_balance_of(account_id)
    }

    /// For tests only. Ir should be external Contract
    pub fn verify_log_entry(
        &self,
        log_index: u64,
        log_entry_data: Vec<u8>,
        receipt_index: u64,
        receipt_data: Vec<u8>,
        header_data: Vec<u8>,
        proof: Vec<Vec<u8>>,
        skip_bridge_call: bool,
    ) -> bool {
        true
    }
}
