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

pub mod deposit_event;
pub mod ethabi;
pub mod fungible_token;
pub mod log_entry;
pub mod prover;
pub mod sdk;
pub mod types;

use crate::deposit_event::EthDepositedEvent;
use crate::fungible_token::FungibleToken;
use crate::prover::{validate_eth_address, Proof};
use crate::types::{EthConnector, InitCallArgs};
use alloc::collections::BTreeSet;
use alloc::string::String;
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

#[no_mangle]
pub extern "C" fn deposit() {
    use core::ops::Sub;
    use hex::ToHex;

    let input = sdk::read_input();
    let proof = Proof::try_from_slice(&input).unwrap();
    let event = EthDepositedEvent::from_log_entry_data(&proof.log_entry_data);
    let data = sdk::read_storage(sdk::STATE_KEY).expect("Failed read storage");
    let contract = EthConnector::try_from_slice(&data).unwrap();

    sdk::log_utf8(
        format!(
            "Deposit started: from {:?} ETH to {:?} NEAR with amount: {:?} and fee {:?}",
            event.sender,
            event.recipient,
            event.amount.as_u128(),
            event.fee.as_u128()
        )
        .as_bytes(),
    );

    assert_eq!(
        event.eth_custodian_address,
        contract.eth_custodian_address,
        "Event's address {} does not match custodian address {}",
        &event.eth_custodian_address.to_hex::<String>(),
        &contract.eth_custodian_address.to_hex::<String>(),
    );
    assert!(
        event.amount.sub(event.fee).as_u128() > 0,
        "Not enough balance for deposit fee"
    );
    let _account_id = sdk::current_account_id();
    let _prepaid_gas = sdk::prepaid_gas();
    let _proof_1 = proof.try_to_vec().unwrap();
    sdk::log_utf8(
        format!(
            "Deposit verify_log_entry for prover: {:?}",
            contract.prover_account,
        )
        .as_bytes(),
    );
}
