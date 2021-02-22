use super::prover::{EthAddress, EthEvent, EthEventParams};
use ethabi::ParamType;
use hex::ToHex;
use near_sdk::{AccountId, Balance};

/// Data that was emitted by the Ethereum Locked event.
#[derive(Debug, Eq, PartialEq)]
pub struct EthLockedEvent {
    pub eth_custodian_address: EthAddress,
    pub sender: String,
    pub amount: Balance,
    pub recipient: AccountId,
    pub fee: Balance,
}

impl EthLockedEvent {
    fn event_params() -> EthEventParams {
        vec![
            ("sender".to_string(), ParamType::Address, true),
            ("amount".to_string(), ParamType::Uint(256), false),
            (
                "eth_recipient_on_near".to_string(),
                ParamType::String,
                false,
            ),
            ("fee".to_string(), ParamType::Uint(256), false),
        ]
    }

    /// Parse raw log Etherium proof entry data.
    pub fn from_log_entry_data(data: &[u8]) -> Self {
        let event =
            EthEvent::from_log_entry_data("Deposited", EthLockedEvent::event_params(), data);
        let sender = event.log.params[0].value.clone().to_address().unwrap().0;
        let sender = (&sender).encode_hex::<String>();
        let amount = event.log.params[1]
            .value
            .clone()
            .to_uint()
            .unwrap()
            .as_u128();
        let recipient = event.log.params[2].value.clone().to_string().unwrap();
        let fee = event.log.params[3]
            .value
            .clone()
            .to_uint()
            .unwrap()
            .as_u128();
        Self {
            eth_custodian_address: event.eth_custodian_address,
            sender,
            amount,
            recipient,
            fee,
        }
    }
}

impl std::fmt::Display for EthLockedEvent {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "sender: {}; amount: {}; recipient: {}; fee: {}",
            self.sender, self.amount, self.recipient, self.fee,
        )
    }
}
