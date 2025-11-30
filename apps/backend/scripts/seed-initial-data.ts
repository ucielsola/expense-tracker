import 'dotenv/config';
import { pool } from '../src/database/connection';
import { AccountType, Currency, TransactionType } from '../src/types/enums';
import { v4 as uuidv4 } from 'uuid';

/**
 * Seed script to populate initial data in the database
 * Run with: npm run seed
 *
 * This script is idempotent - it won't duplicate data if run multiple times
 */

interface InitialAccount {
  name: string;
  type: AccountType;
  currency: Currency;
}

interface InitialTransaction {
  date: Date;
  description: string;
  toAccountName: string;
  toAmount: number;
  toCurrency: Currency;
  type: TransactionType;
}

interface InitialCreditCardPurchase {
  creditCardAccountName: string;
  date: Date;
  description: string;
  totalAmount: number;
  currency: Currency;
  totalInstallments: number;
  categoryName?: string;
}

// ============================================================================
// CONFIGURE YOUR INITIAL DATA HERE
// ============================================================================

const initialAccounts: InitialAccount[] = [
  // Example: Uncomment and modify these to add your accounts
  // { name: 'Main Checking', type: AccountType.BANK, currency: Currency.USD },
  // { name: 'Savings Account', type: AccountType.BANK, currency: Currency.USD },
  // { name: 'Crypto Wallet', type: AccountType.CRYPTO, currency: Currency.USDC },
  // { name: 'Visa Credit Card', type: AccountType.CREDIT_CARD, currency: Currency.USD },
];

const initialTransactions: InitialTransaction[] = [
  // Example: Add initial balances as income transactions
  // {
  //   date: new Date('2025-01-01'),
  //   description: 'Initial balance',
  //   toAccountName: 'Main Checking',
  //   toAmount: 5000.00,
  //   toCurrency: Currency.USD,
  //   type: TransactionType.INCOME,
  // },
];

const initialCreditCardPurchases: InitialCreditCardPurchase[] = [
  // Example: Add existing credit card installments
  // {
  //   creditCardAccountName: 'Visa Credit Card',
  //   date: new Date('2024-11-15'),
  //   description: 'TV Purchase - Samsung 55"',
  //   totalAmount: 1200.00,
  //   currency: Currency.USD,
  //   totalInstallments: 12,
  //   categoryName: 'Electronics', // Optional - must exist in categories table
  // },
];

// ============================================================================
// SEED LOGIC (Don't modify unless you know what you're doing)
// ============================================================================

async function seedAccounts() {
  console.log('\n📁 Seeding accounts...');

  for (const account of initialAccounts) {
    const existing = await pool.query(
      'SELECT id FROM accounts WHERE name = $1',
      [account.name]
    );

    if (existing.rows.length > 0) {
      console.log(`  ⏭️  Account "${account.name}" already exists, skipping`);
      continue;
    }

    await pool.query(
      'INSERT INTO accounts (name, type, currency) VALUES ($1, $2, $3)',
      [account.name, account.type, account.currency]
    );
    console.log(`  ✓ Created account: ${account.name} (${account.type}, ${account.currency})`);
  }
}

async function seedTransactions() {
  console.log('\n💰 Seeding transactions...');

  for (const transaction of initialTransactions) {
    // Get account ID
    const accountResult = await pool.query(
      'SELECT id FROM accounts WHERE name = $1',
      [transaction.toAccountName]
    );

    if (accountResult.rows.length === 0) {
      console.log(`  ⚠️  Account "${transaction.toAccountName}" not found, skipping transaction`);
      continue;
    }

    const accountId = accountResult.rows[0].id;

    // Check if similar transaction exists (same description and amount on same date)
    const existing = await pool.query(
      `SELECT id FROM transactions
       WHERE description = $1
         AND to_amount = $2
         AND DATE(date) = DATE($3)
         AND to_account_id = $4`,
      [transaction.description, transaction.toAmount, transaction.date, accountId]
    );

    if (existing.rows.length > 0) {
      console.log(`  ⏭️  Transaction "${transaction.description}" already exists, skipping`);
      continue;
    }

    // Insert transaction
    await pool.query(
      `INSERT INTO transactions
       (date, description, to_account_id, to_amount, to_currency, exchange_rate, type, is_archived)
       VALUES ($1, $2, $3, $4, $5, 1.0, $6, FALSE)`,
      [
        transaction.date,
        transaction.description,
        accountId,
        transaction.toAmount,
        transaction.toCurrency,
        transaction.type,
      ]
    );
    console.log(`  ✓ Created transaction: ${transaction.description} (+${transaction.toAmount} ${transaction.toCurrency})`);
  }
}

