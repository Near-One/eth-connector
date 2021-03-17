use super::*;

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
    let contract_data = EthConnector {
        prover_account: args.prover_account,
        eth_custodian_address: validate_eth_address(args.eth_custodian_address),
        used_events: BTreeSet::new(),
        token: ft,
    };
    sdk::save_contract(&contract_data);
}

#[no_mangle]
pub extern "C" fn deposit() {
    #[cfg(feature = "log")]
    sdk::log("[Deposit tokens]".into());
    use core::ops::Sub;

    let proof: Proof = serde_json::from_slice(&sdk::read_input()[..]).unwrap();
    let event = EthDepositedEvent::from_log_entry_data(&proof.log_entry_data);
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
    #[cfg(feature = "log")]
    sdk::log(format!(
        "Deposit verify_log_entry for prover: {:?}",
        contract.prover_account,
    ));
    let promise0 = sdk::promise_create(
        contract.prover_account.clone(),
        b"verify_log_entry",
        &proof_1[..],
        sdk::NO_DEPOSIT,
        prepaid_gas / 3,
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
        prepaid_gas / 3,
    );
    sdk::promise_return(promise1);
}

#[no_mangle]
pub extern "C" fn finish_deposit() {
    sdk::assert_private_call();
    let data: FinishDepositCallArgs =
        FinishDepositCallArgs::try_from_slice(&sdk::read_input()).unwrap();
    #[cfg(feature = "log")]
    sdk::log(format!("Finish deposit amount: {:?}", data.amount));
    assert_eq!(sdk::promise_results_count(), 1);
    let data0: Vec<u8> = match sdk::promise_result(0) {
        PromiseResult::Successful(x) => x,
        _ => panic!("Promise with index 0 failed"),
    };
    #[cfg(feature = "log")]
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
    #[cfg(feature = "log")]
    sdk::log("Call from verify_log_entry".into());
    let data = true.try_to_vec().unwrap();
    sdk::value_return(&data[..]);
}

fn mint(owner_id: AccountId, amount: Balance) {
    #[cfg(feature = "log")]
    sdk::log(format!("Mint {:?} tokens for: {:?}", amount, owner_id));
    let _contract: EthConnector = sdk::get_contract_data();
    //contract.token.ac()

    // if self.token.accounts.get(&owner_id).is_none() {
    //     // TODO: NEP-145 Account Storage impelemtation nee
    //     // It spent additonal account amount fot storage
    //     self.token.accounts.insert(&owner_id, &0);
    // }
    // self.token.internal_deposit(&owner_id, amount);
    #[cfg(feature = "log")]
    sdk::log("Mint success".into());
}
