# above-cville

> What's flying over the City of Charlottesville, Virginia?

## Introduction

Twitter bot which uses the [ADS-B Exchange](https://www.adsbexchange.com/) API to spot aircraft within a 2.5nm radius of the City of Charlottesville, VA ([38.03, -78.478889](https://www.google.com/maps/place/38%C2%B001'48.0%22N+78%C2%B028'44.0%22W/@38.03,-78.481083,17z/data=!3m1!4b1!4m5!3m4!1s0x0:0x0!8m2!3d38.03!4d-78.478889)). Timestamps for each spotting are persisted to a Firebase Realtime Database.

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
- `adsbxUrl` - URL for ADS-B endpoint
- `adsbxLat` - latitude value used for geolocation
- `adsbxLon` - longitude value used for geolocation
- `adsbxRadius` - radius for search in nautical miles
- `airportDataUrl` - URL for thumbnail endpoint

## Usage

To start the bot, run the following in the project directory:

```
npm start
```

## Inspiration

- [AboveTustin](https://github.com/kevinabrandon/AboveTustin) - ADS-B Twitter Bot. Uses dump1090-mutability to track airplanes and then tweets whenever an airplane flies overhead.
