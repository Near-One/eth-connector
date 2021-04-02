#![allow(unused_imports)]
#![allow(dead_code)]
#![allow(unused_variables)]
use connector::EthConnectorContract;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::serde_json;
use near_sdk_sim::types::AccountId;
use near_sdk_sim::{call, deploy, init_simulator, view, ContractAccount, UserAccount, DEFAULT_GAS};
use std::convert::TryFrom;

mod connector;

near_sdk_sim::lazy_static! {
    static ref TOKEN_WASM_BYTES: &'static [u8] = include_bytes!("../../pure-eth-connector/res/pure_eth_connector.wasm").as_ref();
}

const PROOF_DATA: &'static str = r#"{"log_index":3,"log_entry_data":[248,251,148,185,247,33,158,67,78,170,112,33,174,95,158,205,12,171,194,64,84,71,163,248,66,160,91,253,175,236,57,174,146,96,226,220,66,250,35,21,1,244,101,251,175,87,166,187,188,197,23,157,14,86,105,51,218,174,160,0,0,0,0,0,0,0,0,0,0,0,0,137,27,39,73,35,139,39,255,88,233,81,8,142,85,176,77,231,29,195,116,184,160,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,96,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,197,18,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,194,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,114,111,111,116,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"receipt_index":2,"receipt_data":[249,2,7,1,131,4,23,235,185,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16,0,0,0,0,0,0,64,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,64,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,64,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,16,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,64,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,8,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,248,253,248,251,148,185,247,33,158,67,78,170,112,33,174,95,158,205,12,171,194,64,84,71,163,248,66,160,91,253,175,236,57,174,146,96,226,220,66,250,35,21,1,244,101,251,175,87,166,187,188,197,23,157,14,86,105,51,218,174,160,0,0,0,0,0,0,0,0,0,0,0,0,137,27,39,73,35,139,39,255,88,233,81,8,142,85,176,77,231,29,195,116,184,160,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,96,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,197,18,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,194,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,114,111,111,116,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"header_data":[249,2,23,160,38,218,34,66,85,105,115,189,143,118,209,253,91,112,243,84,86,221,182,255,58,218,175,109,4,178,232,20,117,166,136,9,160,29,204,77,232,222,199,93,122,171,133,181,103,182,204,212,26,211,18,69,27,148,138,116,19,240,161,66,253,64,212,147,71,148,133,144,61,184,18,226,104,232,95,87,168,157,222,54,247,146,130,252,104,73,160,250,170,98,144,140,231,40,189,51,132,183,104,161,48,73,186,16,107,80,209,61,81,31,74,150,59,83,7,228,108,245,178,160,64,153,231,0,109,34,81,241,124,239,126,194,51,46,147,136,94,70,172,155,236,69,200,235,252,152,77,9,210,65,9,90,160,204,36,218,251,132,243,193,164,153,49,91,123,27,58,22,240,122,88,39,192,146,58,25,184,207,94,104,103,190,145,107,148,185,1,0,0,68,0,16,0,0,0,0,0,2,0,0,160,128,64,8,0,0,0,8,64,0,0,0,0,52,64,0,16,0,129,0,0,0,0,65,0,4,0,136,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,10,32,64,0,0,32,32,0,20,0,128,32,0,0,1,0,4,0,0,40,1,0,0,16,1,32,0,0,16,0,64,32,0,0,0,0,0,0,0,128,16,0,0,0,131,0,64,0,0,32,64,0,0,0,8,6,0,0,0,0,0,8,0,0,0,2,16,16,4,0,40,80,8,132,0,64,0,128,64,0,65,0,0,0,0,0,64,16,1,0,36,0,0,129,0,9,64,0,0,0,0,6,0,0,2,0,1,0,0,0,128,0,16,0,8,0,128,0,1,6,0,128,128,4,0,8,0,1,0,16,10,1,0,0,0,16,0,0,0,2,0,0,4,0,0,64,1,0,0,2,0,0,0,2,0,64,0,8,0,16,0,0,1,4,2,0,32,64,81,16,0,24,0,0,8,0,144,0,0,64,8,16,0,8,0,2,32,0,0,64,128,0,16,8,136,0,2,0,0,0,132,24,139,229,22,131,149,69,210,131,122,18,0,131,38,221,21,132,96,66,160,230,153,216,131,1,9,10,132,103,101,116,104,136,103,111,49,46,49,51,46,51,133,108,105,110,117,120,160,39,207,6,45,187,127,3,47,8,180,41,100,202,29,13,201,84,59,161,13,186,184,64,59,16,6,104,128,119,137,23,223,136,39,8,135,193,134,128,177,179],"proof":[[248,113,160,89,232,21,229,118,139,147,190,61,192,149,82,65,92,124,231,242,144,39,70,87,126,160,208,38,218,92,45,17,76,149,19,160,247,117,83,108,74,228,229,64,246,232,113,17,33,68,209,141,77,116,143,134,74,195,7,126,45,242,217,177,29,153,77,25,128,128,128,128,128,128,160,9,222,167,201,202,46,111,46,237,72,14,252,141,153,239,228,28,172,236,75,178,183,47,165,225,84,179,244,219,55,11,125,128,128,128,128,128,128,128,128],[249,1,241,128,160,223,193,3,254,244,206,120,156,54,88,76,198,72,234,234,61,118,221,224,225,63,246,242,60,221,11,192,98,102,190,253,43,160,84,11,3,67,195,97,17,49,13,104,171,32,157,63,89,232,226,221,234,78,189,22,157,36,149,234,142,249,204,144,27,74,160,237,151,63,250,228,171,55,124,229,180,2,178,167,95,167,25,218,179,202,74,68,133,112,136,161,179,246,129,219,59,154,49,160,141,71,128,160,140,86,134,172,164,9,183,147,187,234,254,194,142,57,184,15,217,45,36,84,205,195,247,209,81,17,209,51,160,216,68,61,133,209,52,6,44,200,202,216,91,13,77,229,174,203,128,183,246,59,254,124,255,84,244,89,111,204,114,192,21,160,90,98,180,251,185,255,215,29,66,197,42,93,240,125,14,152,38,90,141,255,155,47,122,86,163,197,141,156,70,226,162,117,160,236,177,235,229,71,168,177,20,224,219,166,253,188,78,213,189,9,248,181,81,187,242,173,41,12,78,233,138,28,233,151,219,160,112,115,94,52,67,97,22,112,97,38,135,177,246,177,104,121,217,71,60,38,5,241,53,114,95,188,122,32,8,157,201,151,160,115,56,0,45,157,250,125,18,125,239,108,44,15,18,128,23,253,66,37,241,147,173,183,184,254,166,254,98,218,113,163,213,160,139,116,222,47,58,237,92,252,42,142,240,149,138,171,60,97,56,134,33,200,12,80,19,221,123,74,253,55,159,160,121,47,160,13,173,135,227,165,141,59,244,142,12,198,127,19,164,37,218,251,82,177,131,89,176,46,155,142,113,226,215,39,191,47,131,160,154,7,27,250,232,119,232,97,194,201,82,78,247,98,94,23,241,159,214,64,87,248,21,167,30,155,131,160,105,197,26,43,160,233,61,34,140,39,167,210,39,50,140,219,187,117,198,98,106,17,188,49,160,141,68,95,252,112,118,219,206,142,104,175,5,160,40,47,188,228,166,39,128,177,241,44,2,180,84,178,35,45,76,9,67,167,70,226,192,138,185,170,205,110,190,6,163,68,160,88,211,112,220,92,97,52,179,239,5,189,65,220,39,140,221,38,173,108,53,42,206,5,89,139,96,134,151,77,222,96,67,128],[249,2,14,32,185,2,10,249,2,7,1,131,4,23,235,185,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16,0,0,0,0,0,0,64,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,64,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,64,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,16,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,64,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,8,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,248,253,248,251,148,185,247,33,158,67,78,170,112,33,174,95,158,205,12,171,194,64,84,71,163,248,66,160,91,253,175,236,57,174,146,96,226,220,66,250,35,21,1,244,101,251,175,87,166,187,188,197,23,157,14,86,105,51,218,174,160,0,0,0,0,0,0,0,0,0,0,0,0,137,27,39,73,35,139,39,255,88,233,81,8,142,85,176,77,231,29,195,116,184,160,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,96,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,197,18,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,194,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,114,111,111,116,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]],"skip_bridge_call":false}"#;
const DEPOSITED_AMOUNT: u128 = 50450;
const DEPOSITED_FEE: u128 = 450;
const DEPOSITED_RECIPIENT: &'static str = "root";
const CUSTODIAN_ADDRESS: &'static str = "b9f7219e434EAA7021Ae5f9Ecd0CaBc2405447A3";
const PROVER_ACCOUNT: &'static str = "eth_connector.root";
const CONTRACT_ACC: &'static str = "eth_connector.root";
const RECIPIENT_ETH_ADDRESS: &'static str = "891b2749238b27ff58e951088e55b04de71dc374";

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Proof {
    pub log_index: u64,
    pub log_entry_data: Vec<u8>,
    pub receipt_index: u64,
    pub receipt_data: Vec<u8>,
    pub header_data: Vec<u8>,
    pub proof: Vec<Vec<u8>>,
    pub skip_bridge_call: bool,
}

