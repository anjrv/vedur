import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from 'url';

import { HOUR } from './utils.js';
import { scrapeAirStations } from './scraper.js';
import { isInt, validateDate } from './typechecking.js';

const dbPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'data',
  'observations.db'
);

export async function runQuery(station, date) {
  let results = {};
  const d = isInt(date) ? date : validateDate(date) ? Date.parse(date) : null;
  const s = isInt(station) ? station : null;

  if (!d || !s || !fs.existsSync(dbPath)) return results;

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  const row = await db.get(
    'SELECT wind_avg, wind_max, wind_dir FROM observations WHERE station = ? AND date = ?',
    [s, d]
  );

  row?.wind_avg && (results.windAvg = row.wind_avg);
  row?.wind_max && (results.windMax = row.wind_max);
  row?.wind_dir && (results.windDir = row.wind_dir);

  if (Object.keys(results).length > 0) {
    results.time = new Date(date).toISOString();
  }

  db.close();
  return results;
}

/**
 * Writes the currently available air observations to the database
 */
export async function storeAirObservations() {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  db.getDatabaseInstance().serialize(function () {
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

  const s = JSON.parse(fs.readFileSync(jsonPath)).stations;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function insert(station, measurements) {
    const insertQuery = await db.prepare(
      'INSERT OR IGNORE INTO observations VALUES (?,?,?,?,?)'
    );

    for (let j = 0; j < measurements.length; j += 1) {
      await insertQuery.run(
        station,
        Date.parse(measurements[j].time),
        measurements[j].windAvg,
        measurements[j].windMax,
        measurements[j].windDir
      );
    }

    await insertQuery.finalize();
  }

  async function clearOlds() {
    const oldest = new Date().getTime() - HOUR * 24 * 14;

    const deleteQuery = await db.prepare(
      'DELETE FROM observations WHERE date < ?'
    );

    await deleteQuery.run(oldest);
    await deleteQuery.finalize();
  }

  let N = s.length;

  async function run() {
    for (let i = 0; i <= N; i += 1) {
      if (i < N) {
        await sleep(1000); // Try not to get IP banned...
        const m = await scrapeAirStations(s[i].id);

        if (m?.length > 0) {
          console.log(m);
          await insert(s[i].id, m);
        }
      } else {
        return Promise.resolve(1);
      }
    }
  }

  await clearOlds();
  await run();
  db.close();
}
