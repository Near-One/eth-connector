#!/bin/bash

RUSTFLAGS='-C link-arg=-s' cargo build --target wasm32-unknown-unknown --release || exit 1
mkdir -p res
cp target/wasm32-unknown-unknown/release/eth_connector.wasm ./res/

# wasm-opt -Oz --output ./res/near_evm.wasm ./res/near_evm.wasm
ls -lh res/eth_connector.wasm
# rm -rf target
