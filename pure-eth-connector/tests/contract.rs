use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::LookupSet;
use near_sdk::json_types::{ValidAccountId, U128};
use near_sdk::serde::Serialize;
use near_sdk::serde_json::json;
use near_sdk::{
    env, log, near_bindgen, AccountId, Balance, PanicOnDefault, Promise, PromiseResult,
};

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct PureEthConnector;

impl PureEthConnector {
    #[init]
    pub fn new(prover_account: String, eth_custodian_address: String) -> Self {
        Self
    }

    // #[payable]
    // pub fn deposit(&mut self, proof: Proof);
}