fn init() -> (UserAccount, ContractAccount<EthConnectorContract>) {
    let master_account = init_simulator(None);

    let contract_account = deploy! {
        contract: EthConnectorContract,
        contract_id: CONTRACT_ACC,
        bytes: &TOKEN_WASM_BYTES,
        signer_account: master_account,
        init_method: new(PROVER_ACCOUNT.into(), CUSTODIAN_ADDRESS.into())
    };
    (master_account, contract_account)
}

#[test]
fn init_test() {
    let (_master_account, _contract_account) = init();
}

#[test]
fn test_balance_of() {
    let (_master_account, contract) = init();
    let acc_id = AccountId::try_from(CONTRACT_ACC).unwrap();
    let balance = view!(contract.ft_balance_of(acc_id)).unwrap_json::<u128>();
    assert_eq!(balance, 0);
}

#[test]
fn test_sim_deposit() {
    let (master_account, contract) = init();

    call_deposit(&master_account, &contract);

    let minted_balance =
        view!(contract.ft_balance_of(DEPOSITED_RECIPIENT.into())).unwrap_json::<u128>();
    assert_eq!(minted_balance, DEPOSITED_AMOUNT - DEPOSITED_FEE);

    let minted_balance = view!(contract.ft_balance_of(CONTRACT_ACC.into())).unwrap_json::<u128>();
    assert_eq!(minted_balance, DEPOSITED_FEE);
}

