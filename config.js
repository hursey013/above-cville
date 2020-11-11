require("dotenv").config();
const { isInDateRange } = require("./utils");

module.exports = {
  actionPhrases: ["Can you see it?", "Look up!", "There it goes!", "Up above!"],
  refreshSeconds: 5,
  cooldownMinutes: 10,
  minimumAlt: 25000,
  photoApi: {
    username: process.env.PHOTO_API_USERNAME,
    password: process.env.PHOTO_API_PASSWORD,
    url: "https://fa-photo-api.web.app"
  },
  abbreviations: ["IAI", "II", "III", "LLC", "PHI", "PSA"],
  articles: {
    A: ["Eurocopter"],
    An: []
  },
  hashtags: [
    ({ interested }, snap) =>
      Boolean(
        snap.val() && snap.val().interesting !== false && interested === "1"
      ) && "interesting",
    ({ mil }, snap) => mil === "1" && "military",
    (state, snap) =>
      Boolean(
        snap.val() && isInDateRange(snap.val().timestamps, 3, 24, "hours")
      ) && "busyday",
    (state, snap) =>
      Boolean(
        snap.val() && isInDateRange(snap.val().timestamps, 30, 90, "days")
      ) && "frequentflyer"
  ],
  adsbx: {
    url: "https://adsbexchange.com/api/aircraft/json",
    lat: 38.0375,
    lon: -78.4863,
    radius: 2.5,
    key: process.env.ADSBX_KEY
  },
  dbUrl: process.env.DB_URL,
  firebase: {
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY,
    client_email: process.env.FIREBASE_CLIENT_EMAIL
  },
  twitter: {
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token: process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
  }
};
