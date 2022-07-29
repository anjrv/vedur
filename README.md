# Weather observation scraper for `vedur.is`

## Install NodeJS:
```
https://nodejs.org/en/download/
```

## Set up dependencies (in project root):
```
npm install
```

## Format:

* `/data`, json files for stations
* `/data/db.js`, database functions and schedule job
* `/src/app.js`, main entry point and middleware filtering
* `/src/search.js`, search functions and helpers
* `/src/scraper.js`, web scraper functions
* `/src/generateStations.js`, helpers to regenerate responding stations

## Usage:

*Any of the following commands should be run in the context of the project root folder*

### To regenerate responding stations in case something has changed:

```
npm run generateAirStations

npm run generateGroundStations
```

### (DEPRECATED) To run a single query:

```
npm run search -- <args>
```

Mandatory arguments are:

* `latitude` Floating point number
* `longitude` Floating point number

Additional arguments:

* `date` Date string
* `stations` Integer

Arguments have to be supplied in the above order.

Examples:
```
npm run search -- 64.0212 -22.1503
```
```
npm run search -- 64.0212 -22.1503 2022/07/21
```
```
npm run search -- 64.0212 -22.1503 2022/07/21 2
```
