import { findKNearestStationMeasurements } from './search.js';
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

async function respond() {
  if (process.env.npm_config_listen) {
    console.log('TODO!');
  } else {
    const args = process.argv.slice(2);

    if (!validateArgs(args)) {
      return;
    }

    if (args.length === 2) {
      console.log(
        await findKNearestStationMeasurements(args[0], args[1], false, 1)
      );

      return;
    }

    const age = Math.ceil(
      (new Date(args[2]).getTime() - new Date().getTime()) / (1000 * 3600 * 24)
    );

    if (args.length === 3) {
      console.log(
        await findKNearestStationMeasurements(args[0], args[1], age > 1, 1)
      );

      return;
    }

    console.log(
      await findKNearestStationMeasurements(args[0], args[1], age > 1, args[3])
    );

    return;
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
