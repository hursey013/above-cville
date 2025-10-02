import config from './config.js';

const formatPlaneTitle = (plane) => {
  const callsign = plane.flight ? plane.flight.trim() : null;
  const registration = plane.r ?? plane.registration;
  const name = callsign || registration || plane.hex?.toUpperCase() || 'Unknown aircraft';
  return `${name} spotted nearby`;
};

const formatPlaneBody = (plane, distanceNm) => {
  const lines = [];

  if (plane.flight) {
    lines.push(`Flight: ${plane.flight.trim()}`);
  }

  if (plane.r) {
    lines.push(`Registration: ${plane.r}`);
  }

  if (plane.t) {
    lines.push(`Type: ${plane.t}`);
  }

  if (plane.sqk) {
    lines.push(`Squawk: ${plane.sqk}`);
  }

  if (plane.alt_baro || plane.alt_geom) {
    const altitude = plane.alt_baro ?? plane.alt_geom;
    lines.push(`Altitude: ${altitude} ft`);
  }

  if (plane.gs) {
    lines.push(`Ground speed: ${Math.round(plane.gs)} kt`);
  }

  if (typeof plane.lat === 'number' && typeof plane.lon === 'number') {
    lines.push(`Position: ${plane.lat.toFixed(4)}, ${plane.lon.toFixed(4)}`);
  }

  if (typeof distanceNm === 'number') {
    lines.push(`Distance: ${distanceNm.toFixed(2)} NM`);
  }

  lines.push(`ICAO: ${plane.hex?.toUpperCase() ?? 'N/A'}`);

  return lines.join('\n');
};

export const sendAppriseNotification = async (plane, distanceNm) => {
  if (!config.apprise.apiUrl) {
    console.warn('Apprise API URL is not configured; skipping notification');
    return;
  }

  const payload = {
    title: formatPlaneTitle(plane),
    body: formatPlaneBody(plane, distanceNm)
  };

  if (config.apprise.targets.length) {
    payload.urls = config.apprise.targets;
  }

  try {
    const response = await fetch(config.apprise.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Failed to send Apprise notification', response.status, text);
    }
  } catch (error) {
    console.error('Error sending Apprise notification', error);
  }
};

export default sendAppriseNotification;
