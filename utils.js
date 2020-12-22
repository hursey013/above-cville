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

const createStatus = (snap, state, ops, interesting, media) => {
  const { alt, call, icao, mil, opicao, reg, spd, trak, type } = state;

  return fillTemplate(
    "${action}${type}${id}${operator}${count} is currently flying${altitude} overhead${direction}${speed}${hashtag}${break}${media}${link}",
    {
      action: randomItem(actionPhrases),
      type: formatType(type),
      id: formatIdentifier(call, icao, reg, mil),
      operator: formatOperator(call, icao, opicao, reg, ops, mil),
      count: formatCount(snap),
      altitude: formatAltitude(alt),
      direction: formatDirection(trak),
      speed: formatSpeed(spd),
      hashtag: formatHashTag(state, snap, interesting),
      break: (Boolean(media) || Boolean(icao)) && "\n",
      media: Boolean(media) && `\n📸 ${media}`,
      link:
        Boolean(icao) &&
        `\n📡 https://globe.adsbexchange.com/?icao=${icao}&lat=${
          adsbx.lat
        }&lon=${adsbx.lon}&zoom=12.0&showTrace=${moment().format("YYYY-MM-DD")}`
    }
  );
};

const fillTemplate = (templateString, templateVariables) =>
  templateString.replace(/\${(.*?)}/g, (_, g) => templateVariables[g] || "");

const filterStates = (states, ignored) => {
  return (
    (states &&
      states.filter(({ alt, gnd, opicao }) => {
        if (maximumAlt && Number(alt) > maximumAlt) return false;
        if (
          ignored.val() &&
          ignored.val().some(i => i.toLowerCase() === opicao.toLowerCase())
        )
          return false;

        return gnd !== "1";
      })) ||
    []
  );
};

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

const formatHashTag = (state, snap, interesting) => {
  let string = "";

  Object.keys(hashtags).forEach(hashtag => {
    const value = hashtags[hashtag](state, snap, interesting);

    if (value) {
      string += ` #${value}`;
    }
  });

  return string;
};

const formatIdentifier = (call, icao, reg, mil) =>
  reg && !isMilitary(reg, mil)
    ? ` #${reg}`
    : Boolean(call || icao) && ` #${call || icao}`;

const formatOperator = (call, icao, opicao, reg, ops, mil) => {
  let value = "";

  if (opicao) {
    if (ops.val().opicao && ops.val().opicao[opicao]) {
      value = ops.val().opicao[opicao];
    } else if (operators[opicao]) {
      value = operators[opicao][0];
    }
  } else if (icao) {
    if (ops.val().icao && ops.val().icao[icao]) {
      value = ops.val().icao[icao];
    }
  } else if (call && !isMilitary(reg, mil)) {
    const code = call.slice(0, 3);

    if (operators[code]) {
      value = operators[code][0];
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

const formatType = type =>
  (types[type] &&
    types[type][0] &&
    ` ${addArticle(sanitizeString(types[type][0]))}`) ||
  (type && ` ${addArticle(type)}`) ||
  " An aircraft";

const isMilitary = (reg, mil) =>
  reg.includes("-") || !isNaN(reg) || mil === "1";

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
  isMilitary,
  isNewState,
  numberWithCommas,
  randomItem,
  sanitizeString
};
