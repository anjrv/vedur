import {
  findKNearestGroundStationMeasurements,
  findKNearestAirStationMeasurements,
} from './search.js';
import { isInt, validateNumber, validateDate } from './typechecking.js';

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

  if (args[3] && !isInt(args[3])) {
    console.log('Number of stations is invalid');
    return false;
  }

  return true;
}

async function search(lat, lon, date, k = undefined) {
  const ageDiff = new Date().getTime() - Date.parse(date);


}

async function respond() {
  if (process.env.npm_config_listen) {
    console.log('TODO!');
  } else {
    const args = process.argv.slice(2);

    if (!validateArgs(args)) {
      return;
    }

    if (args.length === 3) {
      await search(args[0], args[1], args[2]);
    }

    await search(args[0], args[1], args[2], args[3]);
  }
}

await respond().catch((err) => {
  // Should query this station, otherwise I fucked up
  // { id: 571, name: 'Egilsstaðaflugvöllur', lat: 65.283, lon: -14.4025 },
  // 65.283, -14.4025

  // Hvassahraun ish???
  // 64.021261 -22.1503
  console.error(err.stack);
});
