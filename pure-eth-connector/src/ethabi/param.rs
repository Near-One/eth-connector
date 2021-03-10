//! Function param.
use super::ParamType;

use alloc::string::String;
use rstd::prelude::*;

/// Function param.
#[derive(Debug, Clone, PartialEq)]
pub struct Param {
    /// Param name.
    pub name: String,
    /// Param type.
    #[cfg_attr(feature = "std", serde(rename = "type"))]
    pub kind: ParamType,
}

#[cfg(test)]
mod tests {
    use serde_json;
    use {Param, ParamType};

    #[test]
    fn param_deserialization() {
        let s = r#"{
			"name": "foo",
			"type": "address"
		}"#;

        let deserialized: Param = serde_json::from_str(s).unwrap();

        assert_eq!(
            deserialized,
            Param {
                name: "foo".to_owned(),
                kind: ParamType::Address,
            }
        );
    }
}
