#![allow(dead_code)]
use crate::types::{AccountId, Balance, Gas, PromiseResult};
use alloc::{string::String, vec, vec::Vec};
use borsh::{BorshDeserialize, BorshSerialize};
use core::mem::size_of;
use primitive_types::H256;

/// Key used to store the state of the contract.
pub const STATE_KEY: &[u8] = b"STATE";
pub const NO_DEPOSIT: Balance = 0;
pub const RETURN_CODE_ERR: &str = "Unexpected return code.";
pub const STORAGE_PRICE_PER_BYTE: Balance = 100_000_000_000_000_000_000; // 1e20yN, 0.0001N

mod exports {
    #[allow(unused)]
    extern "C" {
        // #############
        // # Registers #
        // #############
        pub(crate) fn read_register(register_id: u64, ptr: u64);
        pub(crate) fn register_len(register_id: u64) -> u64;
        // ###############
        // # Context API #
        // ###############
        pub(crate) fn current_account_id(register_id: u64);
        pub(crate) fn signer_account_id(register_id: u64);
        pub(crate) fn signer_account_pk(register_id: u64);
        pub(crate) fn predecessor_account_id(register_id: u64);
        pub(crate) fn input(register_id: u64);
        // TODO #1903 fn block_height() -> u64;
        pub(crate) fn block_index() -> u64;
        pub(crate) fn block_timestamp() -> u64;
        pub(crate) fn epoch_height() -> u64;
        pub(crate) fn storage_usage() -> u64;
        // #################
        // # Economics API #
        // #################
        pub(crate) fn account_balance(balance_ptr: u64);
        pub(crate) fn attached_deposit(balance_ptr: u64);
        pub(crate) fn prepaid_gas() -> u64;
        pub(crate) fn used_gas() -> u64;
        // ############
        // # Math API #
        // ############
        pub(crate) fn random_seed(register_id: u64);
        pub(crate) fn sha256(value_len: u64, value_ptr: u64, register_id: u64);
        pub(crate) fn keccak256(value_len: u64, value_ptr: u64, register_id: u64);
        // #####################
        // # Miscellaneous API #
        // #####################
        pub(crate) fn value_return(value_len: u64, value_ptr: u64);
        pub(crate) fn panic();
        pub(crate) fn panic_utf8(len: u64, ptr: u64);
        pub(crate) fn log_utf8(len: u64, ptr: u64);
        pub(crate) fn log_utf16(len: u64, ptr: u64);
        pub(crate) fn abort(msg_ptr: u32, filename_ptr: u32, line: u32, col: u32);
        // ################
        // # Promises API #
        // ################
        pub(crate) fn promise_create(
            account_id_len: u64,
            account_id_ptr: u64,
            method_name_len: u64,
            method_name_ptr: u64,
            arguments_len: u64,
            arguments_ptr: u64,
            amount_ptr: u64,
            gas: u64,
        ) -> u64;
        pub(crate) fn promise_then(
            promise_index: u64,
            account_id_len: u64,
            account_id_ptr: u64,
            method_name_len: u64,
            method_name_ptr: u64,
            arguments_len: u64,
            arguments_ptr: u64,
            amount_ptr: u64,
            gas: u64,
        ) -> u64;
        pub(crate) fn promise_and(promise_idx_ptr: u64, promise_idx_count: u64) -> u64;
        pub(crate) fn promise_batch_create(account_id_len: u64, account_id_ptr: u64) -> u64;
        pub(crate) fn promise_batch_then(
            promise_index: u64,
            account_id_len: u64,
            account_id_ptr: u64,
        ) -> u64;
        // #######################
        // # Promise API actions #
        // #######################
        pub(crate) fn promise_batch_action_create_account(promise_index: u64);
        pub(crate) fn promise_batch_action_deploy_contract(
            promise_index: u64,
            code_len: u64,
            code_ptr: u64,
        );
        pub(crate) fn promise_batch_action_function_call(
            promise_index: u64,
            method_name_len: u64,
            method_name_ptr: u64,
            arguments_len: u64,
            arguments_ptr: u64,
            amount_ptr: u64,
            gas: u64,
        );
        pub(crate) fn promise_batch_action_transfer(promise_index: u64, amount_ptr: u64);
        pub(crate) fn promise_batch_action_stake(
            promise_index: u64,
            amount_ptr: u64,
            public_key_len: u64,
            public_key_ptr: u64,
        );
        pub(crate) fn promise_batch_action_add_key_with_full_access(
            promise_index: u64,
            public_key_len: u64,
            public_key_ptr: u64,
            nonce: u64,
        );
        pub(crate) fn promise_batch_action_add_key_with_function_call(
            promise_index: u64,
            public_key_len: u64,
            public_key_ptr: u64,
            nonce: u64,
            allowance_ptr: u64,
            receiver_id_len: u64,
            receiver_id_ptr: u64,
            method_names_len: u64,
            method_names_ptr: u64,
        );
        pub(crate) fn promise_batch_action_delete_key(
            promise_index: u64,
            public_key_len: u64,
            public_key_ptr: u64,
        );
        pub(crate) fn promise_batch_action_delete_account(
            promise_index: u64,
            beneficiary_id_len: u64,
            beneficiary_id_ptr: u64,
        );
        // #######################
        // # Promise API results #
        // #######################
        pub(crate) fn promise_results_count() -> u64;
        pub(crate) fn promise_result(result_idx: u64, register_id: u64) -> u64;
        pub(crate) fn promise_return(promise_id: u64);
        // ###############
        // # Storage API #
        // ###############
        pub(crate) fn storage_write(
            key_len: u64,
            key_ptr: u64,
            value_len: u64,
            value_ptr: u64,
            register_id: u64,
        ) -> u64;
        pub(crate) fn storage_read(key_len: u64, key_ptr: u64, register_id: u64) -> u64;
        pub(crate) fn storage_remove(key_len: u64, key_ptr: u64, register_id: u64) -> u64;
        pub(crate) fn storage_has_key(key_len: u64, key_ptr: u64) -> u64;
        pub(crate) fn storage_iter_prefix(prefix_len: u64, prefix_ptr: u64) -> u64;
        pub(crate) fn storage_iter_range(
            start_len: u64,
            start_ptr: u64,
            end_len: u64,
            end_ptr: u64,
        ) -> u64;
        pub(crate) fn storage_iter_next(
            iterator_id: u64,
            key_register_id: u64,
            value_register_id: u64,
        ) -> u64;
        // ###############
        // # Validator API #
        // ###############
        pub(crate) fn validator_stake(account_id_len: u64, account_id_ptr: u64, stake_ptr: u64);
        pub(crate) fn validator_total_stake(stake_ptr: u64);
    }
}

