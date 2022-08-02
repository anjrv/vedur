import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { runQuery } from './db.js';
import { scrapeGroundStations, scrapeAirStations } from './scraper.js';
import { validateNumber, validateDate } from './typechecking.js';
import {
  HOUR,
  inTriangle,
  baryCentricWeights,
  roundToNearestMinute,
} from './utils.js';

function getStationInfo(stationId, stations) {
  for (let i = 0; i < stations.length; i += 1) {
    if (stations[i].id === stationId) {
      return stations[i];
    }
  }
}

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
function findKNearestGroundStations(lat, lon, k, stations = undefined) {
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
function findKNearestAirStations(lat, lon, k, stations = undefined) {
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
async function findKNearestAirStationMeasurements(
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
async function findKNearestGroundStationMeasurements(
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

async function lookUpAirMeasurements(
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
  const chosenStations = [];
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
      const surroundingStations = findSurroundingAirStationsOrNearest(
        lat,
        lon,
        blacklist,
        s
      );

      const responded = new Array(surroundingStations.length).fill(false);

      for (let j = 0; j < surroundingStations.length; j += 1) {
        const m = await runQuery(surroundingStations[j].id, matchTime);

        if (Object.entries(m).length !== 0) {
          responded[j] = true;
          measurements.push([m]);
        }
      }

      if (measurements.length !== surroundingStations.length && fresh) {
        for (let j = 0; j < surroundingStations.length; j += 1) {
          const m = await scrapeAirStations(surroundingStations[j].id);

          if (m?.length > 0) {
            responded[j] = true;
            measurements.push(m);
          }
        }
      }

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
      } else {
        for (let j = 0; j < surroundingStations.length; j += 1) {
          if (!responded[j]) {
            blacklist.push(surroundingStations[j].id);
          }
        }
      }

      if (weights || surroundingStations.length === measurements.length) {
        for (let j = 0; j < surroundingStations.length; j += 1) {
          chosenStations.push(getStationInfo(surroundingStations[j].id, s));
        }
        break;
      }
    }
  } else {
    for (let i = 0; i < 3; i += 1) {
      const m = await runQuery(s[i].id, matchTime);
      if (m?.length > 0) {
        measurements.push(m);
        chosenStations.push(s[i]);
        break;
      }
    }

    if (measurements.length === 0 && fresh) {
      const vals = Object.values(
        await findKNearestAirStationMeasurements(lat, lon, 3, s)
      );

      if (vals[0].length > 0) {
        measurements.push(vals[0]);
        chosenStations.push(s[0]);
      } else if (vals[1].length > 0) {
        measurements.push(vals[1]);
        chosenStations.push(s[1]);
      } else if (vals[2].length > 0) {
        measurements.push(vals[2]);
        chosenStations.push(s[2]);
      } else {
        measurements.push([]);
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
      for (let i = 0; i < winds.length; i += 1) {
        if (winds[i] > 320) winds[i] -= 360;
      }
    }

    let windDir =
      winds[0] * weights[0] + winds[1] * weights[1] + winds[2] * weights[2];

    if (windDir < 0) windDir += 360;

    return {
      stations: chosenStations,
      method: 'interpolation',
      windAvg,
      windMax,
      windDir,
    };
  } else if (nearestTimeMeasurements.length > 0) {
    return {
      stations: chosenStations,
      method: 'nearest',
      windAvg: nearestTimeMeasurements[0].windAvg,
      windMax: nearestTimeMeasurements[0].windMax,
      windDir: nearestTimeMeasurements[0].windDir,
    };
  }

  return {};
}

async function lookUpGroundMeasurements(
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
  const chosenStations = [];
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

      const responded = new Array(surroundingStations.length).fill(false);

      for (let j = 0; j < surroundingStations.length; j += 1) {
        const m = await scrapeGroundStations(surroundingStations[j].id, stale);

        if (m?.length > 0) {
          responded[j] = true;
          measurements.push(m);
        }
      }

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
      } else {
        for (let j = 0; j < surroundingStations.length; j += 1) {
          if (!responded[j]) {
            blacklist.push(surroundingStations[j].id);
          }
        }
      }

      if (weights || surroundingStations.length === measurements.length) {
        for (let j = 0; j < surroundingStations.length; j += 1) {
          chosenStations.push(getStationInfo(surroundingStations[j].id, s));
        }
        break;
      }
    }
  } else {
    const vals = Object.values(
      await findKNearestGroundStationMeasurements(lat, lon, stale, 3, s)
    );

    if (vals[0].length > 0) {
      measurements.push(vals[0]);
      chosenStations.push(s[0]);
    } else if (vals[1].length > 0) {
      measurements.push(vals[1]);
      chosenStations.push(s[1]);
    } else if (vals[2].length > 0) {
      measurements.push(vals[2]);
      chosenStations.push(s[2]);
    } else {
      measurements.push([]);
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

  // Likely landed on a station that returns every 3 hours
  if (nearestTimeMeasurements.length === 0) {
    const matchTimeAlt = Date.parse(roundToNearestMinute(date, 180));

    for (let i = 0; i < measurements.length; i += 1) {
      for (let j = 0; j < measurements[i].length; j += 1) {
        if (Date.parse(measurements[i][j].time) === matchTimeAlt) {
          nearestTimeMeasurements.push(measurements[i][j]);
        }
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
      for (let i = 0; i < winds.length; i += 1) {
        if (winds[i] > 320) winds[i] -= 360;
      }
    }

    let windDir =
      winds[0] * weights[0] + winds[1] * weights[1] + winds[2] * weights[2];

    if (windDir < 0) windDir += 360;

    return {
      stations: chosenStations,
      method: 'interpolation',
      windAvg,
      windMax,
      windDir,
    };
  } else if (nearestTimeMeasurements.length > 0) {
    return {
      stations: chosenStations,
      method: 'nearest',
      windAvg: nearestTimeMeasurements[0].windAvg,
      windMax: nearestTimeMeasurements[0].windMax,
      windDir: nearestTimeMeasurements[0].windDir,
    };
  }

  return {};
}

function validateArgs(args) {
  if (args.length < 2 || args.length > 4) {
    console.log('Invalid number of arguments');
    return false;
  }

  if (!validateNumber(Number(args[0]))) {
    console.log('Latitude is invalid');
    return false;
  }

  if (!validateNumber(Number(args[1]))) {
    console.log('Longitude is invalid');
    return false;
  }

  if (args[2] && !validateDate(args[2])) {
    console.log('Date is invalid');
    return false;
  }

  return true;
}

export async function search(lat, lon, date) {
  const ageDiff = new Date().getTime() - Date.parse(date);

  let val = await lookUpAirMeasurements(lat, lon, date);

  if (Object.values(val).length > 0) {
    val.source = 'air';
  }

  if (Object.values(val).length === 0 && ageDiff < HOUR * 24 * 6) {
    val = await lookUpGroundMeasurements(lat, lon, date);

    if (Object.values.length > 0) {
      val.source = 'ground';
    }
  }

  if (Object.values(val).length > 0) {
    return val;
  } else {
    return {};
  }
}

export async function respond() {
  const args = process.argv.slice(2);

  if (!validateArgs(args)) {
    return;
  }

  console.log(JSON.stringify(await search(args[0], args[1], args[2])));
}
