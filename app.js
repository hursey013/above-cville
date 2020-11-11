"use strict";

const axios = require("axios").default;
const admin = require("firebase-admin");
const Buffer = require("safe-buffer").Buffer;
const { serializeError } = require("serialize-error");
const Twit = require("twit");

const {
  adsbx: { url, lat, lon, radius, key },
  cooldownMinutes,
  maximumAlt,
  dbUrl,
  firebase,
  photoApi,
  twitter
} = require("./config");
const {
  createStatus,
  isNewState,
  filterStates,
  formatIdentifier,
  formatType,
  randomItem
} = require("./utils");

admin.initializeApp({
  credential: admin.credential.cert(firebase),
  databaseURL: dbUrl
});
const db = admin.database();
const statesRef = db.ref("states");
const opsRef = db.ref("operators");
const T = new Twit(twitter);

// Download and convert image to base64
const downloadMedia = url =>
  axios
    .get(url, { responseType: "arraybuffer" })
    .then(({ data }) => Buffer.from(data, "binary").toString("base64"));

const fetchMedia = async (call, reg, snap) => {
  // Check for photos in DB before calling API
  const photos = snap.val() && snap.val().photos;
  const media = photos
    ? fetchLocalMediaUrl(photos)
    : await fetchRemoteMediaUrl(reg || call);

  return media;
};

const fetchLocalMediaUrl = async photos => ({
  photo: photos.length && (await downloadMedia(randomItem(photos))),
  link: false
});

// Get image url from photo API
const fetchRemoteMediaUrl = reg => {
  const { url, username, password } = photoApi;

  return axios({
    method: "get",
    url,
    auth: {
      username,
      password
    },
    params: {
      reg,
      v: 1
    }
  }).then(async ({ data: { photos, links } }) => ({
    photo: photos.length && (await downloadMedia(randomItem(photos))),
    link: links.length && randomItem(links)
  }));
};

// Main function to retrieve ADS-B data from ADSBx
const fetchStates = () =>
  axios
    .get(`${url}/lat/${lat}/lon/${lon}/dist/${radius}/`, {
      headers: { "api-auth": key, "Accept-Encoding": "gzip" }
    })
    .then(({ data }) => data);

// Send a media tweet if there is a photo, otherwise normal tweet
const postTweet = async (snap, state, ops) => {
  const { call, icao, reg, type } = state;
  const media = await fetchMedia(call, reg, snap);

  return media.photo
    ? // Send media tweet
      T.post("media/upload", { media_data: media.photo })
        .then(({ data }) =>
          T.post("media/metadata/create", {
            media_id: data.media_id_string,
            alt_text: {
              text: `${formatType({
                icao,
                type
              })} (${formatIdentifier({ call, icao, reg })})`
            }
          }).then(res =>
            T.post("statuses/update", {
              status: createStatus(snap, state, ops),
              media_ids: [data.media_id_string]
            })
          )
        )
        .catch(error => {
          console.warn(
            "Media upload failed",
            JSON.stringify(serializeError(error))
          );
          // Atempt to send tweet without media on error
          return T.post("statuses/update", {
            status: createStatus(snap, state, ops, media.link)
          });
        })
    : // Send tweet without media
      T.post("statuses/update", {
        status: createStatus(snap, state, ops, media.link)
      });
};

// Record timestamp of spotted aircraft to database
const saveTimestamp = (icao, time) =>
  statesRef.child(`${icao}/timestamps`).push(time);

const app = async () => {
  try {
    const { ac: states, ctime: time } = await fetchStates();

    return await Promise.all(
      filterStates(states).map(async state => {
        const { icao } = state;
        const snap = await statesRef.child(icao).once("value");
        const ops = await opsRef.once("value");

        // Check if this is a new aircraft or if it's past the cooldown time
        if (isNewState(snap, cooldownMinutes)) {
          console.info(JSON.stringify(state));

          return await Promise.all([
            saveTimestamp(icao, time),
            postTweet(snap, state, ops)
          ]);
        }

        return false;
      })
    );
  } catch (error) {
    return console.error(JSON.stringify(serializeError(error)));
  }
};

module.exports = app;
