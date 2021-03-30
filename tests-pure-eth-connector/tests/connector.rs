#![allow(unused_variables)]
use near_sdk::{near_bindgen, AccountId};

#[near_bindgen]
pub struct EthConnector;

#[near_bindgen]
impl EthConnector {
    #[init]
    pub fn new(prover_account: AccountId, eth_custodian_address: String) {}

    pub fn ft_balance_of(&self, account_id: AccountId) {}
}