pub fn read_input() -> Vec<u8> {
    unsafe {
        exports::input(0);
        let bytes: Vec<u8> = vec![0; exports::register_len(0) as usize];
        exports::read_register(0, bytes.as_ptr() as *const u64 as u64);
        bytes
    }
}

pub fn read_input_arr20() -> [u8; 20] {
    unsafe {
        exports::input(0);
        let bytes = [0u8; 20];
        exports::read_register(0, bytes.as_ptr() as *const u64 as u64);
        bytes
    }
}

pub fn value_return(value: &[u8]) {
    unsafe {
        exports::value_return(value.len() as u64, value.as_ptr() as u64);
    }
}

pub fn read_storage(key: &[u8]) -> Option<Vec<u8>> {
    unsafe {
        if exports::storage_read(key.len() as u64, key.as_ptr() as u64, 0) == 1 {
            let bytes: Vec<u8> = vec![0u8; exports::register_len(0) as usize];
            exports::read_register(0, bytes.as_ptr() as *const u64 as u64);
            Some(bytes)
        } else {
            None
        }
    }
}

pub fn save_contract<T: BorshSerialize>(data: &T) {
    write_storage(STATE_KEY, &data.try_to_vec().unwrap()[..]);
}

pub fn get_contract_data<T: BorshDeserialize>() -> T {
    let data = read_storage(STATE_KEY).expect("Failed read storage");
    T::try_from_slice(&data).unwrap()
}

pub fn write_storage(key: &[u8], value: &[u8]) {
    unsafe {
        exports::storage_write(
            key.len() as u64,
            key.as_ptr() as u64,
            value.len() as u64,
            value.as_ptr() as u64,
            0,
        );
    }
}

pub fn remove_storage(key: &[u8]) {
    unsafe {
        exports::storage_remove(key.len() as u64, key.as_ptr() as u64, 0);
    }
}

pub fn block_timestamp() -> u64 {
    unsafe { exports::block_timestamp() }
}

pub fn block_index() -> u64 {
    unsafe { exports::block_index() }
}

#[allow(dead_code)]
pub fn panic() -> ! {
    unsafe { exports::panic() }
    unreachable!()
}

#[allow(dead_code)]
pub fn panic_utf8(bytes: &[u8]) -> ! {
    unsafe {
        exports::panic_utf8(bytes.len() as u64, bytes.as_ptr() as u64);
    }
    unreachable!()
}

