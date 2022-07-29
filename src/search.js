import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { scrapeGroundStations, scrapeAirStations } from './scraper.js';

const MINUTE = 60000;
const HOUR = 3600000;

function roundToNearestMinute(date, minutes) {
  const ms = MINUTE * minutes;

  return new Date(Math.round(Date.parse(date) / ms) * ms);
}

function inTriangle(point, triangle) {
  const cx = point[0],
    cy = point[1],
    t0 = triangle[0],
    t1 = triangle[1],
    t2 = triangle[2],
    v0x = t2[0] - t0[0],
    v0y = t2[1] - t0[1],
    v1x = t1[0] - t0[0],
    v1y = t1[1] - t0[1],
    v2x = cx - t0[0],
    v2y = cy - t0[1],
    dot00 = v0x * v0x + v0y * v0y,
    dot01 = v0x * v1x + v0y * v1y,
    dot02 = v0x * v2x + v0y * v2y,
    dot11 = v1x * v1x + v1y * v1y,
    dot12 = v1x * v2x + v1y * v2y;

  const b = dot00 * dot11 - dot01 * dot01,
    inv = b === 0 ? 0 : 1 / b,
    u = (dot11 * dot02 - dot01 * dot12) * inv,
    v = (dot00 * dot12 - dot01 * dot02) * inv;

  return u >= 0 && v >= 0 && u + v < 1;
}

function baryCentricWeights(point, triangle) {
  // https://codeplea.com/triangular-interpolation
  const cx = point[0],
    cy = point[1],
    t0 = triangle[0],
    t1 = triangle[1],
    t2 = triangle[2];

  const w1 =
    ((t1[1] - t2[1]) * (cx - t2[0]) + (t2[0] - t1[0]) * (cy - t2[1])) /
    ((t1[1] - t2[1]) * (t0[0] - t2[0]) + (t2[0] - t1[0]) * (t0[1] - t2[1]));

  const w2 =
    ((t2[1] - t0[1]) * (cx - t2[0]) + (t0[0] - t2[0]) * (cy - t2[1])) /
    ((t1[1] - t2[1]) * (t0[0] - t2[0]) + (t2[0] - t1[0]) * (t0[1] - t2[1]));

  const w3 = 1 - w1 - w2;

  return [w1, w2, w3];
}

function findSurroundingStationsOrNearest(lat, lon, stations) {
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

  stations.sort(compareStation);

  for (let i = 0; i < stations.length - 2; i += 1) {
    for (let j = i + 1; j < stations.length - 1; j += 1) {
      for (let k = j + 1; k < stations.length; k += 1) {
        if (
          inTriangle(
            [lat, lon],
            [
              [stations[i].lat, stations[i].lon],
              [stations[j].lat, stations[j].lon],
              [stations[k].lat, stations[k].lon],
            ]
          )
        )
          return [
            { id: stations[i].id, lat: stations[i].lat, lon: stations[i].lon },
            { id: stations[j].id, lat: stations[j].lat, lon: stations[j].lon },
            { id: stations[k].id, lat: stations[k].lat, lon: stations[k].lon },
          ];
      }
    }
  }

  // Fallback single nearest station
  return [{ id: stations[0].id, lat: stations[0].lat, lon: stations[0].lon }];
}

function findSurroundingAirStationsOrNearest(lat, lon, stations = undefined) {
  const jsonPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'data',
    'respondingAirStations.json'
  );

  const s = stations
    ? stations
    : JSON.parse(fs.readFileSync(jsonPath)).stations;

  return findSurroundingStationsOrNearest(lat, lon, s);
}

function findSurroundingGroundStationsOrNearest(
  lat,
  lon,
  stations = undefined
) {
  const jsonPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'data',
    'respondingGroundStations.json'
  );

  const s = stations
    ? stations
    : JSON.parse(fs.readFileSync(jsonPath)).stations;

  return findSurroundingStationsOrNearest(lat, lon, s);
}

function findKNearestStations(lat, lon, k, stations) {
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

  stations.sort(compareStation);

  const result = [];

  for (let i = 0; i < k; i += 1) {
    result.push(stations[i]);
  }

  return result;
}

/**
 * Fetches an array of length k ground stations nearest to the coordinates
 *
 * @returns an array of stations
 */
export function findKNearestGroundStations(lat, lon, k, stations = undefined) {
  const jsonPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'data',
    'respondingGroundStations.json'
  );

  const s = stations
    ? stations
    : JSON.parse(fs.readFileSync(jsonPath)).stations;

  return findKNearestStations(lat, lon, k, s);
}

/**
 * Fetches an array of length k air stations nearest to the coordinates
 *
 * @returns an array of stations
 */
