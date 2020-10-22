"use strict";

require("dotenv").config();

const axios = require("axios").default;
const Compass = require("cardinal-direction");
const convert = require("convert-units");
const admin = require("firebase-admin");
const a = require("indefinite");
const moment = require("moment");
const Buffer = require("safe-buffer").Buffer;
const Twit = require("twit");

/*
Static aircraft data:
https://github.com/Mictronics/readsb-protobuf/tree/dev/webapp/src/db
*/
const types = require("./storage/aircrafts.json");

// Firebase
admin.initializeApp({
  credential: admin.credential.cert({
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY,
    client_email: process.env.FIREBASE_CLIENT_EMAIL
  }),
  databaseURL: process.env.DB_URL
});

// Realtime Database
const db = admin.database();
const ref = db.ref("states");

// Twit
const T = new Twit({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

const actionPhrases = [
  "Can you see it?",
  "Look up!",
  "There it goes!",
  "Up above!"
];

const addArticle = string => a(string, { capitalize: true });

const createStatus = (snap, state) => {
  return `${randomItem(actionPhrases)} ${formatType(state)} (${formatIdentifier(
    state
  )})${formatCount(snap)} is currently flying ${formatAltitude(
    state
  )}overhead${formatDirection(state)}${formatSpeed(
    state
  )}https://globe.adsbexchange.com/?icao=${state.icao}`;
};

const fetchImage = (icao = "", reg = "") =>
  axios
    .get(
      `${process.env.AIRPORT_DATA_URL}/ac_thumb.json?m=${icao}&r=${reg}&n=100`
    )
    .then(
      ({ data: { data } }) =>
        data &&
        axios
          .get(randomItem(data).image.replace("/thumbnails", ""), {
            responseType: "arraybuffer"
          })
          .then(({ data }) => Buffer.from(data, "binary").toString("base64"))
    );

const fetchStates = () =>
  axios
    .get(
      `${process.env.ADSBX_URL}/aircraft/json/lat/${process.env.ADSBX_LAT}/lon/${process.env.ADSBX_LON}/dist/${process.env.ADSBX_RADIUS}/`,
      {
        headers: {
          "api-auth": process.env.ADSBX_KEY,
          "Accept-Encoding": "gzip"
        }
      }
    )
    .then(({ data }) => data);

const formatAltitude = ({ alt }) => (alt ? `${numberWithCommas(alt)} ft ` : "");

const formatCount = snap => {
  const count = snap.val() && Object.keys(snap.val().timestamps).length;

  return count
    ? `, seen ${count === 1 ? "one time" : `${count} times`} before,`
    : "";
};

const formatDirection = ({ trak }) =>
  trak
    ? `, heading ${Compass.cardinalFromDegree(
        trak,
        Compass.CardinalSubset.Ordinal
      )} `
    : " ";

const formatIdentifier = ({ call, reg, icao }) => call || reg || icao;

const formatSpeed = ({ spd }) =>
  spd
    ? `at ${Math.round(
        convert(spd)
          .from("knot")
          .to("m/h")
      )} mph `
    : "";

const formatType = ({ call, icao, reg, type }) =>
  (types[icao] && types[icao].d && addArticle(types[icao].d)) ||
  (types[icao] && types[icao].t && addArticle(types[icao].t)) ||
  (type && addArticle(type)) ||
  "An aircraft";

const isNewState = snap => {
  const timestamps = snap.val() && snap.val().timestamps;

  return (
    !snap.exists() ||
    moment(
      timestamps &&
        timestamps[Object.keys(timestamps)[Object.keys(timestamps).length - 1]]
    ).isBefore(moment().subtract(process.env.COOLDOWN_HOURS, "hours"))
  );
};

const numberWithCommas = n =>
  n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const postTweet = async (state, status) => {
  const image = await fetchImage(state.icao, state.reg);

  return image
    ? T.post("media/upload", { media_data: image }).then(
        ({ data: { media_id_string } }) =>
          T.post("media/metadata/create", {
            media_id: media_id_string,
            alt_text: {
              text: `${formatType(state)} (${formatIdentifier(state)})`
            }
          }).then(res =>
            T.post("statuses/update", {
              status,
              media_ids: [media_id_string]
            })
          )
      )
    : T.post("statuses/update", { status });
};

const randomItem = array => array[Math.floor(Math.random() * array.length)];

const saveTimestamp = (icao, time) =>
  ref.child(`${icao}/timestamps`).push(time);

setInterval(async () => {
  try {
    const { ac: states, ctime: time } = await fetchStates();

    await Promise.all(
      (states || []).map(async state => {
        const snap = await ref.child(state.icao).once("value");

        if (isNewState(snap)) {
          const status = createStatus(snap, state);

          return await Promise.all([
            saveTimestamp(state.icao, time),
            postTweet(state, status)
          ]);
        }

        return false;
      })
    );
  } catch (error) {
    console.error(error.message);
  }
}, process.env.REFRESH_SECONDS * 1000);
