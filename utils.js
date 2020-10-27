const Compass = require("cardinal-direction");
const convert = require("convert-units");
const fs = require("fs");
const a = require("indefinite");
const moment = require("moment");

const config = require("./config");
const operators = require("./storage/operators.json");
const types = require("./storage/aircrafts.json");

const addArticle = string => {
  for (const article of Object.keys(config.articles)) {
    if (
      config.articles[article].some(a =>
        string.toLowerCase().includes(a.toLowerCase())
      )
    ) {
      return `${article} ${string}`;
    }
  }

  return a(string, { capitalize: true });
};

const createStatus = (
  snap,
  { alt, call, icao, mil, reg, spd, trak, type },
  link
) => {
  return `${randomItem(config.actionPhrases)}${formatType(
    icao,
    type
  )}${formatIdentifier(call, icao, reg)}${formatOperator(call)}${formatCount(
    snap
  )} is currently flying${formatAltitude(alt)} overhead${formatDirection(
    trak
  )}${formatSpeed(spd)}${formatHashTag(mil)}${
    icao ? ` 📡https://globe.adsbexchange.com/?icao=${icao}` : ""
  }${link ? ` 📷${link}` : ""}`;
};

const formatAltitude = alt => (alt ? ` ${numberWithCommas(alt)} ft` : "");

const formatCount = snap => {
  const count = snap.val() && Object.keys(snap.val().timestamps).length;

  return count
    ? `, seen ${count === 1 ? "once" : `${count} times`} before,`
    : "";
};

const formatDirection = trak =>
  trak
    ? ` and heading ${Compass.cardinalFromDegree(
        trak,
        Compass.CardinalSubset.Ordinal
      )}`
    : "";

const formatHashTag = mil => (mil === "1" ? ` #military` : "");

const formatIdentifier = (call, icao, reg) =>
  call || icao || reg ? ` (${call || reg || icao})` : "";

const formatOperator = call => {
  if (call && operators) {
    const code = call.slice(0, 3);
    return operators[code]
      ? ` operated by ${sanitizeString(operators[code].n)}`
      : "";
  }
  return "";
};

const formatSpeed = spd =>
  spd && Number(spd) !== 0
    ? ` at ${Math.round(
        convert(Number(spd))
          .from("knot")
          .to("m/h")
      )} mph`
    : "";

const formatType = (icao, type) =>
  (types &&
    ((types[icao] &&
      types[icao].d &&
      ` ${addArticle(sanitizeString(types[icao].d))}`) ||
      (types[icao] && types[icao].t && ` ${addArticle(types[icao].t)}`) ||
      (type && ` ${addArticle(type)}`))) ||
  " An aircraft";

const isNewState = (snap, cooldown) => {
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

const randomItem = array => array[Math.floor(Math.random() * array.length)];

const sanitizeString = string =>
  string
    .split(" ")
    .map(w => {
      if (config.abbreviations.some(a => w.toLowerCase() === a.toLowerCase())) {
        return w.toUpperCase();
      }

      if (["of", "the"].some(s => w.toLowerCase() === s.toLowerCase())) {
        return w.toLowerCase();
      }

      return !/\d|[.-]/.test(w)
        ? w[0].toUpperCase() + w.substr(1).toLowerCase()
        : w;
    })
    .join(" ");

module.exports = {
  addArticle,
  createStatus,
  formatAltitude,
  formatCount,
  formatDirection,
  formatHashTag,
  formatIdentifier,
  formatOperator,
  formatSpeed,
  formatType,
  isNewState,
  numberWithCommas,
  randomItem,
  sanitizeString
};
