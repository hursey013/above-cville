# Above Cville — Friendly Skies Watcher

Above Cville keeps an eye on the [airplanes.live](https://airplanes.live/api-guide/) feed around Charlottesville and pings you the moment an interesting aircraft drops in. Think of it as a neighborhood watch for the sky: zero fluff, lots of signal, and tuned for self-hosters who like notifications with personality. ✈️🛰️

---

## Highlights

- 🔁 **Real-time sweeps** – Polls airplanes.live on a tight schedule (configurable) and filters out repeat sightings with a cooldown timer.
- 🚫 **Carrier filter** – Skip the commercial heavy hitters by listing their ICAO codes directly in the compose snippet. Want only corporate jets and medevacs? Done.
- 🗣️ **Cheerful alerts** – Notifications read like a Bluesky post: speed, altitude, direction, and a quick note about how often the plane pops by.
- 🖼️ **Photo flair** – If FlightAware has a shot of the aircraft, the link is attached so your Apprise target (Pushover, Discord, etc.) can grab it.
- 🪶 **Featherweight** – Plain Node.js + [lowdb](https://github.com/typicode/lowdb) JSON storage. No external database, no message queues, no drama.
- 🐳 **Docker native** – Ships with a battle-tested compose file so you can drop it onto Synology, Portainer, or whatever box you call “the lab.”

---

## What you need

- A place to run containers (Synology Container Manager, Portainer, Unraid, etc.).
- Access to the public airplanes.live API.
- An [Apprise](https://github.com/caronc/apprise) endpoint (self-hosted or bundled with the compose file).
- A target inside Apprise (Pushover/Discord/email/etc.) so the alerts land somewhere fun.

---

## Quick start (Portainer, Synology Container Manager, etc.)

1. Open your container UI and choose **Create stack / Project → Create** (the option that accepts Docker Compose).
2. Paste the snippet below into the editor.
3. Adjust the environment values inline (lat/lon, Apprise URL, timezone, ignored carriers, etc.).
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

      # --- Apprise connection ---
      APPRISE_API_URL: "http://apprise:8000/notify"
      APPRISE_CONFIG_KEY: "" # Provide if your Apprise API uses keyed endpoints
      APPRISE_URLS: "" # Stateless mode: comma-separated target URLs

      # --- Timezone for logs & cron output ---
      TZ: "America/New_York"
    volumes:
      - ./data:/app/data
    depends_on:
      - apprise

  apprise:
    image: lscr.io/linuxserver/apprise-api:latest
    restart: unless-stopped
    environment:
      PUID: "1026" # adjust to match your user
      PGID: "100"
      TZ: America/New_York
    volumes:
      - ./apprise-config:/config
    ports:
      - "8000:8000"
```

</details>

When you open the stack’s log viewer you should see a line like:

```
Watching 38.0375, -78.4863 within 5 NM (cooldown: 10 minutes)
```

Each time a plane clears the filters you’ll get `[notify] <callsign>` followed by the friendly message in your configured Apprise destinations.

---

## Tips & FAQs

- **Carrier skips are optional.** Leave `IGNORE_CARRIERS` empty to watch everything.
- **Bluesky-ready tone.** Modify `composeNotificationMessage` in `src/messages.js` if you want to tweak phrasing or drop the emoji vibe.
- **FlightAware attachments.** The notification includes the most recent FlightAware photo link when available.
- **Restart-safe storage.** Sightings live in `data/db.json`. Delete the file if you want to reset history.
- **Timezones & cron.** Adjust `TZ` in Docker and your system timezone so log timestamps and Apprise attachments make sense.
