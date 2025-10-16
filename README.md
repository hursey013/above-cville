<p align="center">
  <picture>
    <img alt="Above Cville logo" src="assets/logo.svg" width="160" height="160">
  </picture>
</p>

<h1 align="center">above-cville</h1>

<p align="center">
  What's flying over the City of Charlottesville, Virginia? 
</p>

<p align="center">
  <a href="https://github.com/hursey013/above-cville/actions"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/hursey013/above-cville/ci.yml?label=CI&logo=github"></a>
  <a href="https://github.com/hursey013/above-cville/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-0EA5E9"></a>
  <a href="https://ghcr.io/hursey013/above-cville"><img alt="Image" src="https://img.shields.io/badge/ghcr-image-blue"></a>
</p>

## Say hello to above-cville

Keeping an eye on the [airplanes.live](https://airplanes.live) feed around Charlottesville and pings you the moment an interesting aircraft drops in.

## Highlights

- 🔁 **Real-time sweeps** – Polls airplanes.live on a tight schedule (configurable) and filters out repeat sightings with a cooldown timer.
- 🚫 **Carrier filter** – Skip the commercial heavy hitters by listing their ICAO codes directly in the compose snippet.
- 🗣️ **Fun alerts** – Notifications read like a Bluesky post: speed, altitude, direction, and a quick note about how often the plane pops by.
- 🖼️ **Photo flair** – If FlightAware has a shot of the aircraft, the Bluesky post automatically embeds it.

---

## What you need

- A place to run containers (Synology Container Manager, Portainer, Unraid, etc.).
- Access to the public airplanes.live API.
- A Bluesky handle with an [app password](https://bsky.app/settings/app-passwords) that has posting access.

---

## Quick start

```yaml
services:
  above-cville:
    image: ghcr.io/hursey013/above-cville:latest
    restart: unless-stopped
    environment:
      # --- Location & polling ---
      AIRPLANES_LAT: '38.0375' # Latitude to monitor
      AIRPLANES_LON: '-78.4863' # Longitude to monitor
      AIRPLANES_RADIUS: '5' # Radius in nautical miles
      POLL_INTERVAL_SECONDS: '5' # How often to poll airplanes.live
      COOLDOWN_MINUTES: '10' # Minimum minutes between alerts per aircraft
      MAX_ALTITUDE_FT: '25000' # Ignore anything higher (set <=0 to disable)

      # --- Carrier filter (optional; leave blank to watch everything) ---
      IGNORE_CARRIERS: 'AAL,ASH,AWI,DAL,EDV,JIA,PDT,UAL,ENY,RPA,SKW'

      # --- Storage path for sightings ---
      DATA_FILE: 'data/db.json'

      # --- Bluesky connection ---
      BLUESKY_HANDLE: 'your-handle.bsky.social'
      BLUESKY_APP_PASSWORD: 'xxxx-xxxx-xxxx-xxxx'
      BLUESKY_SERVICE: 'https://bsky.social' # Optional override for self-hosted PDS

      # --- Aircraft detail link ---
      AIRCRAFT_LINK_BASE: 'https://globe.airplanes.live/?icao=' # Link prefix appended with the ICAO hex

      # --- Timezone for logs & cron output ---
      TZ: 'America/New_York'
    volumes:
      - ./data:/app/data
```

When you open the stack’s log viewer you should see a line like:

```
Watching 38.0375, -78.4863 within 5 NM (cooldown: 10 minutes)
```

Each time a plane clears the filters you’ll get `[notify] <callsign>` followed by the friendly text that will be posted to Bluesky.
