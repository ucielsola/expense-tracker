import { v4 as uuidv4 } from 'uuid';
import {
  getAccountRepository,
  getCategoryRepository,
  getTransactionRepository,
  getCreditCardRepository
} from '../database/repositories';
import {
  CreateIncomeDTO,
  CreateTransferDTO,
  CreateExpenseDTO,
  CreateFullCreditCardPurchaseDTO,
  TransactionDetailed,
  AccountBalance,
} from '../types';
import { TransactionType } from '../types';

export class ExpenseTrackerService {
  private accountRepo = getAccountRepository();
  private categoryRepo = getCategoryRepository();
  private transactionRepo = getTransactionRepository();
  private creditCardRepo = getCreditCardRepository();

  // =====================================================
  // INCOME TRANSACTIONS
  // =====================================================

  async recordIncome(data: CreateIncomeDTO) {
    const account = await this.accountRepo.findById(data.accountId);
    if (!account) {
      throw new Error(`Account ${data.accountId} not found`);
    }

    return this.transactionRepo.create({
      date: data.date,
      description: data.description,
      toAccountId: data.accountId,
      toAmount: data.amount,
      toCurrency: data.currency,
      fromAmount: data.amount,
      fromCurrency: data.currency,
      type: TransactionType.INCOME
    });
  }

  // =====================================================
  // TRANSFER TRANSACTIONS
  // =====================================================

  async recordTransfer(data: CreateTransferDTO) {
    const fromAccount = await this.accountRepo.findById(data.fromAccountId);
    const toAccount = await this.accountRepo.findById(data.toAccountId);

    if (!fromAccount) {
      throw new Error(`From account ${data.fromAccountId} not found`);
    }
    if (!toAccount) {
      throw new Error(`To account ${data.toAccountId} not found`);
    }

    return this.transactionRepo.create({
      date: data.date,
      description: data.description,
      fromAccountId: data.fromAccountId,
      toAccountId: data.toAccountId,
      fromAmount: data.fromAmount,
      toAmount: data.toAmount,
      fromCurrency: fromAccount.currency,
      toCurrency: toAccount.currency,
      type: TransactionType.TRANSFER
    });
  }

  // =====================================================
  // EXPENSE TRANSACTIONS
  // =====================================================

  async recordExpense(data: CreateExpenseDTO) {
    const account = await this.accountRepo.findById(data.accountId);
    if (!account) {
      throw new Error(`Account ${data.accountId} not found`);
    }

    const category = await this.categoryRepo.findById(data.categoryId);
    if (!category) {
      throw new Error(`Category ${data.categoryId} not found`);
    }

    return this.transactionRepo.create({
      date: data.date,
      description: data.description,
      fromAccountId: data.accountId,
      fromAmount: data.amount,
      toAmount: data.amount,
      fromCurrency: account.currency,
      toCurrency: account.currency,
      categoryId: data.categoryId,
      type: TransactionType.EXPENSE
    });
  }

  // =====================================================
  // CREDIT CARD PAYMENT TRANSACTIONS
  // =====================================================

  async recordCreditCardPayment(
    fromAccountId: number,
    creditCardAccountId: number,
    amount: number,
    date: Date = new Date(),
    description: string = 'Credit card payment'
  ) {
    const fromAccount = await this.accountRepo.findById(fromAccountId);
    const creditCardAccount = await this.accountRepo.findById(creditCardAccountId);

    if (!fromAccount) {
      throw new Error(`From account ${fromAccountId} not found`);
    }
    if (!creditCardAccount) {
      throw new Error(`Credit card account ${creditCardAccountId} not found`);
    }
    if (creditCardAccount.type !== 'credit_card') {
      throw new Error(`Account ${creditCardAccountId} is not a credit card`);
    }

    return this.transactionRepo.create({
      date,
      description,
      fromAccountId,
      toAccountId: creditCardAccountId,
      fromAmount: amount,
      toAmount: amount,
      fromCurrency: fromAccount.currency,
      toCurrency: creditCardAccount.currency,
      type: TransactionType.CREDIT_CARD_PAYMENT
    });
  }

