#![no_std]
#![feature(core_intrinsics)]
#![feature(alloc_error_handler)]
#![feature(panic_info_message)]
#[macro_use]
extern crate alloc;
extern crate core;

// extern crate rstd;
// extern crate rustc_hex as hex;
// extern crate ethabi;

pub mod deposit_event;
pub mod fungible_token;
pub mod log_entry;
pub mod prover;
pub mod sdk;
pub mod types;

use crate::deposit_event::EthDepositedEvent;
use crate::fungible_token::FungibleToken;
use crate::prover::{validate_eth_address, Proof};
use crate::types::{
    AccountId, Balance, EthConnector, FinishDepositCallArgs, InitCallArgs, PromiseResult,
};
use alloc::collections::BTreeSet;
use alloc::vec::Vec;
use borsh::{BorshDeserialize, BorshSerialize};

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[panic_handler]
#[no_mangle]
pub unsafe fn on_panic(info: &::core::panic::PanicInfo) -> ! {
    #[cfg(feature = "log")]
    if let Some(msg) = info.message() {
        let msg = if let Some(log) = info.location() {
            format!("{}\n{:?}", msg, log)
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

#[no_mangle]
pub extern "C" fn new() {
    //assert!(!sdk::state_exists(), "Contract already initialized");
    #[cfg(feature = "log")]
    sdk::log("[init contract]".into());
    let args: InitCallArgs = serde_json::from_slice(&sdk::read_input()[..]).unwrap();
    let owner_id = sdk::current_account_id();
    let mut ft = FungibleToken::new();
    ft.internal_register_account(&owner_id);
    ft.internal_deposit(&owner_id, 0);
    sdk::log(format!("{:#?}", args));
    let contract_data = EthConnector {
        prover_account: args.prover_account,
        eth_custodian_address: validate_eth_address(args.eth_custodian_address),
        used_events: BTreeSet::new(),
        token: ft,
    };
    sdk::save_contract(&contract_data);
    sdk::log("[Contract initialized successfully]".into());
}

#[no_mangle]
pub extern "C" fn deposit() {
    #[cfg(feature = "log")]
    sdk::log("[Deposit tokens]".into());
    use core::ops::Sub;

    let proof: Proof = serde_json::from_slice(&sdk::read_input()[..]).unwrap();
    let event = EthDepositedEvent::from_log_entry_data(&proof.log_entry_data);
    sdk::log(format!("Event: {:#?}", event));
    let mut contract: EthConnector = sdk::get_contract_data();
    contract.prover_account = sdk::current_account_id();

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
        hex::encode(&event.eth_custodian_address),
        hex::encode(&contract.eth_custodian_address),
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
    sdk::log(contract.prover_account.clone());
    let promise0 = sdk::promise_create(
        contract.prover_account.clone(),
        b"verify_log_entry",
        &proof_1[..],
        sdk::NO_DEPOSIT,
        prepaid_gas / 4,
    );
    /*sdk::log("[#6]".into());
    let data = FinishDepositCallArgs {
        new_owner_id: event.recipient,
        amount: event.amount.as_u128(),
        fee: event.fee.as_u128(),
        proof,
    }
    .try_to_vec()
    .unwrap();
    sdk::log("[#7]".into());
    let pro77mise1 = sdk::promise_then(
        promise0,
        account_id,
        b"finish_deposit",
        &data[..],
        sdk::NO_DEPOSIT,
        prepaid_gas / 4,
    );*/
    sdk::promise_return(promise0);
    sdk::log("[#10]".into());
}

#[no_mangle]
pub extern "C" fn finish_deposit() {
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
    record_proof(data.proof.get_key());

    // Mint tokens to recipient minus fee
    mint(data.new_owner_id, data.amount - data.fee);
    // Mint fee for Predecessor
    mint(sdk::predecessor_account_id(), data.fee);
}

fn record_proof(key: Vec<u8>) -> Balance {
    let mut contract: EthConnector = sdk::get_contract_data();
    let initial_storage = sdk::storage_usage();

    assert!(
        !contract.used_events.contains(&key[..]),
        "Proof event cannot be reused. Proof already exist."
    );
    contract.used_events.insert(key);
    let current_storage = sdk::storage_usage();
    let attached_deposit = sdk::attached_deposit();
    let required_deposit =
        Balance::from(current_storage - initial_storage) * sdk::STORAGE_PRICE_PER_BYTE;
    sdk::save_contract(&contract);
    attached_deposit - required_deposit
}

#[no_mangle]
pub extern "C" fn verify_log_entry() {
    sdk::log("Call from verify_log_entry".into());
}

fn mint(owner_id: AccountId, amount: Balance) {
    sdk::log(format!("Mint {:?} tokens for: {:?}", amount, owner_id));

    // if self.token.accounts.get(&owner_id).is_none() {
    //     // TODO: NEP-145 Account Storage impelemtation nee
    //     // It spent additonal account amount fot storage
    //     self.token.accounts.insert(&owner_id, &0);
    // }
    // self.token.internal_deposit(&owner_id, amount);
    sdk::log("Mint success".into());
}
