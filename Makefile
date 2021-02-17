check:
	@cd evm-fungible-token && \
	cargo check

build:
	@cd evm-fungible-token && \
	@./build.sh

fmt:
	@cd evm-fungible-token && \
	cargo fmt
	
test:
	@cd evm-fungible-token && \
	cargo test
	