#[test]
fn test_sim_withdraw() {
    let (master_account, contract) = init();
    call_deposit(&master_account, &contract);

    let withdraw_amount: u128 = 100;
    let _res = call!(
        master_account,
        contract.withdraw(RECIPIENT_ETH_ADDRESS.into(), withdraw_amount as u64),
        gas = DEFAULT_GAS * 3
    );

    //println!("#1: {:#?}", _res.promise_results());

    let minted_balance =
        view!(contract.ft_balance_of(DEPOSITED_RECIPIENT.into())).unwrap_json::<u128>();
    assert_eq!(
        minted_balance,
        DEPOSITED_AMOUNT - DEPOSITED_FEE - withdraw_amount
    );

    let minted_balance = view!(contract.ft_balance_of(CONTRACT_ACC.into())).unwrap_json::<u128>();
    assert_eq!(minted_balance, DEPOSITED_FEE);
}

fn call_deposit(master_account: &UserAccount, contract: &ContractAccount<EthConnectorContract>) {
    let proof: Proof = serde_json::from_str(PROOF_DATA).unwrap();

    let _res = call!(
        master_account,
        contract.deposit(
            proof.log_index,
            proof.log_entry_data,
            proof.receipt_index,
            proof.receipt_data,
            proof.header_data,
            proof.proof,
            proof.skip_bridge_call
        ),
        gas = DEFAULT_GAS * 3
    );

    //println!("#1: {:#?}", _res.promise_results());
}

#[test]
fn test_ft_total_supply() {
    let (master_account, contract) = init();

    call_deposit(&master_account, &contract);

    let balance = view!(contract.ft_balance_of(DEPOSITED_RECIPIENT.into())).unwrap_json::<u128>();
    assert_eq!(balance, DEPOSITED_AMOUNT - DEPOSITED_FEE);

    let balance = view!(contract.ft_balance_of(CONTRACT_ACC.into())).unwrap_json::<u128>();
    assert_eq!(balance, DEPOSITED_FEE);

    let balance = view!(contract.ft_total_supply()).unwrap_json::<u128>();
    assert_eq!(balance, DEPOSITED_AMOUNT);
}

#[test]
fn test_ft_transfer() {
    let (master_account, contract) = init();

    call_deposit(&master_account, &contract);

    let balance = view!(contract.ft_balance_of(DEPOSITED_RECIPIENT.into())).unwrap_json::<u128>();
    assert_eq!(balance, DEPOSITED_AMOUNT - DEPOSITED_FEE);

    let balance = view!(contract.ft_balance_of(CONTRACT_ACC.into())).unwrap_json::<u128>();
    assert_eq!(balance, DEPOSITED_FEE);

    let transfer_amount = 777;
    let _res = call!(
        master_account,
        contract.ft_transfer(
            CONTRACT_ACC.into(),
            transfer_amount,
            Some("Transfered".into())
        ),
        deposit = 1
    );

    //println!("#1: {:#?}", _res.promise_results());
    let balance = view!(contract.ft_balance_of(CONTRACT_ACC.into())).unwrap_json::<u128>();
    assert_eq!(balance, DEPOSITED_FEE + transfer_amount as u128);
}

#[test]
fn test_ft_transfer_call() {
    let (master_account, contract) = init();

    call_deposit(&master_account, &contract);

    let balance = view!(contract.ft_balance_of(DEPOSITED_RECIPIENT.into())).unwrap_json::<u128>();
    assert_eq!(balance, DEPOSITED_AMOUNT - DEPOSITED_FEE);

    let balance = view!(contract.ft_balance_of(CONTRACT_ACC.into())).unwrap_json::<u128>();
    assert_eq!(balance, DEPOSITED_FEE);
    
    let transfer_amount = 100;
    let _res = call!(
        master_account,
        contract.ft_transfer_call(
            CONTRACT_ACC.into(),
            transfer_amount,
            Some("Transfered".into()),
            "msg".into()
        ),
        deposit = 1
    );

    println!("#1: {:#?}", _res.promise_results());
    // let balance = view!(contract.ft_balance_of(CONTRACT_ACC.into())).unwrap_json::<u128>();
    // assert_eq!(balance, DEPOSITED_FEE + transfer_amount as u128);
}
