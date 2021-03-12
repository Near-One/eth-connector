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
use crate::types::{EthConnector, FinishDepositCallArgs, InitCallArgs, PromiseResult};
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
    let args: InitCallArgs = InitCallArgs::try_from_slice(&sdk::read_input()).unwrap();
    let ft = FungibleToken::new();
    let contract_data = EthConnector {
        prover_account: args.prover_account,
        eth_custodian_address: validate_eth_address(args.eth_custodian_address),
        used_events: BTreeSet::new(),
        token: ft,
    };
    sdk::init_contract(&contract_data.try_to_vec().unwrap());
}

#[no_mangle]
pub extern "C" fn deposit() {
    use core::ops::Sub;
    use hex::ToHex;

    let proof = Proof::try_from_slice(&sdk::read_input()).unwrap();
    let event = EthDepositedEvent::from_log_entry_data(&proof.log_entry_data);
    let contract: EthConnector = sdk::get_contract_data();

    sdk::log(format!(
        "Deposit started: from {:?} ETH to {:?} NEAR with amount: {:?} and fee {:?}",
        event.sender,
        event.recipient,
        event.amount.as_u128(),
        event.fee.as_u128()
    ));

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
    let account_id = sdk::current_account_id();
    let prepaid_gas = sdk::prepaid_gas();
    let proof_1 = proof.try_to_vec().unwrap();
    sdk::log(format!(
        "Deposit verify_log_entry for prover: {:?}",
        contract.prover_account,
    ));
    let promise0 = sdk::promise_create(
        contract.prover_account.clone(),
        b"verify_log_entry",
        &proof_1[..],
        sdk::NO_DEPOSIT,
        prepaid_gas / 4,
    );
    let data = FinishDepositCallArgs {
        new_owner_id: event.recipient,
        amount: event.amount.as_u128(),
        fee: event.fee.as_u128(),
        proof,
    }
    .try_to_vec()
    .unwrap();
    let promise1 = sdk::promise_then(
        promise0,
        account_id,
        b"finish_deposit",
        &data[..],
        sdk::NO_DEPOSIT,
        prepaid_gas / 4,
    );
    sdk::promise_return(promise1);
}

#[no_mangle]
pub extern "C" fn finish_deposit() {
    use alloc::vec::Vec;

    sdk::assert_private_call();
    let data: FinishDepositCallArgs =
        FinishDepositCallArgs::try_from_slice(&sdk::read_input()).unwrap();
    sdk::log(format!("Finish deposit amount: {:?}", data.amount));
    assert_eq!(sdk::promise_results_count(), 1);
    let data0: Vec<u8> = match sdk::promise_result(0) {
        PromiseResult::Successful(x) => x,
        _ => panic!("Promise with index 0 failed"),
    };
    sdk::log("Check verification_success".into());
    let verification_success: bool = bool::try_from_slice(&data0).unwrap();
    assert!(verification_success, "Failed to verify the proof");
    /*self.record_proof(&proof.get_key());

    let amount: Balance = amount.into();
    let fee: Balance = fee.into();

    // Mint tokens to recipient minus fee
    self.mint(new_owner_id, amount - fee);
    // Mint fee for Predecessor
    self.mint(env::predecessor_account_id(), fee);
    */
}
