import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { runQuery } from './db.js';
import { scrapeGroundStations, scrapeAirStations } from './scraper.js';
import {
  HOUR,
  inTriangle,
  baryCentricWeights,
  roundToNearestMinute,
} from './utils.js';

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
        measurements.push(await scrapeAirStations(surroundingStations[i].id));
      }
    } else {
      for (let i = 0; i < surroundingStations.length; i += 1) {
        measurements.push([await runQuery(s[i].id, matchTime)]);
      }
    }
  } else {
    if (fresh) {
      measurements.push(
        Object.values(
          await findKNearestAirStationMeasurements(lat, lon, 1, s)
        )[0]
      );
    } else {
      measurements.push([await runQuery(s[0].id, matchTime)]);
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

    return { method: 'interpolation', windAvg, windMax, windDir };
  } else if (nearestTimeMeasurements.length === 1) {
    return {
      method: 'nearest',
      windAvg: nearestTimeMeasurements[0].windAvg,
      windMax: nearestTimeMeasurements[1].windMax,
      windDir: nearestTimeMeasurements[2].windDir,
    };
  }

  return {};
}

// Test call
console.log(
  await lookUpAirMeasurements(64.0212, -22.1503, '2022-07-30T11:30:00.000Z')
);
