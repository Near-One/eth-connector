use near_sdk_sim::{
    call, deploy, init_simulator, to_yocto, view, ContractAccount, UserAccount, DEFAULT_GAS,
    STORAGE_AMOUNT,
};

extern crate eth_connector;
use eth_connector::EthConnector;

near_sdk_sim::lazy_static! {
    static ref TOKEN_WASM_BYTES: &'static [u8] = include_bytes!("../res/eth_connector.wasm").as_ref();
}

fn init(
    initial_balance: u128,
) -> (
    UserAccount,
    ContractAccount<CrossContractContract>,
    UserAccount,
) {
    let master_account = init_simulator(None);
    let contract_account = deploy! {
        contract: CrossContractContract,
        contract_id: "contract",
        bytes: &TOKEN_WASM_BYTES,
        signer_account: master_account
    };
    let alice = master_account.create_user("alice".to_string(), initial_balance);
    (master_account, contract_account, alice)
}

#[test]
fn init_test() {
    let (_master_account, _contract_account, _alice) = init(to_yocto("10000"));
}
