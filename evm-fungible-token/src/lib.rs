#![allow(dead_code, unused_imports)]
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
//use near_sdk::json_types::U128;
use near_sdk::serde_json::{self, json};
use near_sdk::{env, near_bindgen, AccountId, Balance, Gas, Promise, PromiseResult, PanicOnDefault};

//use near_sdk::collections::UnorderedSet;
//use near_sdk::{env, ext_contract, near_bindgen, AccountId, Balance, Gas, Promise, PromiseResult};

// use crate::connector::prover::Proof;
// use connector::deposit_event::EthDepositedEvent;
use connector::prover::{validate_eth_address, EthAddress};
// use connector::withdraw_event::EthWithdrawEvent;
use near_sdk::collections::{LookupSet, UnorderedMap};

mod connector;
// mod fungible_token;

near_sdk::setup_alloc!();

/// Price per 1 byte of storage from mainnet genesis config.
const STORAGE_PRICE_PER_BYTE: Balance = 100_000_000_000_000_000_000; // 1e20yN, 0.0001N

const NO_DEPOSIT: Balance = 0;
const TRANSFER_FROM_GAS: Gas = 10_000_000_000_000;
const TRANSFER_GAS: Gas = 10_000_000_000_000;

#[derive(Debug, Eq, PartialEq, BorshSerialize, BorshDeserialize)]
pub enum ResultType {
    Deposit,
    Withdraw,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct EthConnector {
    pub account_id: String,
    /// The account of the prover that we can use to prove
    pub prover_account: AccountId,
    /// Address of the Ethereum custodian contract.
    pub eth_custodian_address: EthAddress,
    // Hashes of the events that were already used.
    pub used_events: LookupSet<Vec<u8>>,
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
    /// Initializes the contract.
    /// `prover_account`: NEAR account of the Near Prover contract;
    /// `eth_custodian_address`: Ethereum address of the custodian contract, in hex.
    #[init]
    pub fn new(prover_account: AccountId, eth_custodian_address: String) -> Self {
        assert!(!env::state_exists(), "Already initialized");
        let account_id = "".to_string();
        Self {
            account_id,
            prover_account,
            eth_custodian_address:  validate_eth_address(eth_custodian_address),
            used_events: LookupSet::new(b"u".to_vec()),
        }
    }
}
/*
    /// Deposit from Ethereum to NEAR based on the proof of the locked tokens.
    /// Must attach enough NEAR funds to cover for storage of the proof.
    #[payable]
    pub fn deposit(&mut self, proof: Proof) {
        let event = EthDepositedEvent::from_log_entry_data(&proof.log_entry_data);
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
        let promise0 = env::promise_create(
            account_id.clone(),
            b"merge_sort",
            json!({
                "log_index": proof.log_index,
            "log_entry_data": proof.log_entry_data,
            "receipt_index": proof.receipt_index,
                "receipt_data": proof.receipt_data,
                "header_data": proof.header_data,
                "proof": proof.proof,
            })
            .to_string()
            .as_bytes(),
            NO_DEPOSIT,
            prepaid_gas / 4,
        );
        let promise1 = env::promise_then(
            promise0,
            account_id,
            b"get_status",
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
        env::promise_return(promise1);
    }

        /// Finish depositing once the proof was successfully validated.
        /// Can only be called by the contract itself.
        #[payable]
        pub fn finish_deposit(
            &mut self,
            #[callback]
            #[serializer(borsh)]
            verification_success: bool,
            #[serializer(borsh)] new_owner_id: AccountId,
            #[serializer(borsh)] amount: Balance,
            #[serializer(borsh)] proof: Proof,
        ) -> Promise {
            assert_self();
            assert!(verification_success, "Failed to verify the proof");
            self.record_proof(&proof);

            // TODO: refactor
            let token = String::from("");
            ext_bridge_token::mint(
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
                "Only sub accounts of EthConnector can call this method."
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

        pub fn get_bridge_token_account_id(&self, address: String) -> AccountId {
            let address = address.to_lowercase();
            let _ = validate_eth_address(address.clone());
            format!("{}.{}", address, env::current_account_id())
        }

        /// Locks NEP-21 token on NEAR side to mint on Ethereum it's counterpart.
        #[payable]
        pub fn lock(&mut self, token: AccountId, amount: U128, recipient: String) -> Promise {
            assert!(false, "Native NEP21 on Ethereum is disabled.");
            let address = validate_eth_address(recipient);
            // ext_nep21::transfer_from(
            //     env::predecessor_account_id(),
            //     env::current_account_id(),
            //     amount,
            //     &token,
            //     env::attached_deposit(),
            //     TRANSFER_FROM_GAS,
            // )
            // .then(ext_self::finish_lock(
            //     amount.into(),
            //     address,
            //     token,
            //     &env::current_account_id(),
            //     NO_DEPOSIT,
            //     env::prepaid_gas() / 3,
            // ))
            ext_self::finish_lock(
                amount.into(),
                address,
                token,
                &env::current_account_id(),
                NO_DEPOSIT,
                env::prepaid_gas() / 3,
            )
        }

        /// Callback after transfer_from happened.
        #[result_serializer(borsh)]
        pub fn finish_lock(
            &self,
            #[serializer(borsh)] amount: Balance,
            #[serializer(borsh)] recipient: [u8; 20],
            #[serializer(borsh)] token: String,
        ) -> (ResultType, String, u128, [u8; 20]) {
            assert!(false, "Native NEP21 on Ethereum is disabled.");
            assert_self();
            assert!(is_promise_success());
            (ResultType::Lock, token, amount.into(), recipient)
        }

        #[payable]
        pub fn unlock(&mut self, #[serializer(borsh)] proof: Proof) -> Promise {
            assert!(false, "Native NEP21 on Ethereum is disabled.");
            let event = EthUnlockedEvent::from_log_entry_data(&proof.log_entry_data);
            assert_eq!(
                event.locker_address,
                self.eth_custodian_address,
                "Event's address {} does not match custodian address of this token {}",
                hex::encode(&event.locker_address),
                hex::encode(&self.eth_custodian_address),
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
            // .then(ext_self::finish_unlock(
            //     event.token,
            //     event.recipient,
            //     event.amount,
            //     proof_1,
            //     &env::current_account_id(),
            //     env::attached_deposit(),
            //     env::prepaid_gas() / 2,
            // ))
        }

        // #[payable]
        // pub fn finish_unlock(
        //     &mut self,
        //     #[callback]
        //     #[serializer(borsh)]
        //     verification_success: bool,
        //     #[serializer(borsh)] token: AccountId,
        //     #[serializer(borsh)] recipient: AccountId,
        //     #[serializer(borsh)] amount: Balance,
        //     #[serializer(borsh)] proof: Proof,
        // ) -> Promise {
        //     assert!(false, "Native NEP21 on Ethereum is disabled.");
        //     assert_self();
        //     assert!(verification_success, "Failed to verify the proof");
        //     self.record_proof(&proof);
        //     ext_nep21::transfer(
        //         recipient,
        //         amount.into(),
        //         &token,
        //         env::attached_deposit(),
        //         TRANSFER_GAS,
        //     )
        // }

        /// Record proof to make sure it is not re-used later for anther deposit.
        fn record_proof(&mut self, proof: &Proof) -> Balance {
            // TODO: Instead of sending the full proof (clone only relevant parts of the Proof)
            //       log_index / receipt_index / header_data
            assert_self();
            let initial_storage = env::storage_usage();
            let mut data = proof.log_index.try_to_vec().unwrap();
            data.extend(proof.receipt_index.try_to_vec().unwrap());
            data.extend(proof.header_data.clone());
            let key = env::sha256(&data);
            // assert!(
            //     !self.used_events.contains(&key),
            //     "Event cannot be reused for depositing. Proof already exist."
            // );
            // self.used_events.insert(&key);
            let current_storage = env::storage_usage();
            let attached_deposit = env::attached_deposit();
            let required_deposit =
                Balance::from(current_storage - initial_storage) * STORAGE_PRICE_PER_BYTE;
            attached_deposit - required_deposit
        }
    */

