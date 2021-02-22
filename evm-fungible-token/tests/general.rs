use near_sdk_sim::{
    deploy, init_simulator, to_yocto,  ContractAccount, UserAccount,
};

extern crate eth_connector;
use eth_connector::EthConnectorContract;

near_sdk_sim::lazy_static! {
    static ref TOKEN_WASM_BYTES: &'static [u8] = include_bytes!("../res/eth_connector.wasm").as_ref();
}

fn init(
    initial_balance: u128,
) -> (
    UserAccount,
    ContractAccount<EthConnectorContract>,
    UserAccount,
) {
    let master_account = init_simulator(None);
     let eth_proof = "eth_proof".to_string();
    // let acc = master_account.deploy(&TOKEN_WASM_BYTES, eth_proof, near_sdk_sim::STORAGE_AMOUNT);
    // let contract_account = near_sdk_sim::ContractAccount{
    //     user_account: acc,
    //     contract: EthConnector{account_id: "".to_string()},
    // };
    let contract_account = deploy! {
        contract: EthConnectorContract,
        contract_id: "contract",
        bytes: &TOKEN_WASM_BYTES,
        signer_account: master_account,
        init_method: new(master_account.account_id(), eth_proof.into())
    };
    let alice = master_account.create_user("alice".to_string(), initial_balance);
    (master_account, contract_account, alice)
}

#[test]
fn init_test() {
    let (_master_account, _contract_account, _alice) = init(to_yocto("10000"));
}