  // =====================================================
  // CREDIT CARD PURCHASES
  // =====================================================

  async recordCreditCardPurchase(data: CreateFullCreditCardPurchaseDTO) {
    const creditCardAccount = await this.accountRepo.findById(data.creditCardAccountId);
    if (!creditCardAccount) {
      throw new Error(`Credit card account ${data.creditCardAccountId} not found`);
    }
    if (creditCardAccount.type !== 'credit_card') {
      throw new Error(`Account ${data.creditCardAccountId} is not a credit card`);
    }

    if (data.categoryId) {
      const category = await this.categoryRepo.findById(data.categoryId);
      if (!category) {
        throw new Error(`Category ${data.categoryId} not found`);
      }
    }

    const purchaseGroupId = uuidv4();
    const installmentAmount = data.totalAmount / data.totalInstallments;
    const purchases = [];

    // Create all installments
    for (let i = 1; i <= data.totalInstallments; i++) {
      const installmentDate = new Date(data.date);
      installmentDate.setMonth(installmentDate.getMonth() + (i - 1));

      const purchase = await this.creditCardRepo.create({
        creditCardAccountId: data.creditCardAccountId,
        date: installmentDate,
        description: `${data.description} (${i}/${data.totalInstallments})`,
        amount: installmentAmount,
        currency: data.currency,
        categoryId: data.categoryId,
        installmentNumber: i,
        totalInstallments: data.totalInstallments,
        purchaseGroupId
      });

      purchases.push(purchase);
    }

    return purchases;
  }

  // =====================================================
  // ACCOUNT OPERATIONS
  // =====================================================

  async getAccountBalance(accountId: number): Promise<number> {
    const account = await this.accountRepo.findById(accountId);
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }
    return this.accountRepo.getBalance(accountId, account.currency);
  }

  async getAllAccountBalances(): Promise<AccountBalance[]> {
    return this.accountRepo.getAllBalances();
  }

  async getAccountTransactions(
    accountId: number,
    limit: number = 50
  ): Promise<TransactionDetailed[]> {
    return this.transactionRepo.findByAccount(accountId, limit);
  }

  // =====================================================
  // REPORTING & ANALYTICS
  // =====================================================

  async getRecentTransactions(limit: number = 20): Promise<TransactionDetailed[]> {
    return this.transactionRepo.findRecent(limit);
  }

  async getTransactionsByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<TransactionDetailed[]> {
    return this.transactionRepo.findByDateRange(startDate, endDate);
  }

  async getExpensesByCategory(startDate: Date, endDate: Date) {
    return this.categoryRepo.getExpensesSummary(startDate, endDate);
  }

  async getCreditCardUpcomingPayments(
    creditCardAccountId: number,
    months: number = 3
  ) {
    return this.creditCardRepo.findUpcomingInstallments(creditCardAccountId, months);
  }

  async getTotalExpenses(startDate: Date, endDate: Date) {
    return this.transactionRepo.getTotalByType(TransactionType.EXPENSE, startDate, endDate);
  }

  async archiveTransaction(transactionId: number): Promise<void> {
    await this.transactionRepo.archiveById(transactionId);
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  async findAccountByName(name: string) {
    return this.accountRepo.findByName(name);
  }

  async findAccountById(id: number) {
    return this.accountRepo.findById(id);
  }

  async findTransactionsByDescription(description: string): Promise<TransactionDetailed[]> {
    return this.transactionRepo.findTransactionsByDescription(description);
  }

  async findCategoryByName(name: string) {
    return this.categoryRepo.findByName(name);
  }

  async getAllAccounts() {
    return this.accountRepo.findAll();
  }

  async getAllCategories() {
    return this.categoryRepo.findAll();
  }
}

// Singleton pattern
let instance: ExpenseTrackerService | null = null;

export function getExpenseTrackerService(): ExpenseTrackerService {
  if (!instance) {
    instance = new ExpenseTrackerService();
  }
  return instance;
}
