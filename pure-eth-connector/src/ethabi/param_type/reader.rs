use super::super::{Error, ErrorKind, ParamType};

/// Used to convert param type represented as a string to rust structure.
pub struct Reader;

use alloc::string::String;
use rstd::boxed::Box;
use rstd::prelude::*;
use rstd::vec::Vec;

use rstd::borrow::ToOwned;

impl Reader {
    /// Converts string to param type.
    pub fn read(name: &str) -> Result<ParamType, Error> {
        // check if it is a fixed or dynamic array.
        if let Some(']') = name.chars().last() {
            // take number part
            let num: String = name
                .chars()
                .rev()
                .skip(1)
                .take_while(|c| *c != '[')
                .collect::<String>()
                .chars()
                .rev()
                .collect();

            let count = name.chars().count();
            if num.is_empty() {
                // we already know it's a dynamic array!
                let subtype = Reader::read(&name[..count - 2])?;
                return Ok(ParamType::Array(Box::new(subtype)));
            } else {
                // it's a fixed array.
                let len = usize::from_str_radix(&num, 10)?;
                let subtype = Reader::read(&name[..count - num.len() - 2])?;
                return Ok(ParamType::FixedArray(Box::new(subtype), len));
            }
        }

        let result = match name {
            "address" => ParamType::Address,
            "bytes" => ParamType::Bytes,
            "bool" => ParamType::Bool,
            "string" => ParamType::String,
            "int" => ParamType::Int(256),
            "uint" => ParamType::Uint(256),
            s if s.starts_with("int") => {
                let len = usize::from_str_radix(&s[3..], 10)?;
                ParamType::Int(len)
            }
            s if s.starts_with("uint") => {
                let len = usize::from_str_radix(&s[4..], 10)?;
                ParamType::Uint(len)
            }
            s if s.starts_with("bytes") => {
                let len = usize::from_str_radix(&s[5..], 10)?;
                ParamType::FixedBytes(len)
            }
            _ => {
                return Err(ErrorKind::InvalidName(name.to_owned()).into());
            }
        };

        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::Reader;
    use ParamType;

    #[test]
    fn test_read_param() {
        assert_eq!(Reader::read("address").unwrap(), ParamType::Address);
        assert_eq!(Reader::read("bytes").unwrap(), ParamType::Bytes);
        assert_eq!(Reader::read("bytes32").unwrap(), ParamType::FixedBytes(32));
        assert_eq!(Reader::read("bool").unwrap(), ParamType::Bool);
        assert_eq!(Reader::read("string").unwrap(), ParamType::String);
        assert_eq!(Reader::read("int").unwrap(), ParamType::Int(256));
        assert_eq!(Reader::read("uint").unwrap(), ParamType::Uint(256));
        assert_eq!(Reader::read("int32").unwrap(), ParamType::Int(32));
        assert_eq!(Reader::read("uint32").unwrap(), ParamType::Uint(32));
    }

    #[test]
    fn test_read_array_param() {
        assert_eq!(
            Reader::read("address[]").unwrap(),
            ParamType::Array(Box::new(ParamType::Address))
        );
        assert_eq!(
            Reader::read("uint[]").unwrap(),
            ParamType::Array(Box::new(ParamType::Uint(256)))
        );
        assert_eq!(
            Reader::read("bytes[]").unwrap(),
            ParamType::Array(Box::new(ParamType::Bytes))
        );
        assert_eq!(
            Reader::read("bool[][]").unwrap(),
            ParamType::Array(Box::new(ParamType::Array(Box::new(ParamType::Bool))))
        );
    }

    #[test]
    fn test_read_fixed_array_param() {
        assert_eq!(
            Reader::read("address[2]").unwrap(),
            ParamType::FixedArray(Box::new(ParamType::Address), 2)
        );
        assert_eq!(
            Reader::read("bool[17]").unwrap(),
            ParamType::FixedArray(Box::new(ParamType::Bool), 17)
        );
        assert_eq!(
            Reader::read("bytes[45][3]").unwrap(),
            ParamType::FixedArray(
                Box::new(ParamType::FixedArray(Box::new(ParamType::Bytes), 45)),
                3
            )
        );
    }

    #[test]
    fn test_read_mixed_arrays() {
        assert_eq!(
            Reader::read("bool[][3]").unwrap(),
            ParamType::FixedArray(Box::new(ParamType::Array(Box::new(ParamType::Bool))), 3)
        );
        assert_eq!(
            Reader::read("bool[3][]").unwrap(),
            ParamType::Array(Box::new(ParamType::FixedArray(
                Box::new(ParamType::Bool),
                3
            )))
        );
    }
}
