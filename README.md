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

## Running:

Once dependencies have been installed the main entry point file can be run with `npm start` in the project root. Currently this runs predefined requests defined at the bottom of `/src/app.js`, these requests can be changed there.

## TODO:

* Provide command line arguments for querying
* Provide a middleware function to get nearest neighbor by date
* Provide a middleware function to interpolate from 3 surrounding stations
* Provide an npm script to update responding stations
