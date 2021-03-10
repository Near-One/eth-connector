//! Operation type.
use super::{Constructor, Event, Function};

/// Operation type.
#[derive(Clone, Debug, PartialEq)]
pub enum Operation {
    /// Contract constructor.
    Constructor(Constructor),
    /// Contract function.
    Function(Function),
    /// Contract event.
    Event(Event),
    /// Fallback, ignored.
    Fallback,
}

#[cfg(test)]
mod tests {
    use super::Operation;
    use serde_json;
    use {Function, Param, ParamType};

    #[test]
    fn deserialize_operation() {
        let s = r#"{
			"type":"function",
			"inputs": [{
				"name":"a",
				"type":"address"
			}],
			"name":"foo",
			"outputs": []
		}"#;

        let deserialized: Operation = serde_json::from_str(s).unwrap();

        assert_eq!(
            deserialized,
            Operation::Function(Function {
                name: "foo".to_owned(),
                inputs: vec![Param {
                    name: "a".to_owned(),
                    kind: ParamType::Address,
                }],
                outputs: vec![],
                constant: false,
            })
        );
    }

    #[test]
    fn deserialize_sanitize_function_name() {
        fn test_sanitize_function_name(name: &str, expected: &str) {
            let s = format!(
                r#"{{
				"type":"function",
				"inputs": [{{
					"name":"a",
					"type":"address"
				}}],
				"name":"{}",
				"outputs": []
			}}"#,
                name
            );

            let deserialized: Operation = serde_json::from_str(&s).unwrap();
            let function = match deserialized {
                Operation::Function(f) => f,
                _ => panic!("expected funciton"),
            };

            assert_eq!(function.name, expected);
        }

        test_sanitize_function_name("foo", "foo");
        test_sanitize_function_name("foo()", "foo");
        test_sanitize_function_name("()", "");
        test_sanitize_function_name("", "");
    }

    #[test]
    fn deserialize_sanitize_event_name() {
        fn test_sanitize_event_name(name: &str, expected: &str) {
            let s = format!(
                r#"{{
				"type":"event",
					"inputs": [{{
						"name":"a",
						"type":"address",
						"indexed":true
					}}],
					"name":"{}",
					"outputs": [],
					"anonymous": false
			}}"#,
                name
            );

            let deserialized: Operation = serde_json::from_str(&s).unwrap();
            let event = match deserialized {
                Operation::Event(e) => e,
                _ => panic!("expected event!"),
            };

            assert_eq!(event.name, expected);
        }

        test_sanitize_event_name("foo", "foo");
        test_sanitize_event_name("foo()", "foo");
        test_sanitize_event_name("()", "");
        test_sanitize_event_name("", "");
    }
}
