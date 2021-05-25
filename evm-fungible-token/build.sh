#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

docker run \
     --mount type=bind,source=$DIR/..,target=/host \
     --cap-add=SYS_PTRACE --security-opt seccomp=unconfined \
     -w /host/evm-fungible-token \
     -e RUSTFLAGS='-C link-arg=-s' \
     nearprotocol/contract-builder \
     /bin/bash -c "rustup target add wasm32-unknown-unknown; cargo build --target wasm32-unknown-unknown --release"


mkdir -p res
cp $DIR/target/wasm32-unknown-unknown/release/eth_connector.wasm ./res/

# wasm-opt -Oz --output ./res/near_evm.wasm ./res/near_evm.wasm
ls -lh res/eth_connector.wasm
# rm -rf target
