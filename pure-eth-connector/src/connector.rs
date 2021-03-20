use super::*;

pub struct EthConnectorContract {
    contract: EthConnector,
}

impl EthConnectorContract {
    pub fn new() -> Self {
        Self {
            contract: sdk::get_contract_data(),
        }
    }

    pub fn init_contract() {
        assert!(!sdk::state_exists(), "Contract already initialized");
        #[cfg(feature = "log")]
        sdk::log("[init contract]".into());
        let args: InitCallArgs = serde_json::from_slice(&sdk::read_input()[..]).unwrap();
        let owner_id = sdk::current_account_id();
        let mut ft = FungibleToken::new();
        ft.internal_register_account(&owner_id);
        ft.internal_deposit(&owner_id, 0);
        let contract_data = EthConnector {
            prover_account: args.prover_account,
            eth_custodian_address: validate_eth_address(args.eth_custodian_address),
            used_events: BTreeSet::new(),
            token: ft,
        };
        sdk::save_contract(&contract_data);
    }

    pub fn deposit(&self) {
        //sdk::assert_one_yocto();
        #[cfg(feature = "log")]
        sdk::log("[Deposit tokens]".into());
        use core::ops::Sub;

        let proof: Proof = serde_json::from_slice(&sdk::read_input()[..]).unwrap();
        let event = EthDepositedEvent::from_log_entry_data(&proof.log_entry_data);

        sdk::log(format!(
            "Deposit started: from {:?} ETH to {:?} NEAR with amount: {:?} and fee {:?}",
            event.sender,
            event.recipient,
            event.amount.as_u128(),
            event.fee.as_u128()
        ));

        assert_eq!(
            event.eth_custodian_address,
            self.contract.eth_custodian_address,
            "Event's address {} does not match custodian address {}",
            hex::encode(&event.eth_custodian_address),
            hex::encode(&self.contract.eth_custodian_address),
        );
        assert!(
            event.amount.sub(event.fee).as_u128() > 0,
            "Not enough balance for deposit fee"
        );
        let account_id = sdk::current_account_id();
        let prepaid_gas = sdk::prepaid_gas();
        let proof_1 = proof.try_to_vec().unwrap();
        #[cfg(feature = "log")]
        sdk::log(format!(
            "Deposit verify_log_entry for prover: {:?}",
            self.contract.prover_account,
        ));
        let promise0 = sdk::promise_create(
            self.contract.prover_account.clone(),
            b"verify_log_entry",
            &proof_1[..],
            sdk::NO_DEPOSIT,
            prepaid_gas / 3,
        );
        let data = FinishDepositCallArgs {
            new_owner_id: event.recipient,
            amount: event.amount.as_u128(),
            fee: event.fee.as_u128(),
            proof,
        }
        .try_to_vec()
        .unwrap();

        let promise1 = sdk::promise_then(
            promise0,
            account_id,
            b"finish_deposit",
            &data[..],
            sdk::NO_DEPOSIT,
            prepaid_gas / 3,
        );
        sdk::promise_return(promise1);
    }

    pub fn finish_deposit(&mut self) {
        sdk::assert_private_call();
        let data: FinishDepositCallArgs =
            FinishDepositCallArgs::try_from_slice(&sdk::read_input()).unwrap();
        #[cfg(feature = "log")]
        sdk::log(format!("Finish deposit amount: {:?}", data.amount));
        assert_eq!(sdk::promise_results_count(), 1);
        let data0: Vec<u8> = match sdk::promise_result(0) {
            PromiseResult::Successful(x) => x,
            _ => panic!("Promise with index 0 failed"),
        };
        #[cfg(feature = "log")]
        sdk::log("Check verification_success".into());
        let verification_success: bool = bool::try_from_slice(&data0).unwrap();
        assert!(verification_success, "Failed to verify the proof");
        self.record_proof(data.proof.get_key());

        // Mint tokens to recipient minus fee
        self.mint(data.new_owner_id, data.amount - data.fee);
        // Mint fee for Predecessor
        self.mint(sdk::predecessor_account_id(), data.fee);
    }

    fn record_proof(&mut self, key: Vec<u8>) -> Balance {
        let initial_storage = sdk::storage_usage();

        assert!(
            !self.contract.used_events.contains(&key[..]),
            "Proof event cannot be reused. Proof already exist."
        );
        self.contract.used_events.insert(key);
        let current_storage = sdk::storage_usage();
        let attached_deposit = sdk::attached_deposit();
        let required_deposit =
            Balance::from(current_storage - initial_storage) * sdk::STORAGE_PRICE_PER_BYTE;
        self.save_contract();
        attached_deposit - required_deposit
    }

