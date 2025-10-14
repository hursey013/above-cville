# Above Cville – Airplanes.live Spotter

A minimal, self-hosted Node.js service that polls the [airplanes.live](https://airplanes.live/api-guide/) `/point/{lat}/{lon}/{radius}` endpoint once per second and sends aircraft sighting notifications through [Apprise](https://github.com/caronc/apprise). All detections are persisted with a 20 minute cool down per aircraft so you can review which planes visit most frequently without being spammed.

## Features

- Polls airplanes.live every second (configurable) for aircraft within a configurable radius.
- Sends richly formatted notifications via Apprise for new aircraft or returning aircraft after a 20 minute cool down.
- Persists sightings and cool down timers to a local [lowdb](https://github.com/typicode/lowdb) JSON database.
- Includes a ready-to-run Docker Compose stack with Apprise for NAS/Container Manager deployments.

## Requirements

- Node.js 18+ (for native `fetch` and top-level `await`).
- Access to the public airplanes.live API.
- An Apprise server (the provided `docker-compose.yml` starts one for you).

## Configuration

Copy `.env.example` to `.env` and adjust the values:

```bash
cp .env.example .env
```

Key settings:

- `AIRPLANES_LAT`, `AIRPLANES_LON`, `AIRPLANES_RADIUS` – location and radius (in nautical miles) to monitor.
- `POLL_INTERVAL_SECONDS` – defaults to 1 second.
- `COOLDOWN_MINUTES` – defaults to 20 minutes between notifications for the same aircraft.
- `MAX_ALTITUDE_FT` – filters out aircraft above this pressure altitude (set ≤ 0 to disable).
- `APPRISE_API_URL` – URL to your Apprise API server (defaults to the service defined in the Docker Compose file).
- `APPRISE_URLS` – comma or newline separated list of Apprise target URLs (Discord, Gotify, SMTP, etc.). Leave blank when using a config key.
- `APPRISE_CONFIG_KEY` – optional Apprise configuration key. When set, all notifications are delivered via this key instead of direct URLs.
- `DATA_FILE` – path to the lowdb JSON file that stores sightings and cool down data.

## Running locally

```bash
npm install
npm start
```

The service logs notification activity to the console and writes persistent data to `.data/db.json` by default.

## Docker & NAS deployment

The included `docker-compose.yml` is tailored for home lab setups (Synology, Portainer, etc.). It builds the spotter service and launches an Apprise API container side-by-side.

```yaml
services:
  spotter:
    build: .
    env_file:
      - .env
    volumes:
      - spotter-data:/app/.data
    depends_on:
      - apprise
  apprise:
    image: caronc/apprise:latest
    ports:
      - "8000:8000"
    volumes:
      - apprise-config:/config
```

Steps:

1. Copy `.env.example` to `.env` and set your Apprise notification URLs.
2. (Optional) Edit `apprise-config/apprise.yml` once the container is created to define default notification URLs.
3. Run `docker compose up -d` (or import the stack into Synology Container Manager / Portainer).
4. Monitor the logs with `docker compose logs -f spotter`.

Persistent data lives in the `spotter-data` volume, so history survives container restarts. The Apprise configuration is stored in the `apprise-config` volume.

## Data model

The lowdb database stores a single collection:

- `sightings` – one record per ICAO hex with a `timestamps` array containing the epoch-millisecond moments when notifications were sent.

This compact structure keeps the JSON file small while still allowing later analysis of activity and ensuring cooldown enforcement is based on the most recent notification.

## Extending the project

- Integrate a lightweight web UI to browse the sightings log.
- Add optional filters (airlines, aircraft types, altitude ranges).
- Export aggregated statistics (e.g., most common tail numbers) as JSON or CSV.

Contributions and improvements are welcome!
