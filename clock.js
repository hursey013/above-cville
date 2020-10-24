"use strict";

require("dotenv").config();

const axios = require("axios").default;
const admin = require("firebase-admin");
const Buffer = require("safe-buffer").Buffer;
const Twit = require("twit");

const config = require("./config.js");
const utils = require("./utils.js");

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

// Storage
const storage = admin.storage();

// Twit
const T = new Twit({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

const downloadImage = url =>
  axios
    .get(url, { responseType: "arraybuffer" })
    .then(({ data }) => Buffer.from(data, "binary").toString("base64"));

const fetchImage = async (icao, reg, hasImages) => {
  if (hasImages) {
    const { image, link } = utils.randomItem(hasImages);
    const imageRef = await storage.refFromURL(image).getDownloadURL();
    const b64content = await downloadImage(imageRef);

    console.log(`Using local image: ${imageRef}`);

    return {
      b64content,
      link
    };
  } else {
    return axios
      .get(`${config.airportDataUrl}/ac_thumb.json?m=${icao}&r=${reg}&n=100`)
      .then(async ({ data: { data } }) => {
        if (data) {
          const { image, link } = utils.randomItem(data);
          const b64content = await downloadImage(image);

          return {
            b64content,
            link
          };
        }
        return false;
      });
  }
};

const fetchStates = () => {
  const { adsbxUrl, adsbxLat, adsbxLon, adsbxRadius } = config;

  return axios
    .get(`${adsbxUrl}/lat/${adsbxLat}/lon/${adsbxLon}/dist/${adsbxRadius}/`, {
      headers: { "api-auth": process.env.ADSBX_KEY, "Accept-Encoding": "gzip" }
    })
    .then(({ data }) => data);
};

const postTweet = async ({ call, icao, reg, type }, status, hasImages) => {
  const media = await fetchImage(icao, reg, hasImages);
  const { b64content, link } = media;

  return b64content
    ? T.post("media/upload", { media_data: b64content }).then(
        ({ data: { media_id_string } }) =>
          T.post("media/metadata/create", {
            media_id: media_id_string,
            alt_text: {
              text: `${utils.formatType({
                icao,
                type
              })} (${utils.formatIdentifier({ call, icao, reg })})`
            }
          }).then(res =>
            T.post("statuses/update", {
              status: `${status} 📷${link}`,
              media_ids: [media_id_string]
            })
          )
      )
    : T.post("statuses/update", { status });
};

const saveTimestamp = (icao, time) =>
  ref.child(`${icao}/timestamps`).push(time);

setInterval(async () => {
  try {
    const { ac: states, ctime: time } = await fetchStates();
    const filteredStates =
      (states && states.filter(({ gnd }) => gnd !== "1")) || [];

    await Promise.all(
      filteredStates.map(async state => {
        const { call, icao, reg, type } = state;
        const snap = await ref.child(icao).once("value");

        if (utils.isNewState(snap, config.cooldownMinutes)) {
          const hasImages = snap.val() && snap.val().images;

          return await Promise.all([
            saveTimestamp(icao, time),
            postTweet(
              { call, icao, reg, type },
              utils.createStatus(snap, state),
              hasImages
            )
          ]);
        }

        return false;
      })
    );
  } catch (error) {
    console.error(error.message);
  }
}, config.refreshSeconds * 1000);
