import { Currency, TransactionType } from './enums';

export interface Transaction {
  id: number;
  date: Date;
  description: string;
  from_account_id?: number;
  to_account_id?: number;
  from_amount?: number;
  to_amount: number;
  from_currency?: Currency;
  to_currency: Currency;
  exchange_rate: number;
  category_id?: number;
  type: TransactionType;
  is_archived: boolean;
  created_at: Date;
}

export interface TransactionDetailed {
  id: number;
  date: Date;
  description: string;
  type: TransactionType;
  from_account_name?: string;
  to_account_name?: string;
  from_amount?: number;
  to_amount: number;
  from_currency?: Currency;
  to_currency: Currency;
  exchange_rate: number;
  category_name?: string;
  is_archived: boolean;
  created_at: Date;
}

export interface CreateTransactionDTO {
  date: Date;
  description: string;
  fromAccountId?: number;
  toAccountId?: number;
  fromAmount?: number;
  toAmount: number;
  fromCurrency?: Currency;
  toCurrency: Currency;
  categoryId?: number;
  type: TransactionType;
}

export interface CreateIncomeDTO {
  date: Date;
  description: string;
  accountId: number;
  amount: number;
  currency: Currency;
}

export interface CreateTransferDTO {
  date: Date;
  description: string;
  fromAccountId: number;
  toAccountId: number;
  fromAmount: number;
  toAmount: number;
}

export interface CreateExpenseDTO {
  date: Date;
  description: string;
  accountId: number;
  amount: number;
  categoryId: number;
}
