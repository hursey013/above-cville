const Compass = require("cardinal-direction");
const convert = require("convert-units");
const fs = require("fs");
const a = require("indefinite");
const moment = require("moment");

const { abbreviations, actionPhrases, articles } = require("./config");
const operators = require("./storage/operators.json");
const types = require("./storage/aircrafts.json");

const addArticle = string => {
  // See if string matches any exceptions defined in the config
  for (const article of Object.keys(articles)) {
    if (
      articles[article].some(a =>
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
  return `${randomItem(actionPhrases)}${formatType(
    icao,
    type
  )}${formatIdentifier(call, icao, reg)}${formatOperator(
    call,
    snap
  )}${formatCount(snap)} is currently flying${formatAltitude(
    alt
  )} overhead${formatDirection(trak)}${formatSpeed(spd)}${formatHashTag(
    mil,
    snap
  )}${icao ? ` 📡https://globe.adsbexchange.com/?icao=${icao}` : ""}`;
};

const formatAltitude = alt => (alt ? ` ${numberWithCommas(alt)} ft` : "");

const formatCount = snap => {
  const count = snap.val() && Object.keys(snap.val().timestamps).length;

  return count
    ? `, seen ${
        count === 1 ? "once" : `${numberWithCommas(count)} times`
      } before,`
    : "";
};

const formatDirection = trak =>
  trak
    ? ` and heading ${Compass.cardinalFromDegree(
        trak,
        Compass.CardinalSubset.Ordinal
      )}`
    : "";

const formatHashTag = (mil, snap) => {
  const count = snap.val() && Object.keys(snap.val().timestamps).length;

  let hashtags = "";
  hashtags += mil === "1" ? ` #military` : "";
  hashtags += count && count >= 20 ? ` #frequentflyer` : "";

  return hashtags;
};

const formatIdentifier = (call, icao, reg) =>
  call || icao || reg ? ` (${call || reg || icao})` : "";

const formatOperator = (call, snap) => {
  const desc = snap.val() && snap.val().description;
  let value = "";

  if (desc) {
    value = desc;
  } else if (call) {
    // Use the first three letters of callsign as key
    const code = call.slice(0, 3);

    if (operators[code]) {
      value = operators[code].n;
    }
  }

  return value ? ` operated by ${sanitizeString(value)}` : "";
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
  (types[icao] &&
    types[icao].d &&
    ` ${addArticle(sanitizeString(types[icao].d))}`) ||
  (types[icao] && types[icao].t && ` ${addArticle(types[icao].t)}`) ||
  (type && ` ${addArticle(type)}`) ||
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
      // Check config for abbreviations that we want capitalized
      if (abbreviations.some(a => w.toLowerCase() === a.toLowerCase())) {
        return w.toUpperCase();
      }

      // Don't sentence case these words
      if (["of", "the"].some(s => w.toLowerCase() === s.toLowerCase())) {
        return w.toLowerCase();
      }

      // Don't sentence case words with numbers or symbols, otherwise go ahead
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
