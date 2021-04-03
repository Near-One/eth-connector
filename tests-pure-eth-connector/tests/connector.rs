#![allow(unused_variables)]
use near_sdk::{near_bindgen, AccountId};

#[near_bindgen]
pub struct EthConnector;

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

    pub fn ft_transfer(&self, receiver_id: AccountId, amount: u64, memo: Option<String>) {}

    pub fn ft_transfer_call(
        &self,
        receiver_id: AccountId,
        amount: u64,
        memo: Option<String>,
        msg: String,
    ) {
    }

    pub fn storage_deposit(&self, account_id: Option<AccountId>, registration_only: Option<bool>) {}

    pub fn storage_withdraw(&self, amount: Option<u64>) {}

    pub fn storage_balance_of(&self, account_id: AccountId) {}
}
