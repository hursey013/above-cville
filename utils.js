"use strict";

const Compass = require("cardinal-direction");
const convert = require("convert-units");
const fs = require("fs");
const a = require("indefinite");
const moment = require("moment");
const {
  abbreviations,
  actionPhrases,
  adsbx,
  articles,
  maximumAlt
} = require("./config");
const hashtags = require("./hashtags");
const operators = require("./storage/operators.json");
const types = require("./storage/types.json");

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
        `\n📡 https://globe.adsbexchange.com/?icao=${hex}&lat=${
          adsbx.lat
        }&lon=${adsbx.lon}&zoom=12.0&showTrace=${moment().format("YYYY-MM-DD")}`
    }
  );
};

const deriveOpicao = (flight, reg, dbFlags) =>
  !isMilitary(reg, dbFlags) && flight && flight.trim().slice(0, 3);

const fillTemplate = (templateString, templateVariables) =>
  templateString.replace(/\${(.*?)}/g, (_, g) => templateVariables[g] || "");

const filterStates = (states = [], ignored) => {
  return states.filter(({ alt_baro, flight, dbFlags, r: reg }) => {
    const opicao = deriveOpicao(flight, reg, dbFlags);

    if (maximumAlt && alt_baro > maximumAlt) return false;
    if (alt_baro && alt_baro === "ground") return false;
    if (
      opicao &&
      ignored &&
      ignored.val().some(i => i.toLowerCase() === opicao.toLowerCase())
    )
      return false;

    return true;
  });
};

const formatAltitude = alt_baro =>
  Boolean(alt_baro && alt_baro !== "ground") &&
  ` ${numberWithCommas(alt_baro)} ft`;

const formatCount = snap => {
  const count = snap.val() && Object.keys(snap.val().timestamps).length;

  return (
    Boolean(count) &&
    `, seen ${
      count === 1 ? "once" : `${numberWithCommas(count)} times`
    } before,`
  );
};

const formatDirection = track =>
  Boolean(track) &&
  ` and heading ${Compass.cardinalFromDegree(
    track,
    Compass.CardinalSubset.Ordinal
  )}`;

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
  let value = "";

  if (hex && ops.val().icao && ops.val().icao[hex.toUpperCase()]) {
    value = ops.val().icao[hex.toUpperCase()];
  } else if (opicao && ops.val().opicao && ops.val().opicao[opicao]) {
    value = ops.val().opicao[opicao];
  } else if (opicao && operators[opicao]) {
    value = operators[opicao][0];
  }

  return Boolean(value) && ` operated by ${sanitizeString(value)}`;
};

const formatSpeed = gs =>
  Boolean(gs && gs !== 0) &&
  ` at ${Math.round(
    convert(Number(gs))
      .from("knot")
      .to("m/h")
  )} mph`;

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
      return !/\d|[#@.\-/]/.test(w)
        ? w[0].toUpperCase() + w.substr(1).toLowerCase()
        : w;
    })
    .join(" ")
    .trim();

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
  isMilitary,
  isNewState,
  numberWithCommas,
  randomItem,
  sanitizeString
};
