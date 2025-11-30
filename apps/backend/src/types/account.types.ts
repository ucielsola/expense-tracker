import { AccountType, Currency } from './enums';

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  currency: Currency;
  created_at: Date;
}

export interface CreateAccountDTO {
  name: string;
  type: AccountType;
  currency: Currency;
}

export interface AccountBalance {
  account_id: number;
  account_name: string;
  currency: Currency;
  balance: number;
}
