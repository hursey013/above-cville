"use strict";

const fs = require("fs");
const path = require("path");
const a = require("indefinite");
const moment = require("moment");

const {
  abbreviations,
  actionPhrases,
  airplanesLive,
  articles,
  maximumAlt
} = require("./config");
const hashtags = require("./hashtags");

const operatorsPath = path.join(__dirname, "storage", "operators.json");
const typesPath = path.join(__dirname, "storage", "types.json");

// Attempt to load optional data stores when present locally.
// The files are large and typically mounted at runtime, so fall back to an empty object when absent.
// eslint-disable-next-line global-require, import/no-dynamic-require
const operators = fs.existsSync(operatorsPath) ? require(operatorsPath) : {};
// eslint-disable-next-line global-require, import/no-dynamic-require
const types = fs.existsSync(typesPath) ? require(typesPath) : {};

const degreeToCardinal = degree => {
  if (!Number.isFinite(Number(degree))) return undefined;

  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const normalized = (Number(degree) % 360 + 360) % 360;
  const index = Math.round(normalized / 45) % directions.length;
  return directions[index];
};

const knotsToMph = knots => Number(knots) * 1.150779448;

const addArticle = string => {
  // See if string matches any exceptions defined in the config
  for (const article of Object.keys(articles)) {
    if (
      articles[article].some(item =>
        string.toLowerCase().includes(item.toLowerCase())
      )
    ) {
      return `${article} ${string}`;
    }
  }

  return a(string, { capitalize: true });
};

const createStatus = (snap, state, ops, media) => {
  const { alt_baro, flight, hex, dbFlags, r: reg, gs, track, t: frame } = state;

  return fillTemplate(
    "${action}${type}${id}${operator}${count} is currently flying${altitude} overhead${direction}${speed}${hashtag}${break}${media}${link}",
    {
      action: randomItem(actionPhrases),
      type: formatType(frame),
      id: formatIdentifier(flight, reg, dbFlags),
      operator: formatOperator(flight, hex, reg, ops, dbFlags),
      count: formatCount(snap),
      altitude: formatAltitude(alt_baro),
      direction: formatDirection(track),
      speed: formatSpeed(gs),
      hashtag: formatHashTag(state, snap),
      break: (media || hex) && "\n",
      media: media && `\n📸 ${media}`,
      link:
        hex &&
        `\n📡 https://globe.airplanes.live/?icao=${hex}&lat=${
          airplanesLive.lat
        }&lon=${airplanesLive.lon}&zoom=12.0&showTrace=${moment().format(
          "YYYY-MM-DD"
        )}`
    }
  );
};

const deriveOpicao = (flight, reg, dbFlags) =>
  !isMilitary(reg, dbFlags) && flight && flight.trim().slice(0, 3);

const fillTemplate = (templateString, templateVariables) =>
  templateString.replace(/\${(.*?)}/g, (_, g) => templateVariables[g] || "");

const filterStates = (states = [], ignored) => {
  const ignoredList = (ignored && ignored.val && ignored.val()) || [];

  return states.filter(({ alt_baro, flight, dbFlags, r: reg }) => {
    const opicao = deriveOpicao(flight, reg, dbFlags);

    if (maximumAlt && alt_baro > maximumAlt) return false;
    if (alt_baro && alt_baro === "ground") return false;
    if (
      opicao &&
      Array.isArray(ignoredList) &&
      ignoredList.some(i => i.toLowerCase() === opicao.toLowerCase())
    )
      return false;

    return true;
  });
};

const formatAltitude = alt_baro =>
  Boolean(alt_baro && alt_baro !== "ground") &&
  ` ${numberWithCommas(alt_baro)} ft`;

const formatCount = snap => {
  const timestamps = snap && snap.val && snap.val() && snap.val().timestamps;
  const count = timestamps && Object.keys(timestamps).length;

  return (
    Boolean(count) &&
    `, seen ${
      count === 1 ? "once" : `${numberWithCommas(count)} times`
    } before,`
  );
};

const formatDirection = track => {
  const cardinal = degreeToCardinal(track);
  return cardinal ? ` and heading ${cardinal}` : false;
};

const formatHashTag = (state, snap) => {
  let string = "";

  Object.keys(hashtags).forEach(hashtag => {
    const value = hashtags[hashtag](state, snap);

    if (value) {
      string += ` #${value}`;
    }
  });

  return string;
};

const formatIdentifier = (flight, reg, dbFlags) =>
  (reg && !isMilitary(reg, dbFlags) && ` #${reg}`) ||
  (flight && ` #${flight.trim()}`) ||
  false;

const formatOperator = (flight, hex, reg, ops, dbFlags) => {
  const opicao = deriveOpicao(flight, reg, dbFlags);
  const snapshot = (ops && ops.val && ops.val()) || {};
  let value = "";

  if (hex && snapshot.icao && snapshot.icao[hex.toUpperCase()]) {
    value = snapshot.icao[hex.toUpperCase()];
  } else if (opicao && snapshot.opicao && snapshot.opicao[opicao]) {
    value = snapshot.opicao[opicao];
  } else if (opicao && operators[opicao]) {
    value = operators[opicao][0];
  }

  return Boolean(value) && ` operated by ${sanitizeString(value)}`;
};

const formatSpeed = gs => {
  if (!gs || Number(gs) === 0) return false;
  return ` at ${Math.round(knotsToMph(Number(gs)))} mph`;
};

const formatType = frame => {
  let value = "";

  if (types[frame] && types[frame][0]) {
    value = types[frame][0];
  } else if (frame) {
    value = frame;
  }

  return value ? ` ${addArticle(sanitizeString(value))}` : " An aircraft";
};

const isMilitary = (reg, dbFlags) =>
  (reg && (reg.includes("-") || (!isNaN(reg) && !isNaN(parseFloat(reg))))) ||
  (dbFlags && dbFlags === 1);

const isNewState = (snap, cooldown) => {
  const timestamps = snap && snap.val && snap.val() && snap.val().timestamps;

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
      return !/\d|[#@.\-/]/.test(w)
        ? w[0].toUpperCase() + w.substr(1).toLowerCase()
        : w;
    })
    .join(" ")
    .trim();

module.exports = {
  addArticle,
  createStatus,
  degreeToCardinal,
  filterStates,
  formatAltitude,
  formatCount,
  formatDirection,
  formatHashTag,
  formatIdentifier,
  formatOperator,
  formatSpeed,
  formatType,
  isMilitary,
  isNewState,
  knotsToMph,
  numberWithCommas,
  randomItem,
  sanitizeString
};
