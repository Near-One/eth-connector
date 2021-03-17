#![allow(dead_code)]
use super::*;

#[derive(Debug, BorshDeserialize, BorshSerialize)]
pub struct FungibleToken {
	/// AccountID -> Account balance.
	pub accounts: BTreeMap<AccountId, Balance>,

	/// Total supply of the all token.
	pub total_supply: Balance,

	/// The storage size in bytes for one account.
	pub account_storage_usage: StorageUsage,
}

impl FungibleToken {
	pub fn new() -> Self {
		let mut this = Self {
			accounts: BTreeMap::new(),
			total_supply: 0,
			account_storage_usage: 0,
		};
		this.measure_account_storage_usage();
		this
	}

	fn measure_account_storage_usage(&mut self) {
		let initial_storage_usage = sdk::storage_usage();
		let tmp_account_id = "a".repeat(64);
		self.accounts.insert(tmp_account_id.clone().into(), 0);
		self.account_storage_usage = sdk::storage_usage() - initial_storage_usage;
		self.accounts.remove(&tmp_account_id);
	}

	pub fn internal_unwrap_balance_of(&self, account_id: &AccountId) -> Balance {
		match self.accounts.get(account_id.into()) {
			Some(balance) => *balance,
			None => {
				sdk::panic_utf8(format!("The account {} is not registered", &account_id).as_bytes())
			}
		}
	}

	pub fn internal_deposit(&mut self, account_id: &AccountId, amount: Balance) {
		let balance = self.internal_unwrap_balance_of(account_id);
		if let Some(new_balance) = balance.checked_add(amount) {
			self.accounts.insert(account_id.into(), new_balance);
			self.total_supply = self
				.total_supply
				.checked_add(amount)
				.expect("Total supply overflow");
		} else {
			sdk::panic_utf8("Balance overflow".as_bytes());
		}
	}

	pub fn internal_withdraw(&mut self, account_id: &AccountId, amount: Balance) {
		let balance = self.internal_unwrap_balance_of(account_id);
		if let Some(new_balance) = balance.checked_sub(amount) {
			self.accounts.insert(account_id.into(), new_balance);
			self.total_supply = self
				.total_supply
				.checked_sub(amount)
				.expect("Total supply overflow");
		} else {
			sdk::panic_utf8("The account doesn't have enough balance".as_bytes());
		}
	}

	pub fn internal_transfer(
		&mut self,
		sender_id: &AccountId,
		receiver_id: &AccountId,
		amount: Balance,
		memo: Option<String>,
	) {
		assert_ne!(
			sender_id, receiver_id,
			"Sender and receiver should be different"
		);
		assert!(amount > 0, "The amount should be a positive number");
		self.internal_withdraw(sender_id, amount);
		self.internal_deposit(receiver_id, amount);
		sdk::log(format!(
			"Transfer {} from {} to {}",
			amount, sender_id, receiver_id
		));
		if let Some(memo) = memo {
			sdk::log(format!("Memo: {}", memo));
		}
	}

	pub fn internal_register_account(&mut self, account_id: &AccountId) {
		if self.accounts.insert(account_id.into(), 0).is_some() {
			sdk::panic_utf8("The account is already registered".as_bytes());
		}
	}
}
