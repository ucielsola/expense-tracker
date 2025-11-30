import { pool } from '../connection';
import type {
  CreditCardPurchase,
  CreditCardPurchaseDetailed,
  CreateCreditCardPurchaseDTO
} from '../../types';

export class CreditCardRepository {
  async create(data: CreateCreditCardPurchaseDTO): Promise<CreditCardPurchase> {
    const result = await pool.query(
      `INSERT INTO credit_card_purchases (
        credit_card_account_id, date, description, amount, currency,
        category_id, installment_number, total_installments, purchase_group_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        data.creditCardAccountId,
        data.date,
        data.description,
        data.amount,
        data.currency,
        data.categoryId || null,
        data.installmentNumber,
        data.totalInstallments,
        data.purchaseGroupId
      ]
    );

    return this.mapToCreditCardPurchase(result.rows[0]);
  }

  async findUpcomingInstallments(
    creditCardAccountId: number,
    months: number = 3
  ): Promise<CreditCardPurchaseDetailed[]> {
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);

    const result = await pool.query(
      `SELECT
        p.id,
        p.date,
        p.description,
        a.name as credit_card_name,
        p.amount,
        p.currency,
        c.name as category_name,
        p.installment_number,
        p.total_installments,
        p.purchase_group_id,
        p.created_at
       FROM credit_card_purchases p
       JOIN accounts a ON p.credit_card_account_id = a.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.credit_card_account_id = $1
         AND p.date >= CURRENT_DATE
         AND p.date <= $2
       ORDER BY p.date ASC, p.created_at ASC`,
      [creditCardAccountId, endDate]
    );

    return result.rows.map(row => this.mapToCreditCardPurchaseDetailed(row));
  }

  async findByPurchaseGroup(purchaseGroupId: string): Promise<CreditCardPurchase[]> {
    const result = await pool.query(
      `SELECT * FROM credit_card_purchases
       WHERE purchase_group_id = $1
       ORDER BY installment_number`,
      [purchaseGroupId]
    );

    return result.rows.map(row => this.mapToCreditCardPurchase(row));
  }

  async countRemainingInstallments(creditCardAccountId?: number): Promise<number> {
    const query = creditCardAccountId
      ? `SELECT COUNT(*) as count
         FROM credit_card_purchases
         WHERE credit_card_account_id = $1
           AND date >= CURRENT_DATE`
      : `SELECT COUNT(*) as count
         FROM credit_card_purchases
         WHERE date >= CURRENT_DATE`;

    const params = creditCardAccountId ? [creditCardAccountId] : [];
    const result = await pool.query(query, params);
    return parseInt(result.rows[0].count) || 0;
  }

  async getTotalDebt(creditCardAccountId?: number): Promise<{ credit_card_name: string; total_debt: number; currency: string }[]> {
    const query = creditCardAccountId
      ? `SELECT
          a.name as credit_card_name,
          SUM(p.amount) as total_debt,
          p.currency
         FROM credit_card_purchases p
         JOIN accounts a ON p.credit_card_account_id = a.id
         WHERE p.credit_card_account_id = $1
           AND p.date >= CURRENT_DATE
         GROUP BY a.id, a.name, p.currency`
      : `SELECT
          a.name as credit_card_name,
          SUM(p.amount) as total_debt,
          p.currency
         FROM credit_card_purchases p
         JOIN accounts a ON p.credit_card_account_id = a.id
         WHERE p.date >= CURRENT_DATE
         GROUP BY a.id, a.name, p.currency`;

    const params = creditCardAccountId ? [creditCardAccountId] : [];
    const result = await pool.query(query, params);

    return result.rows.map(row => ({
      credit_card_name: row.credit_card_name,
      total_debt: parseFloat(row.total_debt) || 0,
      currency: row.currency
    }));
  }

  private mapToCreditCardPurchase(row: any): CreditCardPurchase {
    return {
      id: row.id,
      credit_card_account_id: row.credit_card_account_id,
      date: row.date,
      description: row.description,
      amount: parseFloat(row.amount),
      currency: row.currency,
      category_id: row.category_id,
      installment_number: row.installment_number,
      total_installments: row.total_installments,
      purchase_group_id: row.purchase_group_id,
      created_at: row.created_at
    };
  }

  private mapToCreditCardPurchaseDetailed(row: any): CreditCardPurchaseDetailed {
    return {
      id: row.id,
      date: row.date,
      description: row.description,
      credit_card_name: row.credit_card_name,
      amount: parseFloat(row.amount),
      currency: row.currency,
      category_name: row.category_name,
      installment_number: row.installment_number,
      total_installments: row.total_installments,
      purchase_group_id: row.purchase_group_id,
      created_at: row.created_at
    };
  }
}

// Singleton pattern
let instance: CreditCardRepository | null = null;

export function getCreditCardRepository(): CreditCardRepository {
  if (!instance) {
    instance = new CreditCardRepository();
  }
  return instance;
}
