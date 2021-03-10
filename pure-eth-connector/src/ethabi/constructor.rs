//! Contract constructor call builder.
use super::{encode, Bytes, ErrorKind, Param, ParamType, Result, Token};

use alloc::string::String;
use rstd::prelude::*;
use rstd::vec::Vec;

/// Contract constructor specification.
#[derive(Debug, Clone, PartialEq)]
pub struct Constructor {
    /// Constructor input.
    pub inputs: Vec<Param>,
}

impl Constructor {
    /// Returns all input params of given constructor.
    fn param_types(&self) -> Vec<ParamType> {
        self.inputs.iter().map(|p| p.kind.clone()).collect()
    }

    /// Prepares ABI constructor call with given input params.
    pub fn encode_input(&self, code: Bytes, tokens: &[Token]) -> Result<Bytes> {
        let params = self.param_types();

        if Token::types_check(tokens, &params) {
            Ok(code.into_iter().chain(encode(tokens)).collect())
        } else {
            Err(ErrorKind::InvalidData.into())
        }
    }
}
