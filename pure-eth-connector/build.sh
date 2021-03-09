#!/bin/bash
set -e

RUSTFLAGS='-C link-arg=-s' cargo build --lib --target wasm32-unknown-unknown --release --no-default-features -Z avoid-dev-deps
mkdir -p res
cp target/wasm32-unknown-unknown/release/pure_eth_connector.wasm ./res/

# wasm-opt -Oz --output ./res/near_evm.wasm ./res/near_evm.wasm
ls -lh res/
