import fs from 'fs';

import { stations } from './stations.js';

/**
 * Queries every station in stations to see if it responds with a table
 *
 * @returns an array containing every station object that responds
 */
async function getRespondingStations() {
  const s = stations;
  const responded = [];

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  let N = s.length;

  async function run() {
    for (let i = 0; i <= N; i += 1) {
      if (i < N) {
        await sleep(5000);
        const m = await scrapeStation(s[i].id, false);

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
export async function writeRespondingStations() {
  const responded = await getRespondingStations();

  if (responded.length > 0) {
    fs.writeFileSync('./respondingStations.json', JSON.stringify(responded));
  }
}

