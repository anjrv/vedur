const URL = 'https://en.vedur.is/weather/observations/areas/#station=';

import puppeteer from 'puppeteer';

/**
 * Scrapes the measurement table for the given station id
 *
 * @param stationId the station to scrape
 * @param olderThan12h whether 6 day measurements should be added
 * @returns an array of measurement objects
 */
export async function scrapeStation(stationId, olderThan12h) {
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
