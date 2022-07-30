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

function findSurroundingStationsOrNearest(lat, lon, blacklist, stations) {
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
    if (blacklist.includes(stations[i].id)) continue;
    for (let j = i + 1; j < stations.length - 1; j += 1) {
      if (blacklist.includes(stations[j].id)) continue;
      for (let k = j + 1; k < stations.length; k += 1) {
        if (blacklist.includes(stations[k].id)) continue;
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
            {
              id: stations[i].id,
              lat: stations[i].lat,
              lon: stations[i].lon,
            },
            {
              id: stations[j].id,
              lat: stations[j].lat,
              lon: stations[j].lon,
            },
            {
              id: stations[k].id,
              lat: stations[k].lat,
              lon: stations[k].lon,
            },
          ];
      }
    }
  }

  // Fallback single nearest station
  return [{ id: stations[0].id, lat: stations[0].lat, lon: stations[0].lon }];
}

function findSurroundingAirStationsOrNearest(
  lat,
  lon,
  blacklist = [],
  stations = undefined
) {
  const jsonPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'data',
    'respondingAirStations.json'
  );

  const s = stations
    ? stations
    : JSON.parse(fs.readFileSync(jsonPath)).stations;

  return findSurroundingStationsOrNearest(lat, lon, blacklist, s);
}

function findSurroundingGroundStationsOrNearest(
  lat,
  lon,
  blacklist = [],
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

  return findSurroundingStationsOrNearest(lat, lon, blacklist, s);
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
  const blacklist = [];
  let weights = null;

  if (
    lat >= b.minLat &&
    lat <= b.maxLat &&
    lon >= b.minLon &&
    lon <= b.maxLon
  ) {
    for (let i = 0; i < 3; i += 1) {
      // Try three cycles, blacklist non responsive stations
      const surroundingStations = findSurroundingAirStationsOrNearest(
        lat,
        lon,
        blacklist,
        s
      );

      if (fresh) {
        for (let i = 0; i < surroundingStations.length; i += 1) {
          measurements.push(await scrapeAirStations(surroundingStations[i].id));
        }
      } else {
        for (let i = 0; i < surroundingStations.length; i += 1) {
          measurements.push([
            await runQuery(surroundingStations[i].id, matchTime),
          ]);
        }
      }

      // Cannot find a triangle, resort to nearest
      if (surroundingStations.length === 1) break;

      if (
        measurements.length === 3 &&
        measurements[0].length > 0 &&
        measurements[1].length > 0 &&
        measurements[2].length > 0
      ) {
        weights = baryCentricWeights(
          [lat, lon],
          [
            [surroundingStations[0].lat, surroundingStations[0].lon],
            [surroundingStations[1].lat, surroundingStations[1].lon],
            [surroundingStations[2].lat, surroundingStations[2].lon],
          ]
        );

        break;
      } else {
        if (measurements[0].length === 0)
          blacklist.push(surroundingStations[0].id);
        if (measurements[1].length === 0)
          blacklist.push(surroundingStations[1].id);
        if (measurements[2].length === 0)
          blacklist.push(surroundingStations[2].id);
      }
    }
  } else {
    if (fresh) {
      const vals = Object.values(
        await findKNearestAirStationMeasurements(lat, lon, 3, s)
      );

      measurements.push(
        vals[0].length > 0
          ? vals[0]
          : vals[1].length > 0
          ? vals[1]
          : vals[2].length > 0
          ? vals[2]
          : []
      );
    } else {
      for (let i = 0; i < 3; i += 1) {
        const m = await runQuery(s[i].id, matchTime);
        if (m.length > 0) {
          measurements.push(m);
          break;
        }
      }
    }
  }

  // Did not find anything, exit early
  if (measurements.length === 0) return {};

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

    const winds = [
      nearestTimeMeasurements[0].windDir,
      nearestTimeMeasurements[1].windDir,
      nearestTimeMeasurements[2].windDir,
    ];

    // Correct for crossing 0 e.g. interpolating between 2 degrees and 358 degrees
    if (Math.max(...winds) - Math.min(...winds) > 320) {
      for (let i = 0; i < winds.length; winds += 1) {
        if (winds[i] > 320) winds[i] -= 360;
      }
    }

    let windDir =
      winds[0] * weights[0] + winds[1] * weights[1] + winds[2] * weights[2];

    if (windDir < 0) windDir += 360;

    return { method: 'interpolation', windAvg, windMax, windDir };
  } else if (nearestTimeMeasurements.length > 0) {
    return {
      method: 'nearest',
      windAvg: nearestTimeMeasurements[0].windAvg,
      windMax: nearestTimeMeasurements[0].windMax,
      windDir: nearestTimeMeasurements[0].windDir,
    };
  }

  return {};
}

