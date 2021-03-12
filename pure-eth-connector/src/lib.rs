#![no_std]
#![feature(core_intrinsics)]
#![feature(alloc_error_handler)]
#[macro_use]
extern crate alloc;
extern crate core;

extern crate ethereum_types;
extern crate rstd;
extern crate rustc_hex as hex;
extern crate tiny_keccak;

pub mod ethabi;
pub mod fungible_token;
pub mod log_entry;
pub mod prover;
pub mod sdk;
pub mod types;

use crate::fungible_token::FungibleToken;
use crate::prover::validate_eth_address;
use crate::types::{EthConnector, InitCallArgs};
use alloc::collections::BTreeSet;
use borsh::{BorshDeserialize, BorshSerialize};

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[panic_handler]
#[no_mangle]
pub unsafe fn on_panic(_info: &::core::panic::PanicInfo) -> ! {
    core::intrinsics::abort();
}

#[alloc_error_handler]
#[no_mangle]
pub unsafe fn on_alloc_error(_: core::alloc::Layout) -> ! {
    core::intrinsics::abort();
}

#[no_mangle]
pub extern "C" fn init() {
    let input = sdk::read_input();
    let args: InitCallArgs = InitCallArgs::try_from_slice(&input).unwrap();
    let ft = FungibleToken::new();
    let contract_data = EthConnector {
        prover_account: args.prover_account,
        eth_custodian_address: validate_eth_address(args.eth_custodian_address),
        used_events: BTreeSet::new(),
        token: ft,
    };
    let data = contract_data.try_to_vec().unwrap();
    sdk::write_storage(sdk::STATE_KEY, &data[..]);
}
