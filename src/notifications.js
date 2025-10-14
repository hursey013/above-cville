import { sendAppriseMessage } from './apprise.js';

const formatPlaneTitle = (plane) => {
  const callsign = plane.flight ? plane.flight.trim() : null;
  const registration = plane.r ?? plane.registration;
  const name = callsign || registration || plane.hex?.toUpperCase() || 'Unknown aircraft';
  return `${name} spotted nearby`;
};

const formatPlaneBody = (plane) => {
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

  if (plane.alt_baro || plane.alt_geom) {
    const altitude = plane.alt_baro ?? plane.alt_geom;
    lines.push(`Altitude: ${altitude} ft`);
  }

  if (plane.gs) {
    lines.push(`Ground speed: ${Math.round(plane.gs)} kt`);
  }

  lines.push(`ICAO: ${plane.hex?.toUpperCase() ?? 'N/A'}`);

  return lines.join('\n');
};

export const sendAppriseNotification = async (plane) => {
  try {
    await sendAppriseMessage({
      title: formatPlaneTitle(plane),
      body: formatPlaneBody(plane)
    });
  } catch (error) {
    console.error('Failed to send Apprise notification', error);
  }
};

export default sendAppriseNotification;
