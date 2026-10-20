import {resolve,dirname} from 'node:path';
import {initializeAIBudget,InitialTestBudget} from '../server/aiBudget.ts';
const file=resolve(dirname(process.env.DATABASE_PATH||'data/cardchasm.sqlite'),'ai-initial-test-budget.sqlite');
initializeAIBudget(file);
console.log('One-time AI test ledger created. No provider request or credential access.');
console.log(new InitialTestBudget(file).status());
