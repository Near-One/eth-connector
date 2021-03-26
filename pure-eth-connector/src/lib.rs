#![warn(clippy::all)]
#![no_std]
#![feature(lang_items)]
#![feature(core_intrinsics)]
#![feature(alloc_error_handler)]
#![feature(panic_info_message)]
extern crate alloc;

mod connector;
mod deposit_event;
mod fungible_token;
mod json;
mod log_entry;
mod prover;
mod sdk;
mod types;

pub use crate::connector::EthConnectorContract;
pub use crate::deposit_event::*;
pub use crate::fungible_token::*;
pub use crate::json::parse_json;
pub use crate::log_entry::*;
pub use crate::prover::*;
pub use crate::types::*;
pub use alloc::{
    collections::{BTreeMap, BTreeSet},
    format,
    string::{String, ToString},
    vec,
    vec::Vec,
};
pub use borsh::{BorshDeserialize, BorshSerialize};

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[lang = "panic_impl"]
#[no_mangle]
#[cfg_attr(not(feature = "log"), allow(unused_variables))]
#[allow(unused_unsafe)]
pub extern "C" fn on_panic(info: &core::panic::PanicInfo) -> ! {
    #[cfg(feature = "log")]
    if let Some(msg) = info.message() {
        let msg = if let Some(log) = info.location() {
            [msg.to_string(), " [".into(), log.to_string(), "]".into()].join("")
        } else {
            msg.to_string()
        };
        sdk::log(msg);
    } else if let Some(log) = info.location() {
        sdk::log(log.to_string());
    }
    unsafe { core::intrinsics::abort() }
}

/// # Safety
///
/// This function only for no-std alloc error handler
#[alloc_error_handler]
#[no_mangle]
pub unsafe fn on_alloc_error(_: core::alloc::Layout) -> ! {
    core::intrinsics::abort();
}

#[no_mangle]
pub extern "C" fn new() {
    EthConnectorContract::init_contract()
}

#[no_mangle]
pub extern "C" fn deposit() {
    EthConnectorContract::new().deposit()
}

#[no_mangle]
pub extern "C" fn withdraw() {
    EthConnectorContract::new().withdraw()
}

#[no_mangle]
pub extern "C" fn finish_deposit() {
    EthConnectorContract::new().finish_deposit();
}

#[no_mangle]
pub extern "C" fn ft_total_supply() {
    EthConnectorContract::new().ft_total_supply();
}

#[no_mangle]
pub extern "C" fn ft_balance_of() {
    EthConnectorContract::new().ft_balance_of();
}

#[no_mangle]
pub extern "C" fn ft_transfer() {
    EthConnectorContract::new().ft_transfer();
}

#[no_mangle]
pub extern "C" fn ft_resolve_transfer() {
    EthConnectorContract::new().ft_resolve_transfer();
}

#[no_mangle]
pub extern "C" fn ft_transfer_call() {
    EthConnectorContract::new().ft_transfer_call();
}

#[no_mangle]
pub extern "C" fn storage_deposit() {
    EthConnectorContract::new().storage_deposit()
}

#[no_mangle]
pub extern "C" fn storage_withdraw() {
    EthConnectorContract::new().storage_withdraw()
}

#[no_mangle]
pub extern "C" fn storage_balance_of() {
    EthConnectorContract::new().storage_balance_of()
}

/// TODO: will be removed - for eth-prover tests only
#[no_mangle]
pub extern "C" fn verify_log_entry() {
    #[cfg(feature = "log")]
    sdk::log("Call from verify_log_entry".into());
    let data = true.try_to_vec().unwrap();
    sdk::value_return(&data[..]);
}
