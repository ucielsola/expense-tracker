import { ZodError } from 'zod';
import {
  getAccountRepository,
  getCategoryRepository,
  getTransactionRepository,
  getCreditCardRepository
} from '../database/repositories';
import {
  GeneratedQuery,
  getQueryGeneratorJSONSchema,
  QueryGeneratorSchema
} from '../schemas';
import { getPromptManager } from './prompt-manager';
import { getTextProcessor } from './text-processor';
import { getLogger } from './logger.service';

export class AnalyticsService {
  private textProcessor = getTextProcessor();
  private promptManager = getPromptManager();
  private accountRepo = getAccountRepository();
  private categoryRepo = getCategoryRepository();
  private transactionRepo = getTransactionRepository();
  private creditCardRepo = getCreditCardRepository();
  private logger = getLogger();

  /**
   * Main method to process a natural language query
   */
  async processNaturalLanguageQuery(query: string): Promise<string> {
    this.logger.info(`      ├─ 🤖 QUERY GENERATOR: Parsing natural language...`);
    // 1. Generate structured query
    const generatedQuery = await this.generateQuery(query);

    this.logger.info(`      ├─ ✅ GENERATED QUERY:`);
    this.logger.info(`      │  ├─ Type: ${generatedQuery.query_type}`);
    this.logger.info(`      │  ├─ Time period: ${generatedQuery.time_period || 'all_time'}`);
    if (generatedQuery.limit) this.logger.info(`      │  ├─ Limit: ${generatedQuery.limit}`);
    if (generatedQuery.sort_order) this.logger.info(`      │  ├─ Sort: ${generatedQuery.sort_order}`);
    if (generatedQuery.include_archived) this.logger.info(`      │  ├─ Include archived: ${generatedQuery.include_archived}`);
    if (generatedQuery.credit_card_account_id) this.logger.info(`      │  └─ Credit card ID: ${generatedQuery.credit_card_account_id}`);

    // 2. Validate query
    this.logger.info(`      ├─ 🔒 VALIDATING QUERY...`);
    const isSafe = await this.validateQuery(query, generatedQuery);
    if (!isSafe) {
      this.logger.error(`      └─ ❌ VALIDATION FAILED - Query deemed unsafe:`, generatedQuery);
      throw new Error('Query was deemed unsafe to run.');
    }
    this.logger.info(`      ├─ ✅ Query validated as SAFE`);

    // 3. Execute query
    this.logger.info(`      ├─ 📊 EXECUTING DATABASE QUERY...`);
    const results = await this.executeQuery(generatedQuery);
    const resultCount = Array.isArray(results) ? results.length : (results.count !== undefined ? results.count : 1);
    this.logger.info(`      ├─ ✅ Query executed successfully (${resultCount} result${resultCount !== 1 ? 's' : ''})`);

    // 4. Format response
    this.logger.info(`      ├─ 📝 Formatting response for user...`);
    const response = this.formatResponse(generatedQuery, results);
    this.logger.info(`      └─ ✅ Response formatted (${response.length} characters)`);

    return response;
  }

  /**
   * Generates a structured query from a natural language string
   */
  private async generateQuery(
    naturalLanguageQuery: string
  ): Promise<GeneratedQuery> {
    try {
      const promptData = await this.promptManager.getPromptWithConfig(
        'query-generator',
        {
          config: { schema: getQueryGeneratorJSONSchema() },
        }
      );

      const schema = promptData.config?.schema || getQueryGeneratorJSONSchema();

      const parsed = await this.textProcessor.extractStructured<GeneratedQuery>(
        naturalLanguageQuery,
        promptData.prompt,
        {
          name: 'query_generator',
          schema: schema,
        },
        QueryGeneratorSchema
      );

      return parsed;
    } catch (error) {
      this.logger.error('Error generating structured query:', error);
      if (error instanceof ZodError) {
        this.logger.error('Validation errors:', error.errors);
      }
      throw new Error('Failed to generate a valid structured query from your request.');
    }
  }

  /**
   * Validates a generated query for safety
   */
  private async validateQuery(
    naturalLanguageQuery: string,
    generatedQuery: GeneratedQuery
  ): Promise<boolean> {
    // 1. Code-based validation (allow-list of query types)
    const allowedQueryTypes: GeneratedQuery['query_type'][] = [
      'rank_accounts_by_expense',
      'total_spending_by_category',
      'count_archived_transactions',
      'count_remaining_installments',
      'total_credit_card_debt',
      'rank_accounts_by_transaction_count',
    ];

    if (!allowedQueryTypes.includes(generatedQuery.query_type)) {
      this.logger.error(`Disallowed query type: ${generatedQuery.query_type}`);
      return false;
    }

    // 2. AI-based validation
    const promptTemplate = await this.promptManager.getPrompt(
      'query-validator'
    );

    const systemPrompt = this.promptManager.compilePrompt(promptTemplate, {
      user_request: naturalLanguageQuery,
      generated_query: JSON.stringify(generatedQuery, null, 2),
    });

    const validationResponse = await this.textProcessor.processText(
      'Based on the rules in the system prompt, is the query safe? Respond with a single word: SAFE or DESTRUCTIVE.', // A user message is required
      { systemPrompt: systemPrompt, temperature: 0.1, maxTokens: 10 }
    );


    const decision = validationResponse.content.trim().toUpperCase();
    this.logger.debug(`   Validator AI decision: ${decision}`);

    return decision === 'SAFE';
  }

