import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { scrapeAirStations } from './scraper.js';

/**
 * Queries every station in stations to see if it responds with a table
 *
 * @returns an array containing every station object that responds
 */
async function getRespondingAirStations() {
  const jsonPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'data',
    'allStations.json'
  );

  const s = JSON.parse(fs.readFileSync(jsonPath));
  const responded = [];

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  let N = s.length;

  async function run() {
    for (let i = 0; i <= N; i += 1) {
      if (i < N) {
        await sleep(5000); // Try not to get IP banned...
        const m = await scrapeAirStations(s[i].id);
        console.log(m);

        if (m && m.length > 0) {
          responded.push(s[i]);
        }
      } else {
        return responded;
      }
    }
  }

  return await run();
}

/**
 * Query stations for all responding stations and write them to a json file
 */
export async function writeRespondingAirStations() {
  const responded = await getRespondingAirStations();

  if (responded.length > 0) {
    const jsonPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      'data',
      'respondingAirStations.json'
    );

    fs.writeFileSync(jsonPath, JSON.stringify(responded));
  }
}

await writeRespondingAirStations().catch((err) => {
  console.error(err.stack);
});
