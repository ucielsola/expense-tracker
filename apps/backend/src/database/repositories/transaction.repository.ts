import { pool } from '../connection';
import type { Transaction, TransactionDetailed, CreateTransactionDTO } from '../../types';
import { TransactionType } from '../../types';

export class TransactionRepository {
  async create(data: CreateTransactionDTO): Promise<Transaction> {
    // Calculate exchange rate
    const exchangeRate = data.fromAmount && data.toAmount
      ? data.toAmount / data.fromAmount
      : 1;

    const result = await pool.query(
      `INSERT INTO transactions (
        date, description, from_account_id, to_account_id,
        from_amount, to_amount, from_currency, to_currency,
        exchange_rate, category_id, type
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        data.date,
        data.description,
        data.fromAccountId || null,
        data.toAccountId || null,
        data.fromAmount || null,
        data.toAmount,
        data.fromCurrency || null,
        data.toCurrency,
        exchangeRate,
        data.categoryId || null,
        data.type
      ]
    );

    return this.mapToTransaction(result.rows[0]);
  }

  async findByAccount(accountId: number, limit: number = 50): Promise<TransactionDetailed[]> {
    const result = await pool.query(
      `SELECT
        t.id,
        t.date,
        t.description,
        t.type,
        fa.name as from_account_name,
        ta.name as to_account_name,
        t.from_amount,
        t.to_amount,
        t.from_currency,
        t.to_currency,
        t.exchange_rate,
        c.name as category_name,
        t.created_at
       FROM transactions t
       LEFT JOIN accounts fa ON t.from_account_id = fa.id
       LEFT JOIN accounts ta ON t.to_account_id = ta.id
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE (t.from_account_id = $1 OR t.to_account_id = $1) AND t.is_archived = FALSE
       ORDER BY t.date DESC, t.created_at DESC
       LIMIT $2`,
      [accountId, limit]
    );

    return result.rows.map(row => this.mapToTransactionDetailed(row));
  }

  async findRecent(limit: number = 20): Promise<TransactionDetailed[]> {
    const result = await pool.query(
      `SELECT
        t.id,
        t.date,
        t.description,
        t.type,
        fa.name as from_account_name,
        ta.name as to_account_name,
        t.from_amount,
        t.to_amount,
        t.from_currency,
        t.to_currency,
        t.exchange_rate,
        c.name as category_name,
        t.created_at
       FROM transactions t
       LEFT JOIN accounts fa ON t.from_account_id = fa.id
       LEFT JOIN accounts ta ON t.to_account_id = ta.id
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.is_archived = FALSE
       ORDER BY t.date DESC, t.created_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => this.mapToTransactionDetailed(row));
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<TransactionDetailed[]> {
    const result = await pool.query(
      `SELECT
        t.id,
        t.date,
        t.description,
        t.type,
        fa.name as from_account_name,
        ta.name as to_account_name,
        t.from_amount,
        t.to_amount,
        t.from_currency,
        t.to_currency,
        t.exchange_rate,
        c.name as category_name,
        t.created_at
       FROM transactions t
       LEFT JOIN accounts fa ON t.from_account_id = fa.id
       LEFT JOIN accounts ta ON t.to_account_id = ta.id
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.date >= $1 AND t.date <= $2 AND t.is_archived = FALSE
       ORDER BY t.date DESC, t.created_at DESC`,
      [startDate, endDate]
    );

    return result.rows.map(row => this.mapToTransactionDetailed(row));
  }

  async getTotalByType(
    type: TransactionType,
    startDate: Date,
    endDate: Date
  ): Promise<{ currency: string; total: number }[]> {
    const result = await pool.query(
      `SELECT
        from_currency as currency,
        SUM(from_amount) as total
       FROM transactions
       WHERE type = $1
         AND date >= $2
         AND date <= $3
         AND is_archived = FALSE
       GROUP BY from_currency`,
      [type, startDate, endDate]
    );

    return result.rows.map(row => ({
      currency: row.currency,
      total: parseFloat(row.total)
    }));
  }

  private mapToTransaction(row: any): Transaction {
    return {
      id: row.id,
      date: row.date,
      description: row.description,
      from_account_id: row.from_account_id,
      to_account_id: row.to_account_id,
      from_amount: row.from_amount ? parseFloat(row.from_amount) : undefined,
      to_amount: parseFloat(row.to_amount),
      from_currency: row.from_currency,
      to_currency: row.to_currency,
      exchange_rate: parseFloat(row.exchange_rate),
      category_id: row.category_id,
      type: row.type,
      is_archived: row.is_archived,
      created_at: row.created_at
    };
  }

  private mapToTransactionDetailed(row: any): TransactionDetailed {
    return {
      id: row.id,
      date: row.date,
      description: row.description,
      type: row.type,
      from_account_name: row.from_account_name,
      to_account_name: row.to_account_name,
      from_amount: row.from_amount ? parseFloat(row.from_amount) : undefined,
      to_amount: parseFloat(row.to_amount),
      from_currency: row.from_currency,
      to_currency: row.to_currency,
      exchange_rate: parseFloat(row.exchange_rate),
      category_name: row.category_name,
      is_archived: row.is_archived,
      created_at: row.created_at
    };
  }

  async archiveById(id: number): Promise<void> {
    await pool.query(
      `UPDATE transactions
       SET is_archived = TRUE
       WHERE id = $1`,
      [id]
    );
  }

  async findTransactionsByDescription(description: string, includeArchived: boolean = false): Promise<TransactionDetailed[]> {
    const result = await pool.query(
      `SELECT
        t.id,
        t.date,
        t.description,
        t.type,
        fa.name as from_account_name,
        ta.name as to_account_name,
        t.from_amount,
        t.to_amount,
        t.from_currency,
        t.to_currency,
        t.exchange_rate,
        c.name as category_name,
        t.created_at,
        t.is_archived
       FROM transactions t
       LEFT JOIN accounts fa ON t.from_account_id = fa.id
       LEFT JOIN accounts ta ON t.to_account_id = ta.id
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.description ILIKE $1
       ${includeArchived ? '' : 'AND t.is_archived = FALSE'}
       ORDER BY t.date DESC, t.created_at DESC
       LIMIT 10`,
      [`%${description}%`]
    );
    return result.rows.map(row => this.mapToTransactionDetailed(row));
  }

  async countArchived(): Promise<number> {
    const result = await pool.query(
      `SELECT COUNT(*) as count
       FROM transactions
       WHERE is_archived = TRUE`
    );
    return parseInt(result.rows[0].count) || 0;
  }
}

// Singleton pattern
let instance: TransactionRepository | null = null;

export function getTransactionRepository(): TransactionRepository {
  if (!instance) {
    instance = new TransactionRepository();
  }
  return instance;
}
