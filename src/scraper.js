import puppeteer from 'puppeteer';

const GROUND_URL = 'https://en.vedur.is/weather/observations/areas/#station=';
const AIR_URL = 'https://vedur.is/vedur/flugvedur/vedurathuganir/';

/**
 * Scrapes the ground measurement table for the given station id
 *
 * @param stationId the station to scrape
 * @param olderThan12h whether 6 day measurements should be added
 * @returns an array of measurement objects
 */
export async function scrapeGroundStations(stationId, olderThan12h) {
  try {
    const browser = await puppeteer.launch({
      headless: true, // Can set to false to see what is being done
      args: ['--disable-setuid-sandbox'],
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    await page.goto(GROUND_URL + stationId); // Grab observations for station id
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

        const windSpeed = cols[2 + colOffset].innerText
          .replaceAll('m/s', '')
          .replace(/\s/g, '')
          .split('/');

        const windTable = {
          N: '0',
          NNE: '22.5',
          NE: '45',
          ENE: '67.5',
          E: '90',
          ESE: '112.5',
          SE: '135',
          SSE: '157.5',
          S: '180',
          SSW: '202.5',
          SW: '225',
          WSW: '247.5',
          W: '270',
          WNW: '292.5',
          NW: '315',
          NNW: '337.5',
        };

        const row = {
          time: `${currYear}-${dateString.substring(
            3,
            5
          )}-${dateString.substring(0, 2)}T${dateString.substring(5)}:00.000Z`,
          windAvg: windSpeed[0],
          windMax: windSpeed[1],
          windDir:
            windTable[
              cols[1 + colOffset]
                .querySelector('img')
                .title.toUpperCase()
                .split('-')
                .map((word) => word[0])
                .join('')
            ],
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

/**
 * Scrapes the air measurement table for the given station id
 *
 * @param stationId the station to scrape
 * @returns an array of measurement objects
 */
export async function scrapeAirStations(stationId) {
  try {
    const browser = await puppeteer.launch({
      headless: true, // Can set to false to see what is being done
      args: ['--disable-setuid-sandbox'],
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    await page.goto(AIR_URL + stationId);
    const data = await page.evaluate(() => {
      const rows = [];
      const items = document.querySelectorAll('tr');
      const currYear = new Date().getFullYear();
      items.forEach((item) => {
        const cols = item.querySelectorAll('td');

        // Not a data row
        if (!cols[0] || !cols[0].innerText.includes('kl.')) return;

        const dateString = cols[0].innerText.split(/(\s+)/);
        const d = dateString[2].split('.');

        const row = {
          time: `${currYear}-${d[1]}-${d[0]}T${dateString[6]}:00.000Z`,
          windAvg: (cols[2].innerText * 0.51444).toFixed(3), // Convert to m/s to be consistent with ground
          windMax: (cols[3].innerText * 0.51444).toFixed(3), // Convert to m/s to be consistent with ground
          windDir: cols[1].innerText.slice(0, -2),
        };

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