export function findKNearestAirStations(lat, lon, k, stations = undefined) {
  const jsonPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'data',
    'respondingAirStations.json'
  );

  const s = stations
    ? stations
    : JSON.parse(fs.readFileSync(jsonPath)).stations;

  return findKNearestStations(lat, lon, k, s);
}

/**
 * Fetches k arrays of measurements from the stations nearest to the coordinates
 *
 * @returns An object of k station: measurements[] pairs
 */
export async function findKNearestAirStationMeasurements(
  lat,
  lon,
  k,
  stations = undefined
) {
  const s = findKNearestAirStations(lat, lon, k, stations);

  const measurements = {};

  for (let i = 0; i < s.length; i += 1) {
    // False for 12h, true for 6d
    const m = await scrapeAirStations(s[i].id);
    measurements[s[i].name] = m;
  }

  return measurements;
}

/**
 * Fetches k arrays of measurements from the stations nearest to the coordinates
 *
 * @returns An object of k station: measurements[] pairs
 */
export async function findKNearestGroundStationMeasurements(
  lat,
  lon,
  extra,
  k,
  stations = undefined
) {
  const s = findKNearestGroundStations(lat, lon, k, stations);

  const measurements = {};

  for (let i = 0; i < s.length; i += 1) {
    // False for 12h, true for 6d
    const m = await scrapeGroundStations(s[i].id, extra);
    measurements[s[i].name] = m;
  }

  return measurements;
}

export async function lookUpAirMeasurements(
  lat,
  lon,
  date,
  stations = undefined,
  bounds = undefined
) {
  const jsonPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'data',
    'respondingAirStations.json'
  );

  let s = stations;
  let b = bounds;

  if (!s || !b) {
    const stationData = JSON.parse(fs.readFileSync(jsonPath));
    s = stationData.stations;
    b = stationData.bounds;
  }

  const now = new Date().getTime();
  const dateMs = Date.parse(date);
  const fresh = now - dateMs < HOUR * 4;
  const matchTime = Date.parse(roundToNearestMinute(date, 10));
  const measurements = [];
  let weights = null;

  if (
    lat >= b.minLat &&
    lat <= b.maxLat &&
    lon >= b.minLon &&
    lon <= b.maxLon
  ) {
    const surroundingStations = findSurroundingAirStationsOrNearest(
      lat,
      lon,
      s
    );

    if (surroundingStations.length === 3) {
      weights = baryCentricWeights(
        [lat, lon],
        [
          [surroundingStations[0].lat, surroundingStations[0].lon],
          [surroundingStations[1].lat, surroundingStations[1].lon],
          [surroundingStations[2].lat, surroundingStations[2].lon],
        ]
      );
    }

    if (fresh) {
      for (let i = 0; i < surroundingStations.length; i += 1) {
        const m = await scrapeAirStations(surroundingStations[i].id);
        measurements.push(m);
      }
    } else {
      console.log('db lookup');
    }
  } else {
    if (fresh) {
      measurements.push(
        Object.values(
          await findKNearestAirStationMeasurements(lat, lon, 1, s)
        )[0]
      );
    } else {
      console.log('db lookup');
    }
  }

  const nearestTimeMeasurements = [];

  for (let i = 0; i < measurements.length; i += 1) {
    for (let j = 0; j < measurements[i].length; j += 1) {
      if (Date.parse(measurements[i][j].time) === matchTime) {
        nearestTimeMeasurements.push(measurements[i][j]);
      }
    }
  }

  if (nearestTimeMeasurements.length === 3) {
    const windAvg =
      nearestTimeMeasurements[0].windAvg * weights[0] +
      nearestTimeMeasurements[1].windAvg * weights[1] +
      nearestTimeMeasurements[2].windAvg * weights[2];

    const windMax =
      nearestTimeMeasurements[0].windMax * weights[0] +
      nearestTimeMeasurements[1].windMax * weights[1] +
      nearestTimeMeasurements[2].windMax * weights[2];

    // TODO: This doesn't work for near north degrees e.g. 358~2
    const windDir =
      nearestTimeMeasurements[0].windDir * weights[0] +
      nearestTimeMeasurements[1].windDir * weights[1] +
      nearestTimeMeasurements[2].windDir * weights[2];

    return [windAvg, windMax, windDir];
  }

  return [
    nearestTimeMeasurements[0].windAvg,
    nearestTimeMeasurements[1].windMax,
    nearestTimeMeasurements[2].windDir,
  ];
}

// Test call
console.log(
  await lookUpAirMeasurements(64.0212, -22.1503, '2022-07-29T18:29:00.000Z')
);
