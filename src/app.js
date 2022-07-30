import { respond } from './search.js';

await respond().catch((err) => {
  // Hvassahraun ish???
  // 64.021261 -22.1503
  console.error(err.stack);
});
