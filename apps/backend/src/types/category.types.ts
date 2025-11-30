export interface Category {
  id: number;
  name: string;
  created_at: Date;
}

export interface CreateCategoryDTO {
  name: string;
}

export interface CategoryExpenseSummary {
  category_name: string;
  total_amount: number;
  currency: string;
  transaction_count: number;
}
