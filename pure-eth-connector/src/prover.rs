use super::*;
use ethabi::{Event, EventParam, Hash, Log, ParamType, RawLog};

pub type EthAddress = [u8; 20];

/// Validate Etherium address from string and return EthAddress
pub fn validate_eth_address(address: String) -> EthAddress {
    let data = hex::decode(address).expect("ETH address should be a valid hex string.");
    assert_eq!(data.len(), 20, "ETH address should be 20 bytes long");
    let mut result = [0u8; 20];
    result.copy_from_slice(&data);
    result
}

#[derive(Default, BorshDeserialize, BorshSerialize, Clone)]
pub struct Proof {
    pub log_index: u64,
    pub log_entry_data: Vec<u8>,
    pub receipt_index: u64,
    pub receipt_data: Vec<u8>,
    pub header_data: Vec<u8>,
    pub proof: Vec<Vec<u8>>,
    pub skip_bridge_call: bool,
}

impl Proof {
    pub fn get_key(&self) -> String {
        let mut data = self.log_index.try_to_vec().unwrap();
        data.extend(self.receipt_index.try_to_vec().unwrap());
        data.extend(self.header_data.clone());
        sdk::sha256(&data[..])
            .iter()
            .map(|n| n.to_string())
            .collect()
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
    /// Get Etherium event from `log_entry_data`
    pub fn fetch_log_entry_data(name: &str, params: EthEventParams, data: &[u8]) -> Self {
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
        let eth_custodian_address = log_entry.address.0;
        let topics = log_entry.topics.iter().map(|h| Hash::from(h.0)).collect();

        let raw_log = RawLog {
            topics,
            data: log_entry.data,
        };
        let log = event.parse_log(raw_log).expect("Failed to parse event log");

        Self {
            eth_custodian_address,
            log,
        }
    }
}

impl From<json::JsonValue> for Proof {
    fn from(v: json::JsonValue) -> Self {
        let log_index = v.u64("log_index").expect(FAILED_PARSE);
        let log_entry_data: Vec<u8> = v
            .array("log_entry_data", json::JsonValue::parse_u8)
            .expect(FAILED_PARSE);
        let receipt_index = v.u64("receipt_index").expect(FAILED_PARSE);
        let receipt_data: Vec<u8> = v
            .array("receipt_data", json::JsonValue::parse_u8)
            .expect(FAILED_PARSE);
        let header_data: Vec<u8> = v
            .array("header_data", json::JsonValue::parse_u8)
            .expect(FAILED_PARSE);
        let proof = v
            .array("proof", |v1| match v1 {
                json::JsonValue::Array(arr) => arr.iter().map(json::JsonValue::parse_u8).collect(),
                _ => sdk::panic_utf8(FAILED_PARSE.as_bytes()),
            })
            .expect(FAILED_PARSE);

        let skip_bridge_call = v.bool("skip_bridge_call").expect(FAILED_PARSE);
        Self {
            log_index,
            log_entry_data,
            receipt_index,
            receipt_data,
            header_data,
            proof,
            skip_bridge_call,
        }
    }
}