    fn mint(&mut self, owner_id: AccountId, amount: Balance) {
        #[cfg(feature = "log")]
        sdk::log(format!("Mint {:?} tokens for: {:?}", amount, owner_id));

        let owner_id_key: &str = owner_id.as_ref();
        if self.contract.token.accounts.get(owner_id_key).is_none() {
            // TODO: NEP-145 Account Storage implementation fee
            // It spent additional account amount for storage
            self.contract.token.accounts.insert(owner_id.clone(), 0);
        }
        self.contract.token.internal_deposit(&owner_id, amount);
        self.save_contract();
        #[cfg(feature = "log")]
        sdk::log("Mint success".into());
    }

    fn burn(&mut self, owner_id: AccountId, amount: Balance) {
        #[cfg(feature = "log")]
        sdk::log(format!("Burn {:?} tokens for: {:?}", amount, owner_id));
        self.contract.token.internal_withdraw(&owner_id, amount);
    }

    pub fn withdraw(&mut self) {
        #[cfg(feature = "log")]
        sdk::log("Start withdraw".into());
        let args: WithdrawCallArgs = serde_json::from_slice(&sdk::read_input()[..]).unwrap();
        let recipient_address = validate_eth_address(args.recipient_id);
        // Burn tokens to recipient
        self.burn(sdk::predecessor_account_id(), args.amount);
        let res = WithdrawResult {
            recipient_id: recipient_address,
            amount: args.amount,
            eth_custodian_address: self.contract.eth_custodian_address,
        }
        .try_to_vec()
        .unwrap();
        sdk::value_return(&res[..]);
    }

    pub fn ft_total_supply(&self) {
        let total_supply = self.contract.token.ft_total_supply();
        sdk::value_return(&total_supply.to_be_bytes());
        #[cfg(feature = "log")]
        sdk::log(format!("Total supply: {}", total_supply));
    }

    pub fn ft_balance_of(&self) {
        let args: BalanceOfCallArgs = serde_json::from_slice(&sdk::read_input()[..]).unwrap();
        let balance = self.contract.token.ft_balance_of(args.account_id.clone());
        sdk::value_return(&balance.to_be_bytes());
        #[cfg(feature = "log")]
        sdk::log(format!("Balance [{}]: {}", args.account_id, balance));
    }

    pub fn ft_transfer(&mut self) {
        let args: TransferCallArgs = serde_json::from_slice(&sdk::read_input()[..]).unwrap();

        self.contract
            .token
            .ft_transfer(args.receiver_id.clone(), args.amount, args.memo.clone());
        self.save_contract();
        #[cfg(feature = "log")]
        sdk::log(format!(
            "Transfer to {} amount {} with memo {:?} success",
            args.receiver_id, args.amount, args.memo
        ));
    }

    pub fn ft_resolve_transfer(&mut self) {
        sdk::assert_private_call();
        let args: ResolveTransferCallArgs = serde_json::from_slice(&sdk::read_input()[..]).unwrap();
        let amount = self.contract.token.ft_resolve_transfer(
            args.sender_id.clone(),
            args.receiver_id.clone(),
            args.amount,
        );
        self.save_contract();
        sdk::value_return(&amount.to_be_bytes());
        #[cfg(feature = "log")]
        sdk::log(format!(
            "Resolve transfer from {} to {} amount {} success",
            args.sender_id, args.receiver_id, args.amount
        ));
    }

    pub fn ft_transfer_call(&mut self) {
        let args: TransferCallCallArgs = serde_json::from_slice(&sdk::read_input()[..]).unwrap();

        self.contract.token.ft_transfer_call(
            args.receiver_id.clone(),
            args.amount,
            args.memo.clone(),
            args.msg.clone(),
        );
        self.save_contract();
        #[cfg(feature = "log")]
        sdk::log(format!(
            "Transfer call to {} amount success {}",
            args.receiver_id, args.amount,
        ));
    }

    pub fn storage_deposit(&mut self) {
        let args: StorageDepositCallArgs = serde_json::from_slice(&sdk::read_input()[..]).unwrap();
        let res = self
            .contract
            .token
            .storage_deposit(args.account_id, args.registration_only)
            .try_to_vec()
            .unwrap();
        self.save_contract();
        sdk::value_return(&res[..]);
    }

    pub fn storage_withdraw(&mut self) {
        let args: StorageWithdrawCallArgs = serde_json::from_slice(&sdk::read_input()[..]).unwrap();
        let res = self
            .contract
            .token
            .storage_withdraw(args.amount)
            .try_to_vec()
            .unwrap();
        self.save_contract();
        sdk::value_return(&res[..]);
    }

    pub fn storage_balance_of(&self) {
        let args: StorageBalanceOfCallArgs =
            serde_json::from_slice(&sdk::read_input()[..]).unwrap();
        let res = self
            .contract
            .token
            .storage_balance_of(args.account_id)
            .try_to_vec()
            .unwrap();
        sdk::value_return(&res[..]);
    }

    fn save_contract(&mut self) {
        sdk::save_contract(&self.contract);
    }
}
