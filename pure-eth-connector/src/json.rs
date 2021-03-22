use super::*;

use core::convert::From;
use rjson::{Array, Null, Object, Value};

pub enum JsonValue {
    Null,
    Number(f64),
    Bool(bool),
    String(String),
    Array(Vec<JsonValue>),
    Object(BTreeMap<String, JsonValue>),
}

pub struct JsonArray(Vec<JsonValue>);
pub struct JsonObject(BTreeMap<String, JsonValue>);

impl Array<JsonValue, JsonObject, JsonValue> for JsonArray {
    fn new() -> Self {
        JsonArray(Vec::new())
    }
    fn push(&mut self, v: JsonValue) {
        self.0.push(v)
    }
}

impl Object<JsonValue, JsonArray, JsonValue> for JsonObject {
    fn new<'b>() -> Self {
        JsonObject(BTreeMap::new())
    }
    fn insert(&mut self, k: String, v: JsonValue) {
        self.0.insert(k, v);
    }
}

impl Null<JsonValue, JsonArray, JsonObject> for JsonValue {
    fn new() -> Self {
        JsonValue::Null
    }
}
impl Value<JsonArray, JsonObject, JsonValue> for JsonValue {}

impl From<f64> for JsonValue {
    fn from(v: f64) -> Self {
        JsonValue::Number(v)
    }
}
impl From<bool> for JsonValue {
    fn from(v: bool) -> Self {
        JsonValue::Bool(v)
    }
}
impl From<String> for JsonValue {
    fn from(v: String) -> Self {
        JsonValue::String(v)
    }
}
impl From<JsonArray> for JsonValue {
    fn from(v: JsonArray) -> Self {
        JsonValue::Array(v.0)
    }
}
impl From<JsonObject> for JsonValue {
    fn from(v: JsonObject) -> Self {
        JsonValue::Object(v.0)
    }
}

impl core::fmt::Debug for JsonValue {
    fn fmt(&self, f: &mut core::fmt::Formatter) -> core::fmt::Result {
        match *self {
            JsonValue::Null => f.write_str("null"),
            JsonValue::String(ref v) => f.write_fmt(format_args!("\"{}\"", v)),
            JsonValue::Number(ref v) => f.write_fmt(format_args!("{}", v)),
            JsonValue::Bool(ref v) => f.write_fmt(format_args!("{}", v)),
            JsonValue::Array(ref v) => f.write_fmt(format_args!("{:?}", v)),
            JsonValue::Object(ref v) => f.write_fmt(format_args!("{:#?}", v)),
        }
    }
}

impl core::fmt::Display for JsonValue {
    fn fmt(&self, f: &mut core::fmt::Formatter) -> core::fmt::Result {
        f.write_fmt(format_args!("{:?}", *self))
    }
}

pub fn parse_json(data: &[u8]) -> Option<JsonValue> {
    let data_array: Vec<char> = data.iter().map(|b| *b as char).collect::<Vec<_>>();
    let mut index = 0;
    let parse_result =
        rjson::parse::<JsonValue, JsonArray, JsonObject, JsonValue>(&*data_array, &mut index);
    parse_result
}
