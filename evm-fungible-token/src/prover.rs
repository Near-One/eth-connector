use eth_types::*;
use ethabi::{Event, EventParam, Hash, Log, ParamType, RawLog};
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::env;
use near_sdk::serde::{Deserialize, Serialize};
use std::convert::From;

pub type EthAddress = [u8; 20];

/// Validate Etherium address from string and return EthAddress
pub fn validate_eth_address(address: String) -> EthAddress {
    let data = hex::decode(address).expect("ETH address should be a valid hex string.");
    assert_eq!(data.len(), 20, "ETH address should be 20 bytes long");
    let mut result = [0u8; 20];
    result.copy_from_slice(&data);
    result
}

#[derive(Default, BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct Proof {
    pub log_index: u64,
    pub log_entry_data: Vec<u8>,
    pub receipt_index: u64,
    pub receipt_data: Vec<u8>,
    pub header_data: Vec<u8>,
    pub proof: Vec<Vec<u8>>,
}

impl Proof {
    pub fn get_key(&self) -> Vec<u8> {
        let mut data = self.log_index.try_to_vec().unwrap();
        data.extend(self.receipt_index.try_to_vec().unwrap());
        data.extend(self.header_data.clone());
        env::sha256(&data)
    }
}

/// Parameters of Etherium event
pub type EthEventParams = Vec<(String, ParamType, bool)>;

/// Etherium event
pub struct EthEvent {
    pub eth_custodian_address: EthAddress,
    pub log: Log,
}

impl EthEvent {
    /// Get Etherium event from proof `log_entry_data`
    pub fn from_log_entry_data(name: &str, params: EthEventParams, data: &[u8]) -> Self {
        let event = Event {
            name: name.to_string(),
            inputs: params
                .into_iter()
                .map(|(name, kind, indexed)| EventParam {
                    name,
                    kind,
                    indexed,
                })
                .collect(),
            anonymous: false,
        };
        let log_entry: LogEntry = rlp::decode(data).expect("Invalid RLP");
        let eth_custodian_address = (log_entry.address.clone().0).0;
        let topics = log_entry
            .topics
            .iter()
            .map(|h| Hash::from(&((h.0).0)))
            .collect();

        let raw_log = RawLog {
            topics,
            data: log_entry.data.clone(),
        };

        let log = event.parse_log(raw_log).expect("Failed to parse event log");
        Self {
            eth_custodian_address,
            log,
        }
    }
}
