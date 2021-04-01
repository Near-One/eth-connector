#![allow(unused_variables)]
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{near_bindgen, AccountId, Balance};

#[near_bindgen]
pub struct EthConnector;

#[derive(Default, BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct Proof {
    pub log_index: u64,
    pub log_entry_data: Vec<u8>,
    pub receipt_index: u64,
    pub receipt_data: Vec<u8>,
    pub header_data: Vec<u8>,
    pub proof: Vec<Vec<u8>>,
    pub skip_bridge_call: bool,
}

#[near_bindgen]
impl EthConnector {
    pub fn new(prover_account: AccountId, eth_custodian_address: String) {}

    pub fn ft_balance_of(&self, account_id: AccountId) {}

    pub fn deposit(
        &self,
        log_index: u64,
        log_entry_data: Vec<u8>,
        receipt_index: u64,
        receipt_data: Vec<u8>,
        header_data: Vec<u8>,
        proof: Vec<Vec<u8>>,
        skip_bridge_call: bool,
    ) {
    }

    pub fn withdraw(&self, recipient_id: AccountId, amount: u64) {}

    pub fn ft_total_supply(&self) {}

    pub fn ft_transfer(&self, receiver_id: AccountId, amount: Balance, memo: Option<String>) {}

    pub fn ft_transfer_call(
        &self,
        receiver_id: AccountId,
        amount: Balance,
        memo: Option<String>,
        msg: String,
    ) {
    }

    pub fn storage_deposit(&self, account_id: Option<AccountId>, registration_only: Option<bool>) {}

    pub fn storage_withdraw(&self, amount: Option<u128>) {}

    pub fn storage_balance_of(&self, account_id: AccountId) {}
}
