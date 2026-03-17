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
  <a href="#"><img src="https://healthchecks.io/b/2/a2827968-aa65-423c-b341-aaaf3479ec97.svg" alt="above-cville"></a>
  <a href="https://github.com/hursey013/above-cville/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-0EA5E9"></a>
  <a href="https://ghcr.io/hursey013/above-cville"><img alt="Image" src="https://img.shields.io/badge/ghcr-image-blue"></a>
</p>

## Say hello to above-cville

above-cville keeps a watch on aircraft traffic over Charlottesville, pinging [@abovecville](https://bsky.app/profile/abovecville.bsky.social) every time something fun zips by.

## What it does

- 🔁 **Real-time sweeps** – Polls either [airplanes.live](https://airplanes.live) or a local `readsb --net-api-port` endpoint on a configurable schedule and filters out repeat sightings with a cooldown timer.
- 🗣️ **Readable chatter** – 300-character Bluesky posts call out altitude, speed, direction, and how often we’ve seen the plane lately.
- 🪖 **Spot the cool stuff** – Military and “interesting” tags bubble up with their own little flourish when the upstream data includes them.
- 🖼️ **Photo flair** – If FlightAware or Planespotters.net has a current shot, above-cville will automatically embed it with the post.
- 📟 **Heartbeat-friendly** – Optionally pings Healthchecks.io at the start/end of each poll so you know the bot is still alive.

## What you need

- A place to run containers (Synology Container Manager, Portainer, Unraid, etc.).
- Access to either the public airplanes.live API or a local feeder exposing `readsb --net-api-port`.
- A Bluesky handle with an [app password](https://bsky.app/settings/app-passwords) that has posting access.

## Getting airborne fast

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
      AIRCRAFT_API_SOURCE: 'airplanes.live' # or 'readsb'
      AIRCRAFT_API_BASE: 'https://api.airplanes.live/v2' # e.g. http://feeder.local:30152 for readsb
      POLL_INTERVAL_SECONDS: '5' # How often to poll the aircraft API (minimum 1)
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

      # --- Photo sources ---
      PLANESPOTTERS_API_KEY: '' # Optional

      # --- Healthchecks.io heartbeat (optional) ---
      HEALTHCHECKS_PING_URL: '' # e.g. https://hc-ping.com/your-uuid

      # --- Details link ---
      AIRCRAFT_LINK_BASE: 'https://globe.airplanes.live/?icao=' # Link prefix appended with the ICAO hex
      SHOW_DETAILS_LINK: 'true'

      # --- Timezone for logs & cron output ---
      TZ: 'America/New_York'
    volumes:
      - ./data:/app/data
```

When you open the stack’s log viewer you’ll see JSON logs from Pino. A healthy startup looks a bit like:

```json
{
  "level": "info",
  "time": 1713811200000,
  "msg": "Watching location",
  "latitude": 38.0375,
  "longitude": -78.4863,
  "radiusNm": 5,
  "cooldownMinutes": 10,
  "pollIntervalSeconds": 5
}
```

Each time a plane clears the filters you’ll get another info log with `msg:"Bluesky update published"` plus the callsign, hex, altitude, and any attachments that went out.

---

## airplanes.live & contributing back

airplanes.live runs one of the largest independent, unfiltered ADS-B and MLAT tracking networks on the planet. Their open map, APIs, and data streams exist because thousands of volunteers share their receiver feeds—if you’re watching the skies with above-cville, consider giving a little data back.

### Fastest way to start feeding

- **Already have gear running?** Drop their feeder install script onto your existing Raspberry Pi or SDR box:

  ```bash
  curl -L -o /tmp/feed.sh https://raw.githubusercontent.com/airplanes-live/feed/main/install.sh
  sudo bash /tmp/feed.sh
  ```

  Once it finishes, check your status at [Airplanes.live MyFeed](https://airplanes.live/myfeed).

- **Building from scratch?** Their [hardware guide](https://airplanes.live/hardware/) and the bundled [Airplanes.live image](https://airplanes.live/image-guide/) walk through antennas, dongles, and flashing an SD card for a turnkey feeder.

Want more details? The [how-to-feed primer](https://airplanes.live/how-to-feed/) covers setup in five minutes, and the [feed client source](https://github.com/airplanes-live/feed) is open for tinkering. They’re also an active bunch—hop into the [Airplanes.live Discord](https://discord.gg/jfVRF2XRwF) if you need help or just want to geek out about traffic.

---

## License

above-cville is released under the [MIT License](./LICENSE).
