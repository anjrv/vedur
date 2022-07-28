import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

import { scrapeAirStations } from './scraper.js';

/**
 * Writes the currently available air observations to the database
 */
async function storeAirObservations() {
  const sql = sqlite3.verbose();
  const dbPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'data',
    'observations.db'
  );

  const db = new sql.Database(dbPath);

  db.serialize(function () {
    db.run(`CREATE TABLE IF NOT EXISTS observations (
        station INTEGER,
        date INTEGER,
        wind_avg REAL,
        wind_max REAL,
        wind_dir INTEGER,
        PRIMARY KEY(station, date))`);
  });

  const jsonPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'data',
    'respondingAirStations.json'
  );

  const s = JSON.parse(fs.readFileSync(jsonPath));

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function insert(station, measurements) {
    const insertQuery = db.prepare(
      'INSERT OR IGNORE INTO observations VALUES (?,?,?,?,?)'
    );
    for (let j = 0; j < measurements.length; j += 1) {
      insertQuery.run(
        station,
        Date.parse(measurements[j].time),
        measurements[j].windAvg,
        measurements[j].windMax,
        measurements[j].windDir
      );
    }
    insertQuery.finalize();
  }

  let N = s.stations.length;

  async function run() {
    for (let i = 0; i <= N; i += 1) {
      if (i < N) {
        await sleep(5000); // Try not to get IP banned...
        const m = await scrapeAirStations(s.stations[i].id);

        if (m?.length > 0) {
          insert(s[i].id, m);
        }
      } else {
        return Promise.resolve(1);
      }
    }
  }

  await run();
  db.close();
}

await storeAirObservations().catch((err) => {
  console.error(err.stack);
});
