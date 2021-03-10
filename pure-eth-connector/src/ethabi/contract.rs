use rstd::collections::btree_map::BTreeMap;
use rstd::collections::btree_map::Values;
use rstd::fmt;
use rstd::iter::Flatten;

use super::operation::Operation;
use super::{errors, Constructor, ErrorKind, Event, Function};

use alloc::string::String;
use rstd::prelude::*;
use rstd::vec::Vec;

/// API building calls to contracts ABI.
#[derive(Clone, Debug, PartialEq)]
pub struct Contract {
    /// Contract constructor.
    pub constructor: Option<Constructor>,
    /// Contract functions.
    pub functions: BTreeMap<String, Function>,
    /// Contract events, maps signature to event.
    pub events: BTreeMap<String, Vec<Event>>,
    /// Contract has fallback function.
    pub fallback: bool,
}

impl Contract {
    /// Creates constructor call builder.
    pub fn constructor(&self) -> Option<&Constructor> {
        self.constructor.as_ref()
    }

    /// Creates function call builder.
    pub fn function(&self, name: &str) -> Result<&Function, &'static str> {
        self.functions.get(name).ok_or_else(|| "Invalid name")
    }

    /// Get the contract event named `name`, the first if there are multiple.
    pub fn event(&self, name: &str) -> Result<&Event, &'static str> {
        self.events
            .get(name)
            .into_iter()
            .flatten()
            .next()
            .ok_or_else(|| "Invalid name")
    }

    /// Get all contract events named `name`.
    pub fn events_by_name(&self, name: &str) -> Result<&Vec<Event>, &'static str> {
        self.events.get(name).ok_or_else(|| "Invalid name")
    }

    /// Iterate over all functions of the contract in arbitrary order.
    pub fn functions(&self) -> Functions {
        Functions(self.functions.values())
    }

    /// Iterate over all events of the contract in arbitrary order.
    pub fn events(&self) -> Events {
        Events(self.events.values().flatten())
    }

    /// Returns true if contract has fallback
    pub fn fallback(&self) -> bool {
        self.fallback
    }
}

/// Contract functions interator.
pub struct Functions<'a>(Values<'a, String, Function>);

impl<'a> Iterator for Functions<'a> {
    type Item = &'a Function;

    fn next(&mut self) -> Option<Self::Item> {
        self.0.next()
    }
}

/// Contract events interator.
pub struct Events<'a>(Flatten<Values<'a, String, Vec<Event>>>);

impl<'a> Iterator for Events<'a> {
    type Item = &'a Event;

    fn next(&mut self) -> Option<Self::Item> {
        self.0.next()
    }
}
