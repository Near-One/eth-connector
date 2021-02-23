/**
* Fungible Token NEP-141 Token contract
*
* The aim of the contract is to provide a basic implementation of the improved function token standard.
*
* lib.rs is the main entry point.
* fungible_token_core.rs implements NEP-146 standard
* storage_manager.rs implements NEP-145 standard for allocating storage per account
* fungible_token_metadata.rs implements NEP-148 standard for providing token-specific metadata.
* internal.rs contains internal methods for fungible token.
*/
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::LookupMap;
use near_sdk::json_types::U128;
use near_sdk::{env, near_bindgen, AccountId, Balance, Promise, StorageUsage};

//pub use crate::fungible_token::fungible_token_core::*;
pub use crate::fungible_token::fungible_token_metadata::*;
//pub use crate::fungible_token::storage_manager::*;
//use crate::fungible_token::internal::*;


//mod fungible_token_core;
mod fungible_token_metadata;
// mod internal;
// mod storage_manager;

#[derive(BorshDeserialize, BorshSerialize)]
pub struct FungibleToken {
    /// AccountID -> Account balance.
    pub accounts: LookupMap<AccountId, Balance>,

    /// Total supply of the all token.
    pub total_supply: Balance,

    /// The storage size in bytes for one account.
    pub account_storage_usage: StorageUsage,

    pub metadata: FungibleTokenMetadata,
}

impl FungibleToken {
    pub fn fungible_token(
        total_supply: U128,
        version: String,
        name: String,
        symbol: String,
        reference: String,
        decimals: u8,
    ) -> Self {
        let mut this = Self {
            accounts: LookupMap::new(b"a".to_vec()),
            total_supply: total_supply.into(),
            account_storage_usage: 0,
            metadata: FungibleTokenMetadata {
                version,
                name,
                symbol,
                reference,
                decimals,
            },
        };
        // Determine cost of insertion into LookupMap
        let initial_storage_usage = env::storage_usage();
        let tmp_account_id = unsafe { String::from_utf8_unchecked(vec![b'a'; 64]) };
        this.accounts.insert(&tmp_account_id, &0u128);
        this.account_storage_usage = env::storage_usage() - initial_storage_usage;
        this.accounts.remove(&tmp_account_id);
        this
    }
}
