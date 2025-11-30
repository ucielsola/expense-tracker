import { Currency } from './enums';

export interface CreditCardPurchase {
  id: number;
  credit_card_account_id: number;
  date: Date;
  description: string;
  amount: number;
  currency: Currency;
  category_id?: number;
  installment_number: number;
  total_installments: number;
  purchase_group_id: string;
  created_at: Date;
}

export interface CreditCardPurchaseDetailed {
  id: number;
  date: Date;
  description: string;
  credit_card_name: string;
  amount: number;
  currency: Currency;
  category_name?: string;
  installment_number: number;
  total_installments: number;
  purchase_group_id: string;
  created_at: Date;
}

export interface CreateCreditCardPurchaseDTO {
  creditCardAccountId: number;
  date: Date;
  description: string;
  amount: number;
  currency: Currency;
  categoryId?: number;
  installmentNumber: number;
  totalInstallments: number;
  purchaseGroupId: string;
}

export interface CreateFullCreditCardPurchaseDTO {
  creditCardAccountId: number;
  date: Date;
  description: string;
  totalAmount: number;
  currency: Currency;
  categoryId?: number;
  totalInstallments: number;
}
