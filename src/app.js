import puppeteer from 'puppeteer';
import fs from 'fs';

import { stations } from './stations.js';

const URL = 'https://en.vedur.is/weather/observations/areas/#station=';

async function scrapeStation(stationId, olderThan12h) {
  try {
    const browser = await puppeteer.launch({
      headless: true, // Can set to false to see what is being done
      args: ['--disable-setuid-sandbox'],
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    await page.goto(URL + stationId); // Grab observations for station id
    if (olderThan12h) await page.click('#stablink1'); // Click on 6 day history
    const data = await page.evaluate(() => {
      const rows = [];
      const items = document.querySelectorAll('tr');
      const currYear = new Date().getFullYear();
      items.forEach((item) => {
        const cols = item.querySelectorAll('td');

        // Not a data row
        if (!cols[0] || !cols[0].innerText.includes('GMT')) return;

        // The stupid cloud icon that is only sometimes there...
        const colOffset = cols.length > 6 ? 1 : 0;

        const dateString = cols[0].innerText
          .replace('\n', '')
          .split(/(\s+)/)[2];

        const date = `${currYear}-${dateString.substring(
          3,
          5
        )}-${dateString.substring(0, 2)}T${dateString.substring(5)}:00.000Z`;

        const windSpeed = cols[2 + colOffset].innerText
          .replaceAll('m/s', '')
          .replace(/\s/g, '')
          .split('/');

        const row = {
          time: date,
          windAvg: windSpeed[0],
          windMax: windSpeed[1],
          windDir: cols[1 + colOffset].querySelector('img').title,
        };

        // Unshift gives us time ascending ordering that we can use to search for timestamps
        rows.unshift(row);
      });

      return rows;
    });

    await browser.close();
    return data;
  } catch (err) {
    console.log('Error: ', err.stack);
  }
}

async function findKNearestStations(lat, lon, k) {
  const s = stations;

  function compareStation(a, b) {
    const aDist = Math.sqrt(
      Math.pow(lat - a.lat, 2) + Math.pow(lon - a.lon, 2)
    );
    const bDist = Math.sqrt(
      Math.pow(lat - b.lat, 2) + Math.pow(lon - b.lon, 2)
    );

    if (aDist < bDist) return -1;

    if (aDist > bDist) return 1;

    return 0;
  }

  s.sort(compareStation);

  const result = [];

  for (let i = 0; i < k; i += 1) {
    result.push(s[i]);
  }

  return result;
}

async function findKNearestMeasurements(lat, lon, k) {
  const s = await findKNearestStations(lat, lon, k);

  const measurements = {};

  for (let i = 0; i < s.length; i += 1) {
    // False for 12h, true for 6d
    const m = await scrapeStation(s[i].id, false);

    measurements[s[i].name] = m;
  }

  return measurements;
}

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

async function writeRespondingStations() {
  const responded = await getRespondingStations();

  if (responded.length > 0) {
    fs.writeFileSync('./respondingStations.json', JSON.stringify(responded));
  }
}

// await writeWorkingStations();
console.log(await findKNearestMeasurements(65.283, -14.4025, 1));
