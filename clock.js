"use strict";

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
  baseURL: "https://opensky-network.org/api/"
});

const fetchMetadata = async states => {
  const results = [];

  for (const state of states) {
    results.push(instance.get(`/metadata/aircraft/icao/${state[0]}`));
  }

  return await Promise.all(results);
};

const fetchStates = () =>
  instance.get("/states/all", {
    auth: {
      username: process.env.USERNAME,
      password: process.env.PASSWORD
    },
    params: {
      lomin: -78.523665,
      lamin: 38.009616,
      lomax: -78.446311,
      lamax: 38.070591
    }
  });

setInterval(() => {
  fetchStates()
    .then(({ data }) => (data.states ? fetchMetadata(data.states) : []))
    .then(states =>
      states.map(({ data }) =>
        ref
          .child(data.icao24)
          .once("value")
          .then(
            snapshot =>
              (!snapshot.exists() ||
                (snapshot.val() &&
                  moment(snapshot.val().timestamp).isAfter(
                    moment().subtract(1, "hours")
                  ))) &&
              Promise.all([
                ref.child(data.icao24).set({ timestamp: data.timestamp }),
                T.post("statuses/update", {
                  status: `Look up! A ${data.manufacturerName} ${data.model} is currently flying overhead.`
                })
              ])
          )
          .catch(error => console.error(error))
      )
    )
    .catch(error => console.error(error.toJSON()));
}, 5000);
