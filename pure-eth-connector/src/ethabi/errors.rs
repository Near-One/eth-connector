#![allow(unknown_lints)]
#![allow(missing_docs)]
use alloc::string;
use alloc::string::String;
use rstd::num;

use hex;

#[derive(Debug)]
pub enum ErrorKind {
    InvalidName(String),
    InvalidData,
}

impl From<String> for ErrorKind {
    fn from(s: String) -> Self {
        ErrorKind::InvalidName(s)
    }
}

impl From<&str> for ErrorKind {
    fn from(s: &str) -> Self {
        ErrorKind::InvalidName(s.parse().unwrap())
    }
}

impl ErrorKind {
    pub(crate) fn as_str(&self) -> &'static str {
        match *self {
            ErrorKind::InvalidName(_) => "Invalid name",
            ErrorKind::InvalidData => "Invalid data",
        }
    }
}

impl rstd::fmt::Display for ErrorKind {
    fn fmt(&self, fmt: &mut rstd::fmt::Formatter) -> rstd::fmt::Result {
        match *self {
            ErrorKind::InvalidName(ref e) => write!(fmt, "{}", e),
            ErrorKind::InvalidData => write!(fmt, "Invalid data"),
        }
    }
}

#[derive(Debug)]
pub enum Error {
    ParseInt(num::ParseIntError),
    Utf8(string::FromUtf8Error),
    Hex(hex::FromHexError),
    ErrorKind(ErrorKind),
}

pub type Result<T> = rstd::result::Result<T, Error>;

impl From<&str> for Error {
    fn from(s: &str) -> Self {
        Error::ErrorKind(s.into())
    }
}

impl rstd::fmt::Display for Error {
    fn fmt(&self, fmt: &mut rstd::fmt::Formatter) -> rstd::fmt::Result {
        match *self {
            Error::ParseInt(ref e) => write!(fmt, "{}", e),
            Error::Utf8(ref e) => write!(fmt, "{}", e),
            Error::Hex(ref e) => write!(fmt, "{}", e),
            Error::ErrorKind(ref e) => write!(fmt, "{}", e),
        }
    }
}

impl From<num::ParseIntError> for Error {
    fn from(e: num::ParseIntError) -> Self {
        Error::ParseInt(e)
    }
}

impl From<string::FromUtf8Error> for Error {
    fn from(e: string::FromUtf8Error) -> Self {
        Error::Utf8(e)
    }
}

impl From<hex::FromHexError> for Error {
    fn from(e: hex::FromHexError) -> Self {
        Error::Hex(e)
    }
}

impl From<ErrorKind> for Error {
    #[inline]
    fn from(kind: ErrorKind) -> Error {
        Error::ErrorKind(kind)
    }
}

pub trait ResultExt<T> {
    /// If the `Result` is an `Err` then `chain_err` evaluates the closure,
    /// which returns *some type that can be converted to `ErrorKind`*, boxes
    /// the original error to store as the cause, then returns a new error
    /// containing the original error.
    fn chain_err<F, EK>(self, callback: F) -> rstd::result::Result<T, Error>
    where
        F: FnOnce() -> EK,
        EK: Into<ErrorKind>;
}

impl<T> ResultExt<T> for rstd::result::Result<T, Error> {
    fn chain_err<F, EK>(self, callback: F) -> rstd::result::Result<T, Error>
    where
        F: FnOnce() -> EK,
        EK: Into<ErrorKind>,
    {
        self.map_err(move |e| e)
    }
}

impl<T> ResultExt<T> for Option<T> {
    fn chain_err<F, EK>(self, callback: F) -> rstd::result::Result<T, Error>
    where
        F: FnOnce() -> EK,
        EK: Into<ErrorKind>,
    {
        self.ok_or_else(move || callback().into().into())
    }
}
