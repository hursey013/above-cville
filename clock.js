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

const addTimestamp = (icao, time) => ref.child(`${icao}/timestamps`).push(time);

const createStatus = (snap, { alt, call, icao, reg, spd, trak, type }) => {
  const count =
    snap.val() && Object.keys(snap.val().timestamps).length.toString();

  return `${
    actionPhrases[Math.floor(Math.random() * actionPhrases.length)]
  } ${(types[icao] && `${a(types[icao].d, { capitalize: true })} `) ||
    (type && `${a(type, { capitalize: true })} `) ||
    `An aircraft `}(${call || reg || icao})${
    count
      ? `, seen ${count === "1" ? "one time" : `${count} times`} before,`
      : ""
  } is currently flying ${alt ? `${alt.toLocaleString()} ft ` : ""}overhead${
    trak
      ? `, heading ${Compass.cardinalFromDegree(
          trak,
          Compass.CardinalSubset.Ordinal
        )} `
      : " "
  }${
    spd
      ? `at ${Math.round(
          convert(spd)
            .from("knot")
            .to("m/h")
        )} mph `
      : ""
  }https://globe.adsbexchange.com/?icao=${icao}`;
};

const fetchImage = (icao = "", reg = "") =>
  axios
    .get(
      `${process.env.AIRPORT_DATA_URL}/ac_thumb.json?m=${icao}&r=${reg}&n=100`
    )
    .then(
      res =>
        res.data.data &&
        axios
          .get(
            res.data.data[
              Math.floor(Math.random() * res.data.data.length)
            ].image.replace("/thumbnails", ""),
            {
              responseType: "arraybuffer"
            }
          )
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

const postTweet = async ({ call, icao, reg }, status) => {
  const image = await fetchImage(icao, reg);

  return image
    ? T.post("media/upload", { media_data: image }).then(
        ({ data: { media_id_string } }) =>
          T.post("media/metadata/create", {
            media_id: media_id_string,
            alt_text: { text: call || reg || icao }
          }).then(res =>
            T.post("statuses/update", {
              status,
              media_ids: [media_id_string]
            })
          )
      )
    : T.post("statuses/update", { status });
};

setInterval(async () => {
  try {
    const { ac: states, ctime: time } = await fetchStates();

    await Promise.all(
      (states || []).map(async state => {
        const snap = await ref.child(state.icao).once("value");

        if (isNewState(snap)) {
          const status = createStatus(snap, state);

          return await Promise.all([
            addTimestamp(state.icao, time),
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
