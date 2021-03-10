//! ABI param and parsing for it.

mod lenient;
mod strict;
mod token;

pub use self::lenient::LenientTokenizer;
pub use self::strict::StrictTokenizer;
pub use self::token::Token;
use super::{Error, ErrorKind, ParamType, ResultExt};

use alloc::string::String;
use rstd::prelude::*;
use rstd::vec::Vec;

/// This trait should be used to parse string values as tokens.
pub trait Tokenizer {
    /// Tries to parse a string as a token of given type.
    fn tokenize(param: &ParamType, value: &str) -> Result<Token, Error> {
        match *param {
            ParamType::Address => Self::tokenize_address(value).map(|a| Token::Address(a.into())),
            ParamType::String => Self::tokenize_string(value).map(Token::String),
            ParamType::Bool => Self::tokenize_bool(value).map(Token::Bool),
            ParamType::Bytes => Self::tokenize_bytes(value).map(Token::Bytes),
            ParamType::FixedBytes(len) => {
                Self::tokenize_fixed_bytes(value, len).map(Token::FixedBytes)
            }
            ParamType::Uint(_) => Self::tokenize_uint(value).map(Into::into).map(Token::Uint),
            ParamType::Int(_) => Self::tokenize_int(value).map(Into::into).map(Token::Int),
            ParamType::Array(ref p) => Self::tokenize_array(value, p).map(Token::Array),
            ParamType::FixedArray(ref p, len) => {
                Self::tokenize_fixed_array(value, p, len).map(Token::FixedArray)
            }
        }
        .chain_err(|| format!("Cannot parse {}", param))
    }

    /// Tries to parse a value as a vector of tokens of fixed size.
    fn tokenize_fixed_array(
        value: &str,
        param: &ParamType,
        len: usize,
    ) -> Result<Vec<Token>, Error> {
        let result = Self::tokenize_array(value, param)?;
        match result.len() == len {
            true => Ok(result),
            false => Err(ErrorKind::InvalidData.into()),
        }
    }

    /// Tries to parse a value as a vector of tokens.
    fn tokenize_array(value: &str, param: &ParamType) -> Result<Vec<Token>, Error> {
        if !value.starts_with('[') || !value.ends_with(']') {
            return Err(ErrorKind::InvalidData.into());
        }

        if value.chars().count() == 2 {
            return Ok(vec![]);
        }

        let mut result = vec![];
        let mut nested = 0isize;
        let mut ignore = false;
        let mut last_item = 1;
        for (i, ch) in value.chars().enumerate() {
            match ch {
                '[' if ignore == false => {
                    nested += 1;
                }
                ']' if ignore == false => {
                    nested -= 1;
                    if nested < 0 {
                        return Err(ErrorKind::InvalidData.into());
                    } else if nested == 0 {
                        let sub = &value[last_item..i];
                        let token = Self::tokenize(param, sub)?;
                        result.push(token);
                        last_item = i + 1;
                    }
                }
                '"' => {
                    ignore = !ignore;
                }
                ',' if nested == 1 && ignore == false => {
                    let sub = &value[last_item..i];
                    let token = Self::tokenize(param, sub)?;
                    result.push(token);
                    last_item = i + 1;
                }
                _ => (),
            }
        }

        if ignore {
            return Err(ErrorKind::InvalidData.into());
        }

        Ok(result)
    }

    /// Tries to parse a value as an address.
    fn tokenize_address(value: &str) -> Result<[u8; 20], Error>;

    /// Tries to parse a value as a string.
    fn tokenize_string(value: &str) -> Result<String, Error>;

    /// Tries to parse a value as a bool.
    fn tokenize_bool(value: &str) -> Result<bool, Error>;

    /// Tries to parse a value as bytes.
    fn tokenize_bytes(value: &str) -> Result<Vec<u8>, Error>;

    /// Tries to parse a value as bytes.
    fn tokenize_fixed_bytes(value: &str, len: usize) -> Result<Vec<u8>, Error>;

    /// Tries to parse a value as unsigned integer.
    fn tokenize_uint(value: &str) -> Result<[u8; 32], Error>;

    /// Tries to parse a value as signed integer.
    fn tokenize_int(value: &str) -> Result<[u8; 32], Error>;
}

#[cfg(test)]
mod test {
    use super::{LenientTokenizer, ParamType, Tokenizer};
    #[test]
    fn single_quoted_in_array_must_error() {
        assert!(LenientTokenizer::tokenize_array("[1,\"0,false]", &ParamType::Bool).is_err());
        assert!(LenientTokenizer::tokenize_array("[false\"]", &ParamType::Bool).is_err());
        assert!(LenientTokenizer::tokenize_array("[1,false\"]", &ParamType::Bool).is_err());
        assert!(LenientTokenizer::tokenize_array("[1,\"0\",false]", &ParamType::Bool).is_err());
        assert!(LenientTokenizer::tokenize_array("[1,0]", &ParamType::Bool).is_ok());
    }
}
