import config from './config.js';
import logger from './logger.js';

const pingUrl = config?.healthchecks?.pingUrl || '';

const buildPingUrl = (variant) => {
  if (!pingUrl) {
    return null;
  }
  switch (variant) {
    case 'start':
      return `${pingUrl}/start`;
    case 'fail':
      return `${pingUrl}/fail`;
    case 'success':
    default:
      return pingUrl;
  }
};

const sendPing = async (variant, payload) => {
  const url = buildPingUrl(variant);
  if (!url) {
    return;
  }

  const hasPayload =
    payload && typeof payload === 'object' && Object.keys(payload).length > 0;
  const options = hasPayload
    ? {
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    : {
        method: 'get',
      };

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      logger.warn(
        {
          source: 'healthchecks',
          status: response.status,
          variant,
          url,
        },
        'Healthchecks ping failed',
      );
    }
  } catch (error) {
    logger.warn(
      {
        source: 'healthchecks',
        variant,
        url,
        err: error,
      },
      'Healthchecks ping threw',
    );
  }
};

export const notifyHealthcheckStart = () => sendPing('start');

export const notifyHealthcheckSuccess = (payload) =>
  sendPing('success', payload);

export const notifyHealthcheckFailure = (payload) => sendPing('fail', payload);

export default {
  notifyHealthcheckStart,
  notifyHealthcheckSuccess,
  notifyHealthcheckFailure,
};
