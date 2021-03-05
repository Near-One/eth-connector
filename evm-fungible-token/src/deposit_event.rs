use crate::prover::{EthAddress, EthEvent, EthEventParams};
use ethabi::ParamType;
use hex::ToHex;
use near_sdk::json_types::U128;
use near_sdk::AccountId;

/// Data that was emitted by the Ethereum Deposited event.
#[derive(Debug, PartialEq)]
pub struct EthDepositedEvent {
    pub eth_custodian_address: EthAddress,
    pub sender: AccountId,
    pub recipient: AccountId,
    pub amount: U128,
    pub fee: U128,
}

impl EthDepositedEvent {
    fn event_params() -> EthEventParams {
        vec![
            ("sender".to_string(), ParamType::Address, true),
            ("nearRecipient".to_string(), ParamType::String, true),
            ("amount".to_string(), ParamType::Uint(256), false),
            ("fee".to_string(), ParamType::Uint(256), false),
        ]
    }

    /// Parse raw log Etherium proof entry data.
    pub fn from_log_entry_data(data: &[u8]) -> Self {
        use near_sdk::{env, log};
        let event = EthEvent::fetch_log_entry_data(
            "DepositedToNear",
            EthDepositedEvent::event_params(),
            data,
        );
        let sender = event.log.params[0].value.clone().to_address().unwrap().0;
        let sender = (&sender).encode_hex::<String>();
        log!("recipient: {:?}", event.log.params[1].value.clone());
        let recipient = event.log.params[1].value.clone().to_string().unwrap();
        let amount = U128::from(
            event.log.params[2]
                .value
                .clone()
                .to_uint()
                .unwrap()
                .as_u128(),
        );
        let fee = U128::from(
            event.log.params[3]
                .value
                .clone()
                .to_uint()
                .unwrap()
                .as_u128(),
        );
        Self {
            eth_custodian_address: event.eth_custodian_address,
            sender,
            recipient,
            amount,
            fee,
        }
    }
}

impl std::fmt::Display for EthDepositedEvent {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "sender: {}; amount: {}; recipient: {}; fee: {}",
            self.sender, self.amount.0, self.recipient, self.fee.0,
        )
    }
}
