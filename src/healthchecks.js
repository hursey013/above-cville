import config from './config.js';
import logger from './logger.js';

const buildPingUrl = (pingUrl, variant) => {
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

export const createHealthcheckNotifier = ({
  pingUrl = '',
  successIntervalSeconds = 0,
  fetchImpl = fetch,
  loggerInstance = logger,
  now = () => Date.now(),
} = {}) => {
  let lastSuccessPingAt = null;
  const successIntervalMs = Math.max(0, successIntervalSeconds) * 1000;

  const sendPing = async (variant, payload) => {
    const currentTime = now();

    if (
      variant === 'success' &&
      successIntervalMs > 0 &&
      lastSuccessPingAt !== null &&
      currentTime - lastSuccessPingAt < successIntervalMs
    ) {
      return;
    }

    const url = buildPingUrl(pingUrl, variant);
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
      const response = await fetchImpl(url, options);
      if (!response.ok) {
        loggerInstance.warn(
          {
            source: 'healthchecks',
            status: response.status,
            variant,
            url,
          },
          'Healthchecks ping failed',
        );
        return;
      }

      if (variant === 'success') {
        lastSuccessPingAt = currentTime;
      }
    } catch (error) {
      loggerInstance.warn(
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

  return {
    notifyHealthcheckSuccess: (payload) => sendPing('success', payload),
    notifyHealthcheckFailure: (payload) => sendPing('fail', payload),
  };
};

const notifier = createHealthcheckNotifier({
  pingUrl: config?.healthchecks?.pingUrl || '',
  successIntervalSeconds: config?.healthchecks?.successIntervalSeconds || 0,
});

export const notifyHealthcheckSuccess = notifier.notifyHealthcheckSuccess;
export const notifyHealthcheckFailure = notifier.notifyHealthcheckFailure;
