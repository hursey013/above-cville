# above-cville

> What's flying over the City of Charlottesville, Virginia?

## Introduction

Twitter bot which uses the [ADS-B Exchange](https://www.adsbexchange.com/) API to spot aircraft within a 2.5nm radius of the City of Charlottesville, VA ([38.0375, -78.4863](https://goo.gl/maps/sySAUH9KeKCYCrtG9)). Timestamps for each spotting are persisted to a Firebase Realtime Database.

## Initial setup

### Clone this repo

- Clone or download this repo and open the `above-cville` directory.

### Create a Firebase project

- Create a Firebase Project using the [Firebase Developer Console](https://console.firebase.google.com)
- Install [Firebase CLI Tools](https://github.com/firebase/firebase-tools) if you have not already, and log in with `firebase login`.
- Configure the bot to use your project using `firebase use --add` and select your project.

### Install dependencies and add environment variables

- Install dependencies by running: `npm install`
- Provide the following environment variables in your .env file:

  ```
  ADSBX_KEY="api-key-here"

  FIREBASE_PROJECT_ID="my-app"
  FIREBASE_PRIVATE_KEY="private-key-here"
  FIREBASE_CLIENT_EMAIL="firebase-adminsdk@my-app.iam.gserviceaccount.com"
  DB_URL="https://my-app.firebaseio.com"

  TWITTER_ACCESS_TOKEN="access-token-here"
  TWITTER_ACCESS_TOKEN_SECRET="access-token-secret-here"
  TWITTER_CONSUMER_KEY="consumer-key-here"
  TWITTER_CONSUMER_SECRET="consumer-secret-here"
  ```

  Further reading:

  - [Setting up a Firebase project and service account](https://firebase.google.com/docs/admin/setup)
  - [Twitter API credentials](https://developer.twitter.com/)
  - [Accessing Data Collected by ADS-B Exchange](https://www.adsbexchange.com/data/)
  - [Airport-Data.com API Documents](https://www.airport-data.com/api/doc.php)

### Update configuration

There are a number of variables which can be customized by modifying `config.js`

- `actionPhrases` - short phrases to add to the beginning of the tweet
- `refreshSeconds` - how often to call the ADS-B endpoint
- `cooldownMinutes` - amount of time that should pass before spotting the same aircraft
- `maximumAlt` - filter out aircraft above this altitude
- `abbreviations` - abbreviations that should be kept uppercase
- `articles` - exceptions where a plane type should be an `An` instead of an `A` and vice versa
- `airport.dataUrl` - URL for thumbnail endpoint
- `adsbx.url` - URL for ADS-B endpoint
- `adsbx.lat` - latitude value used for geolocation
- `adsbx.lon` - longitude value used for geolocation
- `adsbx.radius` - radius for search in nautical miles

### Download databases

`above-cville` relies on two static JSON files for aircraft types (`storage/aircrafts.json`) and operators (`storage/operators.json`) data. These files are regularly updated and can be downloaded from https://github.com/Mictronics/readsb-protobuf/tree/dev/webapp/src/db manually or through a cron job.

## Usage

To start the bot, run the following in the project directory:

```
npm start
```

To run the included unit tests:

```
npm test
```

## Inspiration

- [AboveTustin](https://github.com/kevinabrandon/AboveTustin) - ADS-B Twitter Bot. Uses dump1090-mutability to track airplanes and then tweets whenever an airplane flies overhead.
