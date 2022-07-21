import fs from 'fs';

import { scrapeStation } from './scraper.js';

/**
 * Fetches an array of length k stations nearest to the coordinates
 *
 * @returns an array of stations
 */
export async function findKNearestStations(lat, lon, k, stations = undefined) {
  const s = stations
    ? stations
    : JSON.parse(fs.readFileSync('./data/respondingStations.json'));

  // Could speed this up by using divide and conquer on one point val
  // But considering the list of responding stations is small, meh...
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

/**
 * Fetches k arrays of measurements from the stations nearest to the coordinates
 *
 * @returns An object of k station: measurements[] pairs
 */
export async function findKNearestStationMeasurements(
  lat,
  lon,
  extra,
  k,
  stations = undefined
) {
  const s = await findKNearestStations(lat, lon, k, stations);

  const measurements = {};

  for (let i = 0; i < s.length; i += 1) {
    // False for 12h, true for 6d
    const m = await scrapeStation(s[i].id, extra);
    measurements[s[i].name] = m;
  }

  return measurements;
}
