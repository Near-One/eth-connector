use near_contract_standards::fungible_token::{
    core::FungibleTokenCore, metadata::FungibleTokenMetadata, resolver::FungibleTokenResolver,
    FungibleToken,
};
use near_contract_standards::storage_manager::{AccountStorageBalance, StorageManager};
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::LookupSet;
use near_sdk::json_types::{ValidAccountId, U128};
use near_sdk::serde_json::json;
use near_sdk::{
    env, log, near_bindgen, AccountId, Balance, PanicOnDefault, Promise, PromiseResult,
};

use deposit_event::EthDepositedEvent;
pub use prover::{validate_eth_address, EthAddress, Proof};

pub mod deposit_event;
pub mod prover;
//pub mod withdraw_event;

near_sdk::setup_alloc!();

/// Price per 1 byte of storage from mainnet genesis config.
const STORAGE_PRICE_PER_BYTE: Balance = 100_000_000_000_000_000_000; // 1e20yN, 0.0001N

const NO_DEPOSIT: Balance = 0;

const FUNGIBLE_TOKEN_NAME: &'static str = "NEAR ETH Fungible Token";
const FUNGIBLE_TOKEN_SYMBOL: &'static str = "nETH";
const FUNGIBLE_TOKEN_VERSION: &'static str = "v1";
const FUNGIBLE_TOKEN_REFERENCE: &'static str = "ref";
const FUNGIBLE_TOKEN_DECIMALS: u8 = 0;
const FUNGIBLE_TOTAL_SUPPLY: u128 = 0;

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct EthConnector {
    /// The account of the prover that we can use to prove
    pub prover_account: AccountId,
    /// Address of the Ethereum custodian contract.
    pub eth_custodian_address: EthAddress,
    /// Hashes of the events that were already used.
    pub used_events: LookupSet<Vec<u8>>,
    /// Fungible token specific data
    pub token: FungibleToken,
}

#[near_bindgen]
impl EthConnector {
    /// Initializes the contract.
    /// `prover_account`: NEAR account of the Near Prover contract;
    /// `eth_custodian_address`: Ethereum address of the custodian contract, in hex.
    #[init]
    pub fn new(prover_account: AccountId, eth_custodian_address: String) -> Self {
        assert!(!env::state_exists(), "Already initialized");
        let mut ft = FungibleToken::new(b"a");
        let owner_id = env::current_account_id();
        ft.internal_register_account(&owner_id);
        ft.internal_deposit(&owner_id, FUNGIBLE_TOTAL_SUPPLY.into());
        Self {
            prover_account,
            eth_custodian_address: validate_eth_address(eth_custodian_address),
            used_events: LookupSet::new(b"u".to_vec()),
            token: ft,
        }
    }

    /// Deposit from Ethereum to NEAR based on the proof of the locked tokens.
    /// Must attach enough NEAR funds to cover for storage of the proof.
    #[payable]
    pub fn deposit(&mut self, proof: Proof) {
        let event = EthDepositedEvent::from_log_entry_data(&proof.log_entry_data);

        log!(
            "Deposit started: from {:?} ETH to {:?} NEAR with amount: {:?} and fee {:?}",
            event.sender,
            event.recipient,
            event.amount,
            event.fee
        );

        assert_eq!(
            event.eth_custodian_address,
            self.eth_custodian_address,
            "Event's address {} does not match custodian address {}",
            hex::encode(&event.eth_custodian_address),
            hex::encode(&self.eth_custodian_address),
        );
        let amount: Balance = event.amount.into();
        let fee: Balance = event.fee.into();
        assert!((amount - fee) > 0, "Not enough balance for deposit fee");

        let proof_1 = proof.clone();
        let account_id = env::current_account_id();
        let prepaid_gas = env::prepaid_gas();
        // Serialize with Borsh
        let proof_2 = proof_1.try_to_vec().unwrap();
        log!(
            "Deposit verify_log_entry for prover: {:?}",
            self.prover_account,
        );
        let promise0 = env::promise_create(
            self.prover_account.clone(),
            b"verify_log_entry",
            &proof_2[..],
            NO_DEPOSIT,
            prepaid_gas / 4,
        );
        let promise1 = env::promise_then(
            promise0,
            account_id,
            b"finish_deposit",
            json!({
                "new_owner_id": event.recipient,
                "amount": event.amount,
                "fee": event.fee,
                "proof": proof_1,
            })
            .to_string()
            .as_bytes(),
            NO_DEPOSIT,
            prepaid_gas / 4,
        );
        env::promise_return(promise1);
    }

    /// Finish depositing once the proof was successfully validated.
    /// Can only be called by the contract itself.
    #[private]
    pub fn finish_deposit(
        &mut self,
        new_owner_id: AccountId,
        amount: U128,
        fee: U128,
        proof: Proof,
    ) {
        log!("Finish deposit amount: {:?}", amount);
        assert_eq!(env::promise_results_count(), 1);
        let data0: Vec<u8> = match env::promise_result(0) {
            PromiseResult::Successful(x) => x,
            _ => panic!("Promise with index 0 failed"),
        };
        log!("Check verification_success");
        let verification_success: bool = bool::try_from_slice(&data0).unwrap();
        assert!(verification_success, "Failed to verify the proof");
        self.record_proof(&proof.get_key());

        let amount: Balance = amount.into();
        let fee: Balance = fee.into();

        // Mint tokens to recipient minus fee
        self.mint(new_owner_id, amount - fee);
        // Mint fee for Predecessor
        self.mint(env::predecessor_account_id(), fee);
    }