  /**
   * Executes the structured query
   */
  private async executeQuery(query: GeneratedQuery): Promise<any> {
    const { startDate, endDate } = this.getDateRange(query.time_period);

    switch (query.query_type) {
      case 'rank_accounts_by_expense':
        return this.accountRepo.getAccountsRankedByExpenses({
          startDate,
          endDate,
          sort: query.sort_order || 'desc',
          limit: query.limit,
          includeArchived: query.include_archived,
        });

      case 'total_spending_by_category':
        return this.categoryRepo.getExpensesSummary(startDate, endDate);

      case 'count_archived_transactions':
        const count = await this.transactionRepo.countArchived();
        return { count };

      case 'count_remaining_installments':
        const installmentCount = await this.creditCardRepo.countRemainingInstallments(
          query.credit_card_account_id
        );
        return { count: installmentCount };

      case 'total_credit_card_debt':
        return this.creditCardRepo.getTotalDebt(query.credit_card_account_id);

      case 'rank_accounts_by_transaction_count':
        return this.accountRepo.getAccountsRankedByTransactionCount({
          startDate,
          endDate,
          sort: query.sort_order || 'desc',
          limit: query.limit,
          includeArchived: query.include_archived,
        });

      default:
        this.logger.error(`Unknown query type: ${query.query_type}`);
        throw new Error(`The query type "${query.query_type}" is not supported.`);
    }
  }

  /**
   * Formats the query results into a user-friendly string
   */
  private formatResponse(query: GeneratedQuery, results: any): string {
    let response = '';

    switch (query.query_type) {
      case 'rank_accounts_by_expense':
        if (!results || results.length === 0) {
          return "No expense data found for the specified period.";
        }
        response = 'Account Ranking by Expenses:\n\n';
        results.forEach((r: { account_name: string; total_expenses: number }, i: number) => {
          response += `${i + 1}. ${r.account_name}: ${new Intl.NumberFormat().format(r.total_expenses)}\n`;
        });
        break;

      case 'total_spending_by_category':
        if (!results || results.length === 0) {
          return "No spending data found for the specified period.";
        }
        response = 'Spending by Category:\n\n';
        results.forEach((r: { category_name: string; total_amount: number }, i: number) => {
          response += `• ${r.category_name}: ${new Intl.NumberFormat().format(r.total_amount)}\n`;
        });
        break;

      case 'count_archived_transactions':
        response = `You have ${results.count} archived transaction${results.count !== 1 ? 's' : ''}.`;
        break;

      case 'count_remaining_installments':
        response = `You have ${results.count} remaining installment${results.count !== 1 ? 's' : ''}.`;
        break;

      case 'total_credit_card_debt':
        if (!results || results.length === 0) {
          return "No credit card debt found.";
        }
        response = 'Credit Card Debt:\n\n';
        results.forEach((r: { credit_card_name: string; total_debt: number; currency: string }) => {
          response += `• ${r.credit_card_name}: ${new Intl.NumberFormat().format(r.total_debt)} ${r.currency}\n`;
        });
        break;

      case 'rank_accounts_by_transaction_count':
        if (!results || results.length === 0) {
          return "No transaction data found for the specified period.";
        }
        response = 'Account Ranking by Transaction Count:\n\n';
        results.forEach((r: { account_name: string; transaction_count: number }, i: number) => {
          response += `${i + 1}. ${r.account_name}: ${r.transaction_count} transaction${r.transaction_count !== 1 ? 's' : ''}\n`;
        });
        break;

      default:
        return "I was able to fetch the data, but I don't know how to display it for this query type.";
    }

    return response;
  }

  /**
   * Helper to get date range from time period string
   */
  private getDateRange(timePeriod: GeneratedQuery['time_period']) {
    const now = new Date();
    let startDate: Date;
    const endDate = new Date(now);

    switch (timePeriod) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'this_week':
        const dayOfWeek = now.getDay();
        startDate = new Date(now.setDate(now.getDate() - dayOfWeek));
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'this_year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'all_time':
      default:
        // A very old date to include all transactions
        startDate = new Date('1970-01-01');
        break;
    }

    return { startDate, endDate };
  }
}

// Singleton instance
let instance: AnalyticsService | null = null;

export function getAnalyticsService(): AnalyticsService {
  if (!instance) {
    instance = new AnalyticsService();
  }
  return instance;
}
