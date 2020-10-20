"use strict";

require("dotenv").config();

const convert = require("convert-units");
const moment = require("moment");

// Init Firebase
const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert({
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url:
      process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
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
const instance = axios.create({
  baseURL: "https://adsbexchange.com/api/"
});

const fetchImage = (icao, reg) => {
  axios
    .get(
      `https://www.airport-data.com/api/ac_thumb.json?m=${icao}&r=${reg}&n=1`
    )
    .then(({ data }) =>
      axios.get(data.data[0].image.replace("thumbnails/", ""))
    );
};

const fetchStates = () =>
  instance.get("/aircraft/json/lat/38.03/lon/-78.478889/dist/2.5/", {
    headers: { "api-auth": process.env.ADSBX_KEY, "Accept-Encoding": "gzip" }
  });

const numberWithCommas = n =>
  n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

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

setInterval(async () => {
  try {
    const {
      data: { ac: states, ctime: time }
    } = await fetchStates();

    await Promise.all(
      (states || []).map(async ({ alt, call, icao, spd, type }) => {
        const snap = await ref.child(icao).once("value");

        if (isNewState(snap)) {
          await Promise.all([
            ref.child(`${icao}/timestamps`).push(time),
            T.post("statuses/update", {
              status: `Look up! ${type ? `A ${type} ` : `An aircraft `}${
                call ? `(${call}) ` : " "
              }is currently flying ${
                alt ? `${numberWithCommas(alt)}ft ` : " "
              }overhead${
                spd
                  ? ` at ${Math.round(
                      convert(spd)
                        .from("knot")
                        .to("m/h")
                    )}mph`
                  : ""
              } https://globe.adsbexchange.com/?icao=${icao}`
            })
          ]);
        }
      })
    );
  } catch (error) {
    console.error(error.message);
  }
}, 5000);
