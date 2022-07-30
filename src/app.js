import http from 'http';

import { lookUpAirMeasurements, lookUpGroundMeasurements } from './search.js';
import { validateNumber, validateDate } from './typechecking.js';
import { HOUR } from './utils.js';

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

async function search(lat, lon, date) {
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
    console.log(JSON.stringify(val));
  } else {
    console.log(JSON.stringify({}));
  }
}

async function respond() {
  const args = process.argv.slice(2);

  if (!validateArgs(args)) {
    return;
  }

  await search(args[0], args[1], args[2]);
}

await respond().catch((err) => {
  // Should query this station, otherwise I fucked up
  // { id: 571, name: 'Egilsstaðaflugvöllur', lat: 65.283, lon: -14.4025 },
  // 65.283, -14.4025

  // Hvassahraun ish???
  // 64.021261 -22.1503
  console.error(err.stack);
});
