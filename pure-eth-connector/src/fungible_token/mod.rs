use crate::sdk;
use crate::types::*;
use alloc::collections::BTreeMap;
use alloc::string::String;
use borsh::{BorshDeserialize, BorshSerialize};

#[derive(BorshDeserialize, BorshSerialize)]
pub struct FungibleToken {
    pub accounts: BTreeMap<AccountId, Balance>,
    pub total_supply: Balance,
    pub account_storage_usage: StorageUsage,
}

impl FungibleToken {
    pub fn new() -> Self {
        let mut this = Self {
            accounts: BTreeMap::new(),
            total_supply: 0,
            account_storage_usage: 0,
        };
        let initial_storage_usage = sdk::storage_usage();
        let tmp_account_id = unsafe { String::from_utf8_unchecked(vec![b'a'; 64]) };
        this.accounts.insert(tmp_account_id.clone(), 0u128);
        this.account_storage_usage = sdk::storage_usage() - initial_storage_usage;
        this.accounts.remove(tmp_account_id.as_str());
        this
    }
}
