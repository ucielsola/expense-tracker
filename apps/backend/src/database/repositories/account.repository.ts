import { pool } from '../connection';
import type { Account, AccountBalance, CreateAccountDTO } from '../../types';
import { Currency } from '../../types';

export class AccountRepository {
  async findById(id: number): Promise<Account | null> {
    const result = await pool.query(
      'SELECT * FROM accounts WHERE id = $1',
      [id]
    );
    return result.rows.length > 0 ? this.mapToAccount(result.rows[0]) : null;
  }

  async findByName(name: string): Promise<Account | null> {
    const result = await pool.query(
      'SELECT * FROM accounts WHERE name ILIKE $1',
      [name]
    );
    return result.rows.length > 0 ? this.mapToAccount(result.rows[0]) : null;
  }

  async findAll(): Promise<Account[]> {
    const result = await pool.query('SELECT * FROM accounts ORDER BY name');
    return result.rows.map(row => this.mapToAccount(row));
  }

  async create(data: CreateAccountDTO): Promise<Account> {
    const result = await pool.query(
      `INSERT INTO accounts (name, type, currency)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.name, data.type, data.currency]
    );
    return this.mapToAccount(result.rows[0]);
  }

  async getBalance(accountId: number, currency: Currency): Promise<number> {
    // Calculate balance from transactions
    const result = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN to_account_id = $1 THEN to_amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN from_account_id = $1 THEN from_amount ELSE 0 END), 0) as balance
       FROM transactions
       WHERE (to_account_id = $1 OR from_account_id = $1)
         AND is_archived = FALSE`,
      [accountId]
    );
    return parseFloat(result.rows[0].balance) || 0;
  }

  async getAllBalances(): Promise<AccountBalance[]> {
    const result = await pool.query(
      `SELECT
        a.id as account_id,
        a.name as account_name,
        a.currency,
        COALESCE(SUM(CASE WHEN t.to_account_id = a.id THEN t.to_amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN t.from_account_id = a.id THEN t.from_amount ELSE 0 END), 0) as balance
       FROM accounts a
       LEFT JOIN transactions t ON (t.to_account_id = a.id OR t.from_account_id = a.id) AND t.is_archived = FALSE
       GROUP BY a.id, a.name, a.currency
       ORDER BY a.name`
    );

    return result.rows.map(row => ({
      account_id: row.account_id,
      account_name: row.account_name,
      currency: row.currency,
      balance: parseFloat(row.balance) || 0
    }));
  }

  async getAccountsRankedByExpenses(options: {
    startDate?: Date;
    endDate?: Date;
    sort?: 'asc' | 'desc';
    limit?: number;
    includeArchived?: boolean;
  }): Promise<{ account_name: string; total_expenses: number }[]> {
    const {
      startDate = new Date('1970-01-01'),
      endDate = new Date(),
      sort = 'desc',
      limit = 10,
      includeArchived = false,
    } = options;

    const result = await pool.query(
      `SELECT
        a.name as account_name,
        COALESCE(SUM(t.from_amount), 0) as total_expenses
       FROM accounts a
       JOIN transactions t ON t.from_account_id = a.id
       WHERE t.type = 'expense'
         AND t.date >= $1
         AND t.date <= $2
         ${includeArchived ? '' : 'AND t.is_archived = FALSE'}
       GROUP BY a.id, a.name
       ORDER BY total_expenses ${sort === 'asc' ? 'ASC' : 'DESC'}
       LIMIT $3`,
      [startDate, endDate, limit]
    );

    return result.rows.map(row => ({
      account_name: row.account_name,
      total_expenses: parseFloat(row.total_expenses) || 0,
    }));
  }

  async getAccountsRankedByTransactionCount(options: {
    startDate?: Date;
    endDate?: Date;
    sort?: 'asc' | 'desc';
    limit?: number;
    includeArchived?: boolean;
  }): Promise<{ account_name: string; transaction_count: number }[]> {
    const {
      startDate = new Date('1970-01-01'),
      endDate = new Date(),
      sort = 'desc',
      limit = 10,
      includeArchived = false,
    } = options;

    const result = await pool.query(
      `SELECT
        a.name as account_name,
        COUNT(t.id) as transaction_count
       FROM accounts a
       JOIN transactions t ON (t.from_account_id = a.id OR t.to_account_id = a.id)
       WHERE t.date >= $1
         AND t.date <= $2
         ${includeArchived ? '' : 'AND t.is_archived = FALSE'}
       GROUP BY a.id, a.name
       ORDER BY transaction_count ${sort === 'asc' ? 'ASC' : 'DESC'}
       LIMIT $3`,
      [startDate, endDate, limit]
    );

    return result.rows.map(row => ({
      account_name: row.account_name,
      transaction_count: parseInt(row.transaction_count) || 0,
    }));
  }

  private mapToAccount(row: any): Account {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      currency: row.currency,
      created_at: row.created_at
    };
  }
}

// Singleton pattern
let instance: AccountRepository | null = null;

export function getAccountRepository(): AccountRepository {
  if (!instance) {
    instance = new AccountRepository();
  }
  return instance;
}
