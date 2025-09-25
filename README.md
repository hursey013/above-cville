# above-cville

> What's flying over the City of Charlottesville, Virginia?

## Introduction

`above-cville` polls the [airplanes.live](https://airplanes.live/) API for aircraft within a configurable radius of Charlottesville, VA (default centre [38.0375, -78.4863](https://goo.gl/maps/sySAUH9KeKCYCrtG9)).
When a new aircraft is detected the event is recorded in [PocketBase](https://pocketbase.io/) and a richly formatted notification is pushed through [Apprise-API](https://github.com/caronc/apprise-api) so it can be fanned out to any supported notification service.

The project has been modernised to remove its Firebase/Twitter dependencies and now runs as a set of self-hosted services that are easy to deploy on a Synology NAS using Container Manager.

## Features

- Polls the airplanes.live REST API on an interval you control.
- Persists aircraft encounter history in PocketBase for cooldown logic and historical tags.
- Caches PocketBase operator and ignore lists to minimize repeated API calls while polling.
- Ships notifications to Apprise, enabling delivery to Discord, Telegram, SMTP, Pushover, and many more providers.
- Looks up aircraft metadata and hashtags using the `storage/types.json` and `storage/operators.json` datasets (optional, can be mounted at runtime).
- Ships with a ready-to-use Docker image and `docker-compose.yml` tailored for Synology Container Manager.

## Architecture

```
┌──────────────┐      ┌──────────────┐      ┌────────────┐
│ airplanes.live │    │ above-cville │      │ Apprise    │
│     API        ├─────►│   (Node.js)  ├─────►│  API       │
└──────────────┘      └──────┬───────┘      └────────────┘
                              │
                              ▼
                      ┌──────────────┐
                      │ PocketBase   │
                      │ (Aircraft DB)│
                      └──────────────┘
```

## Prerequisites

- Node.js 18+ for local development.
- Access to the airplanes.live API (see the [API guide](https://airplanes.live/api-guide/) for rate limits and usage details).
- PocketBase instance (self-hosted or managed).
- Apprise-API instance for notifications.

## Initial setup

### 1. Clone this repository

```bash
git clone https://github.com/hursey013/above-cville.git
cd above-cville
```

### 2. Install dependencies

```bash
npm install
```

> **Tip:** The repository ships with tiny `storage/operators.json` and `storage/types.json` examples so the test-suite runs out of the box. For meaningful data download the full datasets from the [Mictronics/readsb-protobuf repository](https://github.com/Mictronics/readsb-protobuf/tree/dev/webapp/src/db) and mount them at runtime or replace the sample files locally.

### 3. Configure PocketBase

Create three collections in PocketBase:

1. **states** – stores aircraft sightings
   - `hex` (text, unique) – ICAO24 hex identifier
   - `timestamps` (JSON array) – list of UNIX timestamps (milliseconds) when the aircraft was seen

2. **operators** – optional overrides for airline/operator names
   - `name` (text)
   - `icao` (text, optional) – maps directly to an aircraft hex
   - `opicao` (text, optional) – maps to the three letter ICAO prefix extracted from the callsign

3. **ignored** – list of operator prefixes to ignore
   - `opicao` (text) – three-letter prefix that should be skipped (e.g. `PDT`)

Generate an admin API token or create an admin user for programmatic access.

> **Performance tip:** Tune `POCKETBASE_CACHE_TTL_SECONDS` to control how long operator and ignore lists remain cached locally. Set it to `0` to disable caching when actively editing data in PocketBase.

### 4. Configure Apprise-API

Deploy [Apprise-API](https://github.com/caronc/apprise-api) and create one or more notification URLs. These URLs go into the `APPRISE_TARGETS` environment variable.

### 5. Provide environment variables

Create a `.env` file using `.env.sample` as a guide. Important entries:

- `AIRPLANES_LIVE_*` – airplanes.live API details.
- `POCKETBASE_*` – URL and credentials for your PocketBase instance.
- `APPRISE_*` – Apprise API endpoint and notification URLs.
- `REFRESH_SECONDS`, `COOLDOWN_MINUTES`, `MAXIMUM_ALT` – tune the polling cadence and filtering.

## Running locally

```bash
npm start
```

This starts the scheduler defined in `clock.js`, which invokes the main application loop every `REFRESH_SECONDS` seconds.

To run the test suite:

```bash
npm test
```

## Docker deployment

`above-cville` ships with a production-ready `Dockerfile` and a `docker-compose.yml` tailored for Synology Container Manager. The stack launches PocketBase, Apprise-API, and the Node.js poller.

```yaml
services:
  pocketbase:
    image: pocketbase/pocketbase:0.21
    command: ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir", "/pb/pb_data"]
    ports:
      - "8090:8090"
    volumes:
      - ./pb_data:/pb/pb_data
    restart: unless-stopped

  apprise:
    image: caronc/apprise-api:latest
    environment:
      - APPRISE_STATEFUL_MODE=1
    ports:
      - "8000:8000"
    volumes:
      - ./apprise:/config
    restart: unless-stopped

  above-cville:
    build: .
    depends_on:
      - pocketbase
      - apprise
    environment:
      AIRPLANES_LIVE_KEY: "${AIRPLANES_LIVE_KEY}"
      AIRPLANES_LIVE_URL: "${AIRPLANES_LIVE_URL}"
      AIRPLANES_LIVE_LAT: "${AIRPLANES_LIVE_LAT}"
      AIRPLANES_LIVE_LON: "${AIRPLANES_LIVE_LON}"
      AIRPLANES_LIVE_RADIUS: "${AIRPLANES_LIVE_RADIUS}"
      POCKETBASE_URL: "http://pocketbase:8090"
      POCKETBASE_ADMIN_EMAIL: "${POCKETBASE_ADMIN_EMAIL}"
      POCKETBASE_ADMIN_PASSWORD: "${POCKETBASE_ADMIN_PASSWORD}"
      APPRISE_URL: "http://apprise:8000/notify"
      APPRISE_TARGETS: "${APPRISE_TARGETS}"
      REFRESH_SECONDS: "${REFRESH_SECONDS}"
      COOLDOWN_MINUTES: "${COOLDOWN_MINUTES}"
      MAXIMUM_ALT: "${MAXIMUM_ALT}"
    volumes:
      - ./storage:/app/storage:ro
    restart: unless-stopped
```

> Copy and paste the snippet above directly into Synology Container Manager. The `volumes` mount makes the optional `storage` datasets available inside the container if you downloaded them locally.

### Useful Synology tips

- **Environment files** – create a `.env` file alongside `docker-compose.yml` and Synology will automatically expose the variables in the UI.
- **Persistent storage** – PocketBase persists its SQLite database inside `./pb_data`. Back this up regularly.
- **Logs** – Container Manager surfaces logs from all services. The poller writes structured JSON for each aircraft processed.

## Configuration reference

| Variable | Description |
| --- | --- |
| `AIRPLANES_LIVE_KEY` | Optional airplanes.live API key for higher rate limits. |
| `AIRPLANES_LIVE_URL` | Base URL for the airplanes.live API (defaults to `https://api.airplanes.live/v2`). |
| `AIRPLANES_LIVE_LAT`, `AIRPLANES_LIVE_LON` | Centre point for the geofence. |
| `AIRPLANES_LIVE_RADIUS` | Search radius for the `point` endpoint (kilometres by default). |
| `PHOTO_API_URL` | Optional endpoint for fetching aircraft photos. |
| `PHOTO_API_USERNAME`, `PHOTO_API_PASSWORD` | Basic-auth credentials for the photo API. |
| `POCKETBASE_URL` | Base URL for your PocketBase instance. |
| `POCKETBASE_STATES_COLLECTION` | Collection name used to store aircraft sightings. |
| `POCKETBASE_IGNORED_COLLECTION` | Collection name for ignored operators. |
| `POCKETBASE_OPERATORS_COLLECTION` | Collection name for operator overrides. |
| `POCKETBASE_ADMIN_TOKEN` | PocketBase admin token (optional alternative to email/password). |
| `POCKETBASE_ADMIN_EMAIL`, `POCKETBASE_ADMIN_PASSWORD` | Credentials used when no token is supplied. |
| `POCKETBASE_CACHE_TTL_SECONDS` | Cache duration for operator/ignore data (set `0` to disable caching). |
| `APPRISE_URL` | Apprise-API endpoint (usually `http://apprise:8000/notify`). |
| `APPRISE_TARGETS` | Comma separated list of Apprise notification URLs. |
| `APPRISE_TAG` | Optional Apprise tag to include with each notification. |
| `APPRISE_TIMEOUT` | Timeout (ms) for Apprise requests. |
| `REFRESH_SECONDS` | Polling interval for the airplanes.live API. |
| `COOLDOWN_MINUTES` | Cooldown before re-notifying the same aircraft. |
| `MAXIMUM_ALT` | Ignore aircraft above this altitude (feet). |
| `HEALTHCHECK_URL` | Optional healthcheck ping URL. |

## Development notes

- The PocketBase client in `services/pocketbase.js` only uses HTTP APIs, making it easy to debug with any HTTP inspector.
- Notifications are sent through Apprise with optional attachments when a photo URL is available.
- Utility methods in `utils.js` have been simplified to remove heavy dependencies while keeping behaviour covered by unit tests.

## Inspiration

- [AboveTustin](https://github.com/kevinabrandon/AboveTustin) – ADS-B Twitter Bot that provided the original inspiration.
