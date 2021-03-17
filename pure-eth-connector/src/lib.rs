#![no_std]
#![feature(core_intrinsics)]
#![feature(alloc_error_handler)]
#![feature(panic_info_message)]
extern crate alloc;

mod connector;
mod deposit_event;
mod fungible_token;
mod log_entry;
mod prover;
mod sdk;
mod types;

pub use crate::deposit_event::*;
pub use crate::fungible_token::*;
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

#[panic_handler]
#[no_mangle]
pub unsafe fn on_panic(info: &core::panic::PanicInfo) -> ! {
    #[cfg(feature = "log")]
    if let Some(msg) = info.message() {
        let msg = if let Some(log) = info.location() {
            format!("{}: {:?}", msg, log)
        } else {
            format!("{}", msg)
        };
        sdk::log(format!("panic: {}", msg));
    } else if let Some(log) = info.location() {
        sdk::log(format!("{:?}", log));
    }
    core::intrinsics::abort();
}

#[alloc_error_handler]
#[no_mangle]
pub unsafe fn on_alloc_error(_: core::alloc::Layout) -> ! {
    core::intrinsics::abort();
}
