# Above Cville — Friendly Skies Watcher

Above Cville keeps an eye on the [airplanes.live](https://airplanes.live/api-guide/) feed around Charlottesville and pings you the moment an interesting aircraft drops in. Think of it as a neighborhood watch for the sky: zero fluff, lots of signal, and tuned for self-hosters who like notifications with personality. ✈️🛰️

---

## Highlights

- 🔁 **Real-time sweeps** – Polls airplanes.live on a tight schedule (configurable) and filters out repeat sightings with a cooldown timer.
- 🚫 **Carrier filter** – Skip the commercial heavy hitters by listing their ICAO codes directly in the compose snippet. Want only corporate jets and medevacs? Done.
- 🗣️ **Cheerful alerts** – Notifications read like a Bluesky post: speed, altitude, direction, and a quick note about how often the plane pops by.
- 🖼️ **Photo flair** – If FlightAware has a shot of the aircraft, the Bluesky post links it so readers can jump straight to the gallery.
- 🪶 **Featherweight** – Plain Node.js + [lowdb](https://github.com/typicode/lowdb) JSON storage. No external database, no message queues, no drama.
- 🐳 **Docker native** – Ships with a battle-tested compose file so you can drop it onto Synology, Portainer, or whatever box you call “the lab.”

---

## What you need

- A place to run containers (Synology Container Manager, Portainer, Unraid, etc.).
- Access to the public airplanes.live API.
- A Bluesky handle with an [app password](https://bsky.app/settings/app-passwords) that has posting access.

---

## Quick start (Portainer, Synology Container Manager, etc.)

1. Open your container UI and choose **Create stack / Project → Create** (the option that accepts Docker Compose).
2. Paste the snippet below into the editor.
3. Adjust the environment values inline (lat/lon, Bluesky credentials, timezone, ignored carriers, etc.).
4. Launch the stack. That’s it—no shell access needed.

<details open>
<summary><strong>Copy &amp; paste docker-compose.yml</strong></summary>

```yaml
services:
  above-cville:
    image: ghcr.io/hursey013/above-cville:latest
    restart: unless-stopped
    environment:
      # --- Location & polling ---
      AIRPLANES_LAT: "38.0375" # Latitude to monitor
      AIRPLANES_LON: "-78.4863" # Longitude to monitor
      AIRPLANES_RADIUS: "5" # Radius in nautical miles
      POLL_INTERVAL_SECONDS: "5" # How often to poll airplanes.live
      COOLDOWN_MINUTES: "10" # Minimum minutes between alerts per aircraft
      MAX_ALTITUDE_FT: "25000" # Ignore anything higher (set <=0 to disable)

      # --- Carrier filter (optional; leave blank to watch everything) ---
      IGNORE_CARRIERS: "AAL,ASH,AWI,DAL,EDV,JIA,PDT,UAL,ENY,RPA,SKW"

      # --- Storage path for sightings ---
      DATA_FILE: "data/db.json"

      # --- Bluesky connection ---
      BLUESKY_HANDLE: "your-handle.bsky.social"
      BLUESKY_APP_PASSWORD: "xxxx-xxxx-xxxx-xxxx"
      BLUESKY_SERVICE: "https://bsky.social" # Optional override for self-hosted PDS

      # --- Aircraft detail link ---
      AIRCRAFT_LINK_BASE: "https://globe.airplanes.live/?icao=" # Link prefix appended with the ICAO hex

      # --- Timezone for logs & cron output ---
      TZ: "America/New_York"
    volumes:
      - ./data:/app/data
```

</details>

When you open the stack’s log viewer you should see a line like:

```
Watching 38.0375, -78.4863 within 5 NM (cooldown: 10 minutes)
```

Each time a plane clears the filters you’ll get `[notify] <callsign>` followed by the friendly text that will be posted to Bluesky.

---

## Tips & FAQs

- **Carrier skips are optional.** Leave `IGNORE_CARRIERS` empty to watch everything.
- **Bluesky-ready tone.** Modify `composeNotificationMessage` in `src/messages.js` if you want to tweak phrasing or drop the emoji vibe.
- **FlightAware attachments.** The post includes the most recent FlightAware photo link as an external embed when available.
- **Details link.** Each alert ends with a tracker URL (defaults to globe.airplanes.live); change `AIRCRAFT_LINK_BASE` to point at your favourite viewer.
- **Restart-safe storage.** Sightings live in `data/db.json`. Delete the file if you want to reset history.
- **Timezones & cron.** Adjust `TZ` in Docker and your system timezone so log timestamps and notification timing make sense.

---

## Development notes

- Node 18+ is required for native `fetch`, top-level `await`, and the Node test runner.
- Run `npm test` to exercise helpers (message composer, Bluesky client, carrier filters, FlightAware scraper, utility functions).
- Run `npm run lint` for ESLint + Prettier (same setup as balance-bot) before opening a PR.
