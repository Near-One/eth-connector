#![allow(dead_code)]
use super::*;

const GAS_FOR_RESOLVE_TRANSFER: Gas = 5_000_000_000_000;
const GAS_FOR_FT_TRANSFER_CALL: Gas = 25_000_000_000_000 + GAS_FOR_RESOLVE_TRANSFER;

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
        #[cfg(feature = "log")]
        sdk::log(format!(
            "Transfer {} from {} to {}",
            amount, sender_id, receiver_id
        ));
        if let Some(memo) = memo {
            #[cfg(feature = "log")]
            sdk::log(format!("Memo: {}", memo));
        }
    }

    pub fn internal_register_account(&mut self, account_id: &AccountId) {
        if self.accounts.insert(account_id.into(), 0).is_some() {
            sdk::panic_utf8("The account is already registered".as_bytes());
        }
    }

    pub fn ft_transfer(&mut self, receiver_id: AccountId, amount: Balance, memo: Option<String>) {
        sdk::assert_one_yocto();
        let sender_id = sdk::predecessor_account_id();
        self.internal_transfer(&sender_id, &receiver_id, amount, memo);
    }

    pub fn ft_total_supply(&self) -> u128 {
        self.total_supply
    }

    pub fn ft_balance_of(&self, account_id: AccountId) -> u128 {
        let key: &str = account_id.as_ref();
        *self.accounts.get(key).unwrap_or(&0)
    }

    pub fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: Balance,
        memo: Option<String>,
        msg: String,
    ) {
        sdk::assert_one_yocto();
        let sender_id = sdk::predecessor_account_id();
        self.internal_transfer(&sender_id, &receiver_id, amount, memo);
        let data1 = FtOnTransfer {
            amount,
            msg,
            receiver_id: receiver_id.clone(),
        }
        .try_to_vec()
        .unwrap();
        let data2 = FtResolveTransfer {
            receiver_id,
            amount,
            current_account_id: sdk::current_account_id(),
        }
        .try_to_vec()
        .unwrap();
        // Initiating receiver's call and the callback
        let promise0 = sdk::promise_create(
            sender_id.clone(),
            b"ft_on_transfer",
            &data1[..],
            sdk::NO_DEPOSIT,
            sdk::prepaid_gas() - GAS_FOR_FT_TRANSFER_CALL,
        );
        let promise1 = sdk::promise_then(
            promise0,
            sender_id,
            b"ft_resolve_transfer",
            &data2[..],
            sdk::NO_DEPOSIT,
            GAS_FOR_RESOLVE_TRANSFER,
        );
        sdk::promise_return(promise1);
    }

    pub fn internal_storage_unregister(
        &mut self,
        force: Option<bool>,
    ) -> Option<(AccountId, Balance)> {
        sdk::assert_one_yocto();
        let account_id = sdk::predecessor_account_id();
        let force = force.unwrap_or(false);
        if let Some(balance) = self.accounts.get(account_id.as_str()).cloned() {
            if balance == 0 || force {
                self.accounts.remove(&account_id);
                self.total_supply -= balance;
                let amount = self.storage_balance_bounds().min + 1;
                let promise0 = sdk::promise_batch_create(account_id.clone());
                sdk::promise_batch_action_transfer(promise0, amount);
                Some((account_id, balance))
            } else {
                sdk::panic_utf8(
                    "Can't unregister the account with the positive balance without force"
                        .as_bytes(),
                )
            }
        } else {
            #[cfg(feature = "log")]
            sdk::log(format!("The account {} is not registered", &account_id));
            None
        }
    }

    pub fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        let required_storage_balance =
            Balance::from(self.account_storage_usage) * sdk::storage_byte_cost();
        StorageBalanceBounds {
            min: required_storage_balance.into(),
            max: Some(required_storage_balance.into()),
        }
    }

    pub fn internal_storage_balance_of(&self, account_id: &AccountId) -> Option<StorageBalance> {
        if self.accounts.contains_key(account_id.as_str()) {
            Some(StorageBalance {
                total: self.storage_balance_bounds().min,
                available: 0,
            })
        } else {
            None
        }
    }

    pub fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.internal_storage_balance_of(&account_id)
    }
}
