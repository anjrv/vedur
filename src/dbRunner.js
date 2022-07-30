import schedule from 'node-schedule';

import { storeAirObservations } from './db.js';

const JOB_ID = 'NODE_AIR_STATION_SCRAPER';

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === 'repeat') {
    schedule.scheduleJob(JOB_ID, '0 0 */4 * * *', async () => {
      await storeAirObservations();
    });
  } else {
    await storeAirObservations();
  }
}

await main().catch((err) => {
  console.error(err.stack);
});
