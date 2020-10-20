"use strict";

require("dotenv").config();

const Buffer = require("safe-buffer").Buffer;
const convert = require("convert-units");
const moment = require("moment");

// Init Firebase
const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert({
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY,
    client_email: process.env.FIREBASE_CLIENT_EMAIL
  }),
  databaseURL: process.env.DB_URL
});

// Init Realtime Database
const db = admin.database();
const ref = db.ref("states");

// Init Twit
const Twit = require("twit");
const T = new Twit({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

// Init Axios
const axios = require("axios").default;

const addTimestamp = (icao, time) => ref.child(`${icao}/timestamps`).push(time);

const createStatus = (snap, alt, call, icao, reg, spd, type) =>
  `${type ? `A ${type} ` : `An aircraft `}(${call || reg || icao}) ${
    snap.val()
      ? `, previously seen ${(
          Object.keys(snap.val().timestamps).length + 1
        ).toString()} times, `
      : ""
  }is currently flying ${alt ? `${numberWithCommas(alt)} ft ` : " "}overhead${
    spd
      ? ` at ${Math.round(
          convert(spd)
            .from("knot")
            .to("m/h")
        )} mph`
      : ""
  } https://globe.adsbexchange.com/?icao=${icao}`;

const fetchImage = (icao, reg) =>
  axios
    .get(
      `https://www.airport-data.com/api/ac_thumb.json?m=${icao}&r=${reg}&n=100`
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
          .then(res => Buffer.from(res.data, "binary").toString("base64"))
    );

const fetchStates = () =>
  axios
    .get(
      "https://adsbexchange.com/api/aircraft/json/lat/38.03/lon/-78.478889/dist/2.5/",
      {
        headers: {
          "api-auth": process.env.ADSBX_KEY,
          "Accept-Encoding": "gzip"
        }
      }
    )
    .then(res => res.data);

const isNewState = snap =>
  !snap.exists() ||
  moment(
    snap.val() &&
      snap.val().timestamps[
        Object.keys(snap.val().timestamps)[
          Object.keys(snap.val().timestamps).length - 1
        ]
      ]
  ).isBefore(moment().subtract(1, "hours"));

const numberWithCommas = n =>
  n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const postTweet = async (call, icao, reg, status) => {
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
    const { ac, ctime } = await fetchStates();

    await Promise.all(
      (ac || []).map(async ({ alt, call, icao, reg, spd, type }) => {
        const snap = await ref.child(icao).once("value");

        if (isNewState(snap)) {
          const status = createStatus(snap, alt, call, icao, reg, spd, type);

          await Promise.all([
            addTimestamp(icao, ctime),
            postTweet(call, icao, reg, status)
          ]);
        }
      })
    );
  } catch (error) {
    console.error(error.message);
  }
}, 5000);
