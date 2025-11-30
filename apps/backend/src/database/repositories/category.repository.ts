import { pool } from '../connection';
import type { Category, CreateCategoryDTO, CategoryExpenseSummary } from '../../types';

export class CategoryRepository {
  async findById(id: number): Promise<Category | null> {
    const result = await pool.query(
      'SELECT * FROM categories WHERE id = $1',
      [id]
    );
    return result.rows.length > 0 ? this.mapToCategory(result.rows[0]) : null;
  }

  async findByName(name: string): Promise<Category | null> {
    const result = await pool.query(
      'SELECT * FROM categories WHERE name ILIKE $1',
      [name]
    );
    return result.rows.length > 0 ? this.mapToCategory(result.rows[0]) : null;
  }

  async findAll(): Promise<Category[]> {
    const result = await pool.query('SELECT * FROM categories ORDER BY name');
    return result.rows.map(row => this.mapToCategory(row));
  }

  async create(data: CreateCategoryDTO): Promise<Category> {
    const result = await pool.query(
      `INSERT INTO categories (name)
       VALUES ($1)
       RETURNING *`,
      [data.name]
    );
    return this.mapToCategory(result.rows[0]);
  }

  async getExpensesSummary(
    startDate: Date,
    endDate: Date
  ): Promise<CategoryExpenseSummary[]> {
    const result = await pool.query(
      `SELECT
        c.name as category_name,
        SUM(t.from_amount) as total_amount,
        t.from_currency as currency,
        COUNT(*) as transaction_count
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE t.type = 'expense'
         AND t.date >= $1
         AND t.date <= $2
         AND t.is_archived = FALSE
       GROUP BY c.name, t.from_currency
       ORDER BY total_amount DESC`,
      [startDate, endDate]
    );

    return result.rows.map(row => ({
      category_name: row.category_name,
      total_amount: parseFloat(row.total_amount),
      currency: row.currency,
      transaction_count: parseInt(row.transaction_count)
    }));
  }

  private mapToCategory(row: any): Category {
    return {
      id: row.id,
      name: row.name,
      created_at: row.created_at
    };
  }
}

// Singleton pattern
let instance: CategoryRepository | null = null;

export function getCategoryRepository(): CategoryRepository {
  if (!instance) {
    instance = new CategoryRepository();
  }
  return instance;
}