    /// Mint Fungible Token for account
    /// TODO: should be related to NEP-145
    #[private]
    fn mint(&mut self, owner_id: AccountId, amount: Balance) {
        log!("Mint {:?} tokens for: {:?}", amount, owner_id);

        if self.token.accounts.get(&owner_id).is_none() {
            // TODO: NEP-145 Account Storage impelemtation nee
            // It spent additonal account amount fot storage
            self.token.accounts.insert(&owner_id, &0);
        }
        self.token.internal_deposit(&owner_id, amount);
        log!("Mint success");
    }

    /// Burn Fungible Token for account
    #[private]
    fn burn(&mut self, owner_id: AccountId, amount: Balance) {
        log!("Burn {:?} tokens for: {:?}", amount, owner_id);
        self.token.internal_withdraw(&owner_id, amount);
    }

    #[payable]
    pub fn withdraw(
        &mut self,
        recipient_id: AccountId,
        amount: U128,
        fee: U128,
    ) -> (AccountId, u128) {
        log!("Start withdraw");
        let amount: Balance = amount.into();
        let fee: Balance = fee.into();
        assert!((amount - fee) > 0, "Not enough balance for withdraw fee");
        // Burn tokens to recipient minus fee
        self.burn(recipient_id.clone(), amount - fee);
        // Mint fee for Predecessor
        // TODO: verify recipient for mint fee
        self.mint(env::predecessor_account_id(), fee);
        (recipient_id, amount.into())
    }

    /// Record proof to make sure it is not re-used later for anther deposit.
    #[private]
    fn record_proof(&mut self, key: &Vec<u8>) -> Balance {
        let initial_storage = env::storage_usage();
        assert!(
            !self.used_events.contains(&key),
            "Proof event cannot be reused. Proof already exist."
        );
        self.used_events.insert(&key);
        let current_storage = env::storage_usage();
        let attached_deposit = env::attached_deposit();
        let required_deposit =
            Balance::from(current_storage - initial_storage) * STORAGE_PRICE_PER_BYTE;
        attached_deposit - required_deposit
    }

    /// TODO: For tests only. Ir should be external Contract
    #[allow(unused_variables)]
    #[result_serializer(borsh)]
    pub fn verify_log_entry(
        &self,
        #[serializer(borsh)] log_index: u64,
        #[serializer(borsh)] log_entry_data: Vec<u8>,
        #[serializer(borsh)] receipt_index: u64,
        #[serializer(borsh)] receipt_data: Vec<u8>,
        #[serializer(borsh)] header_data: Vec<u8>,
        #[serializer(borsh)] proof: Vec<Vec<u8>>,
        #[serializer(borsh)] skip_bridge_call: bool,
    ) -> bool {
        true
    }

    #[payable]
    pub fn ft_transfer(&mut self, receiver_id: ValidAccountId, amount: U128, memo: Option<String>) {
        self.token.ft_transfer(receiver_id, amount, memo)
    }

    #[payable]
    pub fn ft_transfer_call(
        &mut self,
        receiver_id: ValidAccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> Promise {
        self.token.ft_transfer_call(receiver_id, amount, memo, msg)
    }

    pub fn ft_total_supply(&self) -> U128 {
        self.token.ft_total_supply()
    }

    pub fn ft_balance_of(&self, account_id: ValidAccountId) -> U128 {
        self.token.ft_balance_of(account_id)
    }

    #[private]
    pub fn ft_resolve_transfer(
        &mut self,
        sender_id: ValidAccountId,
        receiver_id: ValidAccountId,
        amount: U128,
    ) -> U128 {
        self.token
            .ft_resolve_transfer(sender_id, receiver_id, amount)
    }

    pub fn ft_metadata(&self) -> FungibleTokenMetadata {
        FungibleTokenMetadata {
            version: FUNGIBLE_TOKEN_VERSION.into(),
            name: FUNGIBLE_TOKEN_NAME.into(),
            symbol: FUNGIBLE_TOKEN_SYMBOL.into(),
            reference: FUNGIBLE_TOKEN_REFERENCE.into(),
            decimals: FUNGIBLE_TOKEN_DECIMALS,
        }
    }

    #[payable]
    pub fn storage_deposit(&mut self, account_id: Option<ValidAccountId>) -> AccountStorageBalance {
        self.token.storage_deposit(account_id)
    }

    #[payable]
    pub fn storage_withdraw(&mut self, amount: Option<U128>) -> AccountStorageBalance {
        self.token.storage_withdraw(amount)
    }

    pub fn storage_minimum_balance(&self) -> U128 {
        self.token.storage_minimum_balance()
    }

    pub fn storage_balance_of(&self, account_id: ValidAccountId) -> AccountStorageBalance {
        self.token.storage_balance_of(account_id)
    }
}
