"use strict";

const axios = require("axios").default;
const admin = require("firebase-admin");
const Buffer = require("safe-buffer").Buffer;
const Twit = require("twit");

const {
  adsbx: { url, lat, lon, radius, key },
  airportDataUrl,
  cooldownMinutes,
  dbUrl,
  firebase,
  twitter
} = require("./config");
const {
  createStatus,
  isNewState,
  formatIdentifier,
  formatType,
  randomItem
} = require("./utils");

admin.initializeApp({
  credential: admin.credential.cert(firebase),
  databaseURL: dbUrl
});
const db = admin.database();
const ref = db.ref("states");
const storage = admin.storage();
const T = new Twit(twitter);

// Download and convert image to base64
const downloadImage = url =>
  axios
    .get(url, { responseType: "arraybuffer" })
    .then(({ data }) => Buffer.from(data, "binary").toString("base64"));

// See if local images exist, otherwise fetch remote images and download
const fetchImage = async (icao, reg, hasImages) => {
  const urls = hasImages
    ? await fetchLocalImageUrls(hasImages)
    : await fetchRemoteImageUrls(icao, reg);

  if (urls) {
    const { image, link } = urls;
    const b64content = await downloadImage(image);

    return {
      b64content,
      link
    };
  }
  return false;
};

// Get reference to local image from Firebase Storage
const fetchLocalImageUrls = async hasImages => {
  const { image, link } = randomItem(hasImages);
  const imageUrl = await storage.refFromURL(image).getDownloadURL();

  return { image: imageUrl, link };
};

// Get image and credit url from remote API
const fetchRemoteImageUrls = async (icao, reg) =>
  axios
    .get(`${airportDataUrl}/ac_thumb.json?m=${icao}&r=${reg}&n=100`)
    .then(async ({ data: { data } }) => {
      if (data) {
        const { image, link } = randomItem(data);

        return { image, link };
      }
      return false;
    });

// Main function to retrieve ADS-B data from ADSBx
const fetchStates = () =>
  axios
    .get(`${url}/lat/${lat}/lon/${lon}/dist/${radius}/`, {
      headers: { "api-auth": key, "Accept-Encoding": "gzip" }
    })
    .then(({ data }) => data);

// Send a media tweet if there is a photo, otherwise normal tweet
const postTweet = async (snap, state, hasImages) => {
  const { call, icao, reg, type } = state;
  const media = await fetchImage(icao, reg, hasImages);

  if (media) {
    const { b64content: media_data, link } = media;
    const status = createStatus(snap, state, link);

    // Send media tweet
    return T.post("media/upload", { media_data }).then(
      ({ data: { media_id_string } }) =>
        T.post("media/metadata/create", {
          media_id: media_id_string,
          alt_text: {
            text: `${formatType({
              icao,
              type
            })} (${formatIdentifier({ call, icao, reg })})`
          }
        }).then(res =>
          T.post("statuses/update", {
            status,
            media_ids: [media_id_string]
          })
        )
    );
  }
  const status = createStatus(snap, state);

  // Send tweet without media
  return T.post("statuses/update", { status });
};

// Record timestamp of spotted aircraft to database
const saveTimestamp = (icao, time) =>
  ref.child(`${icao}/timestamps`).push(time);

const app = async () => {
  try {
    const { ac: states, ctime: time } = await fetchStates();

    // Filter out aircraft that are on currently on the ground
    const filteredStates =
      (states && states.filter(({ gnd }) => gnd !== "1")) || [];

    return await Promise.all(
      filteredStates.map(async state => {
        const { icao } = state;
        const snap = await ref.child(icao).once("value");

        // Check if this is a new aircraft, or if it's past the cooldown time
        if (isNewState(snap, cooldownMinutes)) {
          const hasImages = snap.val() && snap.val().images;

          return await Promise.all([
            saveTimestamp(icao, time),
            postTweet(snap, state, hasImages)
          ]);
        }

        return false;
      })
    );
  } catch (error) {
    return console.error(`Error: ${error.message}`);
  }
};

module.exports = app;