async function seedCreditCardPurchases() {
  console.log('\n💳 Seeding credit card purchases...');

  for (const purchase of initialCreditCardPurchases) {
    // Get credit card account ID
    const accountResult = await pool.query(
      'SELECT id FROM accounts WHERE name = $1 AND type = $2',
      [purchase.creditCardAccountName, AccountType.CREDIT_CARD]
    );

    if (accountResult.rows.length === 0) {
      console.log(`  ⚠️  Credit card account "${purchase.creditCardAccountName}" not found, skipping`);
      continue;
    }

    const creditCardAccountId = accountResult.rows[0].id;

    // Get category ID if specified
    let categoryId = null;
    if (purchase.categoryName) {
      const categoryResult = await pool.query(
        'SELECT id FROM categories WHERE name = $1',
        [purchase.categoryName]
      );
      if (categoryResult.rows.length > 0) {
        categoryId = categoryResult.rows[0].id;
      } else {
        console.log(`  ⚠️  Category "${purchase.categoryName}" not found, creating without category`);
      }
    }

    // Check if purchase group already exists
    const existing = await pool.query(
      `SELECT purchase_group_id FROM credit_card_purchases
       WHERE credit_card_account_id = $1
         AND description = $2
         AND DATE(date) = DATE($3)
       LIMIT 1`,
      [creditCardAccountId, purchase.description, purchase.date]
    );

    if (existing.rows.length > 0) {
      console.log(`  ⏭️  Purchase "${purchase.description}" already exists, skipping`);
      continue;
    }

    // Create purchase group ID
    const purchaseGroupId = uuidv4();
    const installmentAmount = purchase.totalAmount / purchase.totalInstallments;

    // Insert all installments
    const values: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (let i = 1; i <= purchase.totalInstallments; i++) {
      values.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8})`
      );
      params.push(
        creditCardAccountId,
        purchase.date,
        purchase.description,
        installmentAmount,
        purchase.currency,
        categoryId,
        i,
        purchase.totalInstallments,
        purchaseGroupId
      );
      paramIndex += 9;
    }

    await pool.query(
      `INSERT INTO credit_card_purchases
       (credit_card_account_id, date, description, amount, currency, category_id, installment_number, total_installments, purchase_group_id)
       VALUES ${values.join(', ')}`,
      params
    );

    console.log(`  ✓ Created purchase: ${purchase.description} (${purchase.totalInstallments}x ${installmentAmount.toFixed(2)} ${purchase.currency})`);
  }
}

async function main() {
  console.log('🌱 Starting database seed...\n');
  console.log('================================================');

  try {
    // Test connection
    const client = await pool.connect();
    console.log('✓ Database connection established');
    client.release();

    // Run seed functions
    await seedAccounts();
    await seedTransactions();
    await seedCreditCardPurchases();

    console.log('\n================================================');
    console.log('✅ Seed completed successfully!\n');

    // Show summary
    const accountCount = await pool.query('SELECT COUNT(*) FROM accounts');
    const transactionCount = await pool.query('SELECT COUNT(*) FROM transactions WHERE is_archived = FALSE');
    const purchaseCount = await pool.query('SELECT COUNT(DISTINCT purchase_group_id) FROM credit_card_purchases');

    console.log('📊 Database Summary:');
    console.log(`   Accounts: ${accountCount.rows[0].count}`);
    console.log(`   Transactions: ${transactionCount.rows[0].count}`);
    console.log(`   Credit Card Purchase Groups: ${purchaseCount.rows[0].count}`);
    console.log('');

  } catch (error) {
    console.error('\n❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
