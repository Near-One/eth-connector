use near_sdk_sim::{
    call, deploy, init_simulator, view, ContractAccount, UserAccount, DEFAULT_GAS,
};

extern crate eth_connector;
use eth_connector::{EthConnectorContract, Proof};
use near_sdk::json_types::{ValidAccountId, U128};
use std::convert::TryFrom;

near_sdk_sim::lazy_static! {
    static ref TOKEN_WASM_BYTES: &'static [u8] = include_bytes!("../res/eth_connector.wasm").as_ref();
}

fn init() -> (UserAccount, ContractAccount<EthConnectorContract>) {
    let master_account = init_simulator(None);
    let eth_ecc = "79183fdbd80e2d8AeA1aCaA2f67bFb8a36d40A80";

    let contract_account = deploy! {
        contract: EthConnectorContract,
        contract_id: "contract",
        bytes: &TOKEN_WASM_BYTES,
        signer_account: master_account,
        init_method: new("contract".into(), eth_ecc.into())
    };
    (master_account, contract_account)
}

#[test]
fn init_test() {
    let (_master_account, _contract_account) = init();
}

#[test]
fn test_sim_deposit() {
    let (master_account, contract) = init();

    let proof = Proof {
        log_index: 0,
        log_entry_data: vec![],
        receipt_index: 0,
        receipt_data: vec![],
        header_data: vec![],
        proof: vec![],
        skip_bridge_call: false,
    };
    let _res = call!(
        master_account,
        contract.deposit(proof.clone()),
        gas = DEFAULT_GAS * 3
    );

    println!("#1: {:#?}", _res.promise_results());

    let acc_id = ValidAccountId::try_from("rcv1").unwrap();
    let res = view!(contract.ft_balance_of(acc_id));
    let minted_balance = res.unwrap_json::<U128>();
    assert_eq!(minted_balance, U128::from(100));
}

#[test]
fn test_sim_withdraw() {
    let (master_account, contract) = init();
    let proof = Proof {
        log_index: 0,
        log_entry_data: vec![],
        receipt_index: 0,
        receipt_data: vec![],
        header_data: vec![],
        proof: vec![],
        skip_bridge_call: false,
    };
    call!(
        master_account,
        contract.deposit(proof.clone()),
        gas = DEFAULT_GAS * 3
    );
    let acc_id = ValidAccountId::try_from("rcv1").unwrap();
    let res = view!(contract.ft_balance_of(acc_id.clone()));
    let minted_balance = res.unwrap_json::<U128>();
    assert_eq!(minted_balance, U128::from(100));

    let mut proof1 = proof.clone();
    proof1.log_index = 1;

    let _res = call!(
        master_account,
        contract.withdraw(proof1.clone()),
        gas = DEFAULT_GAS * 3
    );

    // println!("#1: {:#?}", _res.promise_results());
    let res = view!(contract.ft_balance_of(acc_id));
    let minted_balance = res.unwrap_json::<U128>();
    assert_eq!(minted_balance, U128::from(95));
}