export async function lookUpGroundMeasurements(
  lat,
  lon,
  date,
  stations = undefined,
  bounds = undefined
) {
  const now = new Date().getTime();
  const dateMs = Date.parse(date);

  // Won't be able to scrape
  if (now - dateMs > HOUR * 24 * 6) return {};

  const jsonPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'data',
    'respondingGroundStations.json'
  );

  let s = stations;
  let b = bounds;

  if (!s || !b) {
    const stationData = JSON.parse(fs.readFileSync(jsonPath));
    s = stationData.stations;
    b = stationData.bounds;
  }

  const stale = now - dateMs > HOUR * 12;

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

  const matchTime = Date.parse(roundToNearestMinute(date, 60));
  const measurements = [];
  const blacklist = [];
  let weights = null;

  if (
    lat >= b.minLat &&
    lat <= b.maxLat &&
    lon >= b.minLon &&
    lon <= b.maxLon
  ) {
    for (let i = 0; i < 3; i += 1) {
      // Try three cycles, blacklist non responsive stations
      const surroundingStations = findSurroundingGroundStationsOrNearest(
        lat,
        lon,
        blacklist,
        s
      );

      for (let i = 0; i < surroundingStations.length; i += 1) {
        measurements.push(
          await scrapeGroundStations(surroundingStations[i].id, stale)
        );
      }

      // Cannot find a triangle, resort to nearest
      if (surroundingStations.length === 1) break;

      if (
        measurements.length === 3 &&
        measurements[0].length > 0 &&
        measurements[1].length > 0 &&
        measurements[2].length > 0
      ) {
        weights = baryCentricWeights(
          [lat, lon],
          [
            [surroundingStations[0].lat, surroundingStations[0].lon],
            [surroundingStations[1].lat, surroundingStations[1].lon],
            [surroundingStations[2].lat, surroundingStations[2].lon],
          ]
        );

        break;
      } else {
        if (measurements[0].length === 0)
          blacklist.push(surroundingStations[0].id);
        if (measurements[1].length === 0)
          blacklist.push(surroundingStations[1].id);
        if (measurements[2].length === 0)
          blacklist.push(surroundingStations[2].id);
      }
    }
  } else {
    const vals = Object.values(
      await findKNearestGroundStationMeasurements(lat, lon, 3, s)
    );

    measurements.push(
      vals[0].length > 0
        ? vals[0]
        : vals[1].length > 0
        ? vals[1]
        : vals[2].length > 0
        ? vals[2]
        : []
    );
  }

  // Did not find anything, exit early
  if (measurements.length === 0) return {};

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

    const winds = [
      nearestTimeMeasurements[0].windDir,
      nearestTimeMeasurements[1].windDir,
      nearestTimeMeasurements[2].windDir,
    ];

    // Correct for crossing 0 e.g. interpolating between 2 degrees and 358 degrees
    if (Math.max(...winds) - Math.min(...winds) > 320) {
      for (let i = 0; i < winds.length; winds += 1) {
        if (winds[i] > 320) winds[i] -= 360;
      }
    }

    let windDir =
      winds[0] * weights[0] + winds[1] * weights[1] + winds[2] * weights[2];

    if (windDir < 0) windDir += 360;

    return { method: 'interpolation', windAvg, windMax, windDir };
  } else if (nearestTimeMeasurements.length > 0) {
    return {
      method: 'nearest',
      windAvg: nearestTimeMeasurements[0].windAvg,
      windMax: nearestTimeMeasurements[0].windMax,
      windDir: nearestTimeMeasurements[0].windDir,
    };
  }

  return {};
}
