const Compass = require("cardinal-direction");
const convert = require("convert-units");
const fs = require("fs");
const a = require("indefinite");
const moment = require("moment");

const {
  abbreviations,
  actionPhrases,
  articles,
  minimumAlt,
  hashtags
} = require("./config");
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

const createStatus = (snap, state, ops) => {
  const { alt, call, icao, mil, opicao, reg, spd, trak, type } = state;

  return fillTemplate(
    "${action}${type}${id}${operator}${count} is currently flying${altitude} overhead${direction}${speed}${hashtag}${link}",
    {
      action: randomItem(actionPhrases),
      type: formatType(icao, type),
      id: formatIdentifier(call, icao, reg),
      operator: formatOperator(opicao, snap, ops),
      count: formatCount(snap),
      altitude: formatAltitude(alt),
      direction: formatDirection(trak),
      speed: formatSpeed(spd),
      hashtag: formatHashTag(state, snap),
      link: Boolean(icao) && ` 📡https://globe.adsbexchange.com/?icao=${icao}`
    }
  );
};

const fillTemplate = (templateString, templateVariables) =>
  templateString.replace(/\${(.*?)}/g, (_, g) => templateVariables[g] || "");

const filterStates = states =>
  (states &&
    states.filter(({ alt, gnd }) => {
      if (minimumAlt && Number(alt) > minimumAlt) return false;

      return gnd !== "1";
    })) ||
  [];

const formatAltitude = alt => Boolean(alt) && ` ${numberWithCommas(alt)} ft`;

const formatCount = snap => {
  const count = snap.val() && Object.keys(snap.val().timestamps).length;

  return (
    Boolean(count) &&
    `, seen ${
      count === 1 ? "once" : `${numberWithCommas(count)} times`
    } before,`
  );
};

const formatDirection = trak =>
  Boolean(trak) &&
  ` and heading ${Compass.cardinalFromDegree(
    trak,
    Compass.CardinalSubset.Ordinal
  )}`;

const formatHashTag = (state, snap) => {
  let string = "";

  hashtags.forEach(hashtag => {
    const value = hashtag(state, snap);

    if (value) {
      string += ` #${value}`;
    }
  });

  return string;
};

const formatIdentifier = (call, icao, reg) =>
  reg && isNaN(reg.replace("-", ""))
    ? ` #${reg}`
    : Boolean(call || icao) && ` #${call || icao}`;

const formatOperator = (opicao, snap, ops) => {
  const desc = snap.val() && snap.val().description;
  let value = "";

  if (desc) {
    value = desc;
  } else if (opicao) {
    if (ops.val() && ops.val()[opicao]) {
      value = ops.val()[opicao];
    } else if (operators[opicao]) {
      value = operators[opicao].n;
    }
  }

  return Boolean(value) && ` operated by ${sanitizeString(value)}`;
};

const formatSpeed = spd =>
  Boolean(spd && Number(spd) !== 0) &&
  ` at ${Math.round(
    convert(Number(spd))
      .from("knot")
      .to("m/h")
  )} mph`;

const formatType = (icao, type) =>
  (types[icao] &&
    types[icao].d &&
    ` ${addArticle(sanitizeString(types[icao].d))}`) ||
  (types[icao] && types[icao].t && ` ${addArticle(types[icao].t)}`) ||
  (type && ` ${addArticle(type)}`) ||
  " An aircraft";

const isInDateRange = (timestamps, limit = 0, intervalLength, intervalUnit) => {
  const array = Object.values(timestamps);

  return (
    array.length >= limit &&
    array
      .slice(-limit)
      .every(timestamp =>
        moment(timestamp).isAfter(
          moment().subtract(intervalLength, intervalUnit)
        )
      )
  );
};

const isNewState = (snap, cooldown) => {
  const timestamps = snap.val() && snap.val().timestamps;

  return (
    !snap.exists() ||
    !timestamps ||
    moment(
      timestamps[Object.keys(timestamps)[Object.keys(timestamps).length - 1]]
    ).isBefore(moment().subtract(cooldown, "minutes"))
  );
};

const numberWithCommas = n =>
  n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const randomItem = array => array[Math.floor(Math.random() * array.length)];

const sanitizeString = string =>
  string
    .replace("''", "'")
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
      return !/\d|[@.\-/]/.test(w)
        ? w[0].toUpperCase() + w.substr(1).toLowerCase()
        : w;
    })
    .join(" ");

module.exports = {
  addArticle,
  createStatus,
  filterStates,
  formatAltitude,
  formatCount,
  formatDirection,
  formatHashTag,
  formatIdentifier,
  formatOperator,
  formatSpeed,
  formatType,
  isInDateRange,
  isNewState,
  numberWithCommas,
  randomItem,
  sanitizeString
};
