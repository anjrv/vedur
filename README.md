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

* `/data`, json files that contain an array of stations
* `/src/scraper.js`, implementation for the web scraper
* `/src/stations.js`, json array of stations that respond
* `/src/utils.js`, helper functions
* `/src/app.js`, main entry point and middleware filtering

## Usage:

*Any of the following commands should be run in the context of the project root folder*

### To regenerate responding stations in case something has changed:

```
npm run stations
```

### To run a single query:

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

## TODO:

* Provide a command line stdIn listener variant
* Provide a middleware function to get nearest neighbor by date
* Provide a middleware function to interpolate from 3 surrounding stations
