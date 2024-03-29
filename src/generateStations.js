import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { scrapeAirStations, scrapeGroundStations } from './scraper.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Queries every station in stations to see if it responds with a table
 *
 * @returns an array containing every station object that responds
 */
async function getRespondingGroundStations() {
  const jsonPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'data',
    'allStations.json'
  );

  const s = JSON.parse(fs.readFileSync(jsonPath));

  const stations = [];
  const bounds = { minLat: 1000, maxLat: -1000, minLon: 1000, maxLon: -1000 };

  let N = s.length;

  async function run() {
    for (let i = 0; i <= N; i += 1) {
      if (i < N) {
        await sleep(5000);
        const m = await scrapeGroundStations(s[i].id, false);
        console.log(m);

        if (m?.length > 0) {
          stations.push(s[i]);
          bounds.minLat = s[i].lat < bounds.minLat ? s[i].lat : bounds.minLat;
          bounds.maxLat = s[i].lat > bounds.maxLat ? s[i].lat : bounds.maxLat;
          bounds.minLon = s[i].lon < bounds.minLon ? s[i].lon : bounds.minLon;
          bounds.maxLon = s[i].lon > bounds.maxLon ? s[i].lon : bounds.maxLon;
        }
      } else {
        const responded = {};
        responded.stations = stations;
        responded.bounds = bounds;
        return responded;
      }
    }
  }

  return await run();
}

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

  const stations = [];
  const bounds = { minLat: 1000, maxLat: -1000, minLon: 1000, maxLon: -1000 };

  let N = s.length;

  async function run() {
    for (let i = 0; i <= N; i += 1) {
      if (i < N) {
        await sleep(5000);
        const m = await scrapeAirStations(s[i].id);
        console.log(m);

        if (m?.length > 0) {
          stations.push(s[i]);
          bounds.minLat = s[i].lat < bounds.minLat ? s[i].lat : bounds.minLat;
          bounds.maxLat = s[i].lat > bounds.maxLat ? s[i].lat : bounds.maxLat;
          bounds.minLon = s[i].lon < bounds.minLon ? s[i].lon : bounds.minLon;
          bounds.maxLon = s[i].lon > bounds.maxLon ? s[i].lon : bounds.maxLon;
        }
      } else {
        const responded = {};
        responded.stations = stations;
        responded.bounds = bounds;
        return responded;
      }
    }
  }

  return await run();
}

/**
 * Query stations for all responding stations and write them to a json file
 */
async function writeRespondingGroundStations() {
  const responded = await getRespondingGroundStations();

  if (responded?.stations.length > 0) {
    const jsonPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      'data',
      'respondingGroundStations.json'
    );

    fs.writeFileSync(jsonPath, JSON.stringify(responded));
  }
}

/**
 * Query stations for all responding stations and write them to a json file
 */
async function writeRespondingAirStations() {
  const responded = await getRespondingAirStations();

  if (responded?.stations.length > 0) {
    const jsonPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      'data',
      'respondingAirStations.json'
    );

    fs.writeFileSync(jsonPath, JSON.stringify(responded));
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === 'ground') {
    await writeRespondingGroundStations();
  } else {
    await writeRespondingAirStations();
  }
}

await main().catch((err) => {
  console.error(err.stack);
});
