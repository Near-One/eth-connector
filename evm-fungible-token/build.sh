#!/bin/bash

RUSTFLAGS='-C link-arg=-s' cargo build -p near-evm --lib --target wasm32-unknown-unknown --release --no-default-features --features=contract -Z avoid-dev-deps || exit 1
mkdir -p res
cp target/wasm32-unknown-unknown/release/near_evm.wasm ./res/

# wasm-opt -Oz --output ./res/near_evm.wasm ./res/near_evm.wasm
ls -lh res/near_evm.wasm
# rm -rf target
