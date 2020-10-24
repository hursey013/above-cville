const Compass = require("cardinal-direction");
const convert = require("convert-units");
const a = require("indefinite");
const moment = require("moment");

const config = require("./config.js");
const types = require("./storage/aircrafts.json");

const addArticle = string => a(string, { capitalize: true });

module.exports.createStatus = (
  snap,
  { alt, call, icao, reg, spd, trak, type }
) => {
  return `${module.exports.randomItem(
    config.actionPhrases
  )} ${module.exports.formatType(
    icao,
    type
  )} (${module.exports.formatIdentifier(call, icao, reg)})${formatCount(
    snap
  )} is currently flying ${formatAltitude(alt)}overhead${formatDirection(
    trak
  )}${formatSpeed(spd)}📡https://globe.adsbexchange.com/?icao=${icao}`;
};

const formatAltitude = alt => (alt ? `${numberWithCommas(alt)} ft ` : "");

const formatCount = snap => {
  const count = snap.val() && Object.keys(snap.val().timestamps).length;

  return count
    ? `, seen ${count === 1 ? "once" : `${count} times`} before,`
    : "";
};

const formatDirection = trak =>
  trak
    ? `, heading ${Compass.cardinalFromDegree(
        trak,
        Compass.CardinalSubset.Ordinal
      )} `
    : " ";

module.exports.formatIdentifier = (call, icao, reg) => call || reg || icao;

const formatSpeed = spd =>
  spd && Number(spd) !== 0
    ? `at ${Math.round(
        convert(Number(spd))
          .from("knot")
          .to("m/h")
      )} mph `
    : "";

module.exports.formatType = (icao, type) =>
  (types[icao] && types[icao].d && addArticle(types[icao].d)) ||
  (types[icao] && types[icao].t && addArticle(types[icao].t)) ||
  (type && addArticle(type)) ||
  "An aircraft";

module.exports.isNewState = (snap, cooldown) => {
  const timestamps = snap.val() && snap.val().timestamps;

  return (
    !snap.exists() ||
    moment(
      timestamps &&
        timestamps[Object.keys(timestamps)[Object.keys(timestamps).length - 1]]
    ).isBefore(moment().subtract(cooldown, "minutes"))
  );
};

const numberWithCommas = n =>
  n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

module.exports.randomItem = array =>
  array[Math.floor(Math.random() * array.length)];