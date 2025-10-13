import { sendAppriseMessage } from './apprise.js';

const escapeHtml = (value) =>
  value
    ?.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;') ?? '';

const formatPlaneTitle = (plane) => {
  const callsign = plane.flight ? plane.flight.trim() : null;
  const registration = plane.r ?? plane.registration;
  const name = callsign || registration || plane.hex?.toUpperCase() || 'Unknown aircraft';
  return `${name} spotted nearby`;
};

const formatPlaneBody = (plane, distanceNm) => {
  const lines = [];

  if (plane.flight) {
    lines.push(`<strong>Flight:</strong> ${escapeHtml(plane.flight.trim())}`);
  }

  if (plane.r) {
    lines.push(`<strong>Registration:</strong> ${escapeHtml(plane.r)}`);
  }

  if (plane.t) {
    lines.push(`<strong>Type:</strong> ${escapeHtml(plane.t)}`);
  }

  if (plane.sqk) {
    lines.push(`<strong>Squawk:</strong> ${escapeHtml(plane.sqk)}`);
  }

  if (plane.alt_baro || plane.alt_geom) {
    const altitude = plane.alt_baro ?? plane.alt_geom;
    lines.push(`<strong>Altitude:</strong> ${escapeHtml(`${altitude} ft`)}`);
  }

  if (plane.gs) {
    lines.push(`<strong>Ground speed:</strong> ${escapeHtml(`${Math.round(plane.gs)} kt`)}`);
  }

  if (typeof plane.lat === 'number' && typeof plane.lon === 'number') {
    lines.push(
      `<strong>Position:</strong> ${escapeHtml(`${plane.lat.toFixed(4)}, ${plane.lon.toFixed(4)}`)}`
    );
  }

  if (typeof distanceNm === 'number') {
    lines.push(`<strong>Distance:</strong> ${escapeHtml(`${distanceNm.toFixed(2)} NM`)}`);
  }

  lines.push(`<strong>ICAO:</strong> ${escapeHtml(plane.hex?.toUpperCase() ?? 'N/A')}`);

  return lines.join('<br>');
};

export const sendAppriseNotification = async (plane, distanceNm) => {
  try {
    await sendAppriseMessage({
      title: formatPlaneTitle(plane),
      body: formatPlaneBody(plane, distanceNm)
    });
  } catch (error) {
    console.error('Failed to send Apprise notification', error);
  }
};

export default sendAppriseNotification;