pub fn log_utf8(bytes: &[u8]) {
    unsafe {
        exports::log_utf8(bytes.len() as u64, bytes.as_ptr() as u64);
    }
}

pub fn log(data: String) {
    log_utf8(data.as_bytes())
}

pub fn predecessor_account_id() -> AccountId {
    unsafe {
        exports::predecessor_account_id(1);
        let bytes: Vec<u8> = vec![0u8; exports::register_len(1) as usize];
        exports::read_register(1, bytes.as_ptr() as *const u64 as u64);
        String::from_utf8(bytes).unwrap()
    }
}

/// Calls environment keccak256 on given data.
pub fn keccak(data: &[u8]) -> H256 {
    unsafe {
        exports::keccak256(data.len() as u64, data.as_ptr() as u64, 1);
        let bytes = H256::zero();
        exports::read_register(1, bytes.0.as_ptr() as *const u64 as u64);
        bytes
    }
}

/// Calls environment panic with data encoded in hex as panic message.
pub fn panic_hex(data: &[u8]) -> ! {
    let message = crate::types::bytes_to_hex(data).into_bytes();
    unsafe { exports::panic_utf8(message.len() as _, message.as_ptr() as _) }
    unreachable!()
}

pub fn state_exists() -> bool {
    unsafe {
        if exports::storage_has_key(STATE_KEY.len() as u64, STATE_KEY.as_ptr() as u64) == 1 {
            true
        } else {
            false
        }
    }
}

pub fn storage_usage() -> u64 {
    unsafe { exports::storage_usage() }
}

pub fn current_account_id() -> AccountId {
    unsafe {
        exports::current_account_id(1);
        let bytes: Vec<u8> = vec![0u8; exports::register_len(1) as usize];
        exports::read_register(1, bytes.as_ptr() as *const u64 as u64);
        String::from_utf8(bytes).unwrap()
    }
}

pub fn prepaid_gas() -> u64 {
    unsafe { exports::prepaid_gas() }
}

pub fn used_gas() -> u64 {
    unsafe { exports::used_gas() }
}

pub fn promise_create(
    account_id: AccountId,
    method_name: &[u8],
    arguments: &[u8],
    amount: Balance,
    gas: Gas,
) -> u64 {
    let account_id = account_id.as_bytes();
    unsafe {
        exports::promise_create(
            account_id.len() as _,
            account_id.as_ptr() as _,
            method_name.len() as _,
            method_name.as_ptr() as _,
            arguments.len() as _,
            arguments.as_ptr() as _,
            &amount as *const Balance as _,
            gas,
        )
    }
}

pub fn promise_then(
    promise_idx: u64,
    account_id: AccountId,
    method_name: &[u8],
    arguments: &[u8],
    amount: Balance,
    gas: Gas,
) -> u64 {
    let account_id = account_id.as_bytes();
    unsafe {
        exports::promise_then(
            promise_idx,
            account_id.len() as _,
            account_id.as_ptr() as _,
            method_name.len() as _,
            method_name.as_ptr() as _,
            arguments.len() as _,
            arguments.as_ptr() as _,
            &amount as *const Balance as _,
            gas,
        )
    }
}

pub fn promise_return(promise_idx: u64) {
    unsafe {
        exports::promise_return(promise_idx);
    }
}

pub fn promise_results_count() -> u64 {
    unsafe { exports::promise_results_count() }
}

pub fn promise_result(result_idx: u64) -> PromiseResult {
    unsafe {
        match exports::promise_result(result_idx, 0) {
            0 => PromiseResult::NotReady,
            1 => {
                let bytes: Vec<u8> = vec![0; exports::register_len(0) as usize];
                exports::read_register(0, bytes.as_ptr() as *const u64 as u64);
                PromiseResult::Successful(bytes)
            }
            2 => PromiseResult::Failed,
            _ => panic!(RETURN_CODE_ERR),
        }
    }
}

pub fn assert_private_call() {
    assert_eq!(
        predecessor_account_id(),
        current_account_id(),
        "Function is private"
    );
}

pub fn attached_deposit() -> Balance {
    unsafe {
        let data = [0u8; size_of::<Balance>()];
        exports::attached_deposit(data.as_ptr() as u64);
        Balance::from_le_bytes(data)
    }
}

pub fn account_balance() -> Balance {
    unsafe {
        let data = [0u8; size_of::<Balance>()];
        exports::account_balance(data.as_ptr() as u64);
        Balance::from_le_bytes(data)
    }
}

pub fn assert_one_yocto() {
    assert_eq!(
        attached_deposit(),
        1,
        "Requires attached deposit of exactly 1 yoctoNEAR"
    )
}
