import config from './config.js';
import { trimTrailingSlash } from './utils.js';

const sanitizeUrls = (list) =>
  Array.isArray(list)
    ? Array.from(
        new Set(
          list
            .map((value) => (typeof value === 'string' ? value.trim() : ''))
            .filter(Boolean)
        )
      )
    : [];

const postNotification = async ({ appriseApiUrl, urls, title, body, attachments }) => {
  const payload = {
    title,
    body
  };

  if (Array.isArray(urls) && urls.length) {
    payload.urls = urls;
  }

  if (Array.isArray(attachments) && attachments.length) {
    payload.attachments = attachments;
  }

  const response = await fetch(appriseApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let errorBody = '';
    try {
      errorBody = await response.text();
    } catch {
      errorBody = '(unable to read response body)';
    }
    throw new Error(`Apprise notification failed with status ${response.status}: ${errorBody}`);
  }
};

export const createAppriseClient = ({ apiUrl, urls = [], configKey = '' }) => {
  if (!apiUrl) {
    throw new Error('Apprise API URL is required');
  }

  const baseUrl = trimTrailingSlash(apiUrl);
  const defaultUrls = sanitizeUrls(urls);
  const defaultKey = typeof configKey === 'string' ? configKey.trim() : '';

  const send = async ({ title, body, attachments, urls: overrideUrls, configKey: overrideKey }) => {
    const targets = sanitizeUrls(
      overrideUrls !== undefined ? overrideUrls : defaultUrls
    );
    const key =
      typeof overrideKey === 'string' && overrideKey.trim()
        ? overrideKey.trim()
        : defaultKey;

    if (!targets.length && !key) {
      throw new Error('No Apprise destination provided for notification.');
    }

    const endpoint = key ? `${baseUrl}/${encodeURIComponent(key)}` : baseUrl;

    await postNotification({
      appriseApiUrl: endpoint,
      urls: key ? undefined : targets,
      title,
      body,
      attachments
    });
  };

  return { send };
};

let appriseClient = null;

try {
  appriseClient = createAppriseClient(config.apprise);
} catch (error) {
  console.warn(`Apprise notifications disabled: ${error.message}`);
}

export const sendAppriseMessage = async (payload) => {
  if (!appriseClient) {
    return;
  }

  await appriseClient.send({
    urls: config.apprise.urls,
    configKey: config.apprise.configKey,
    ...payload
  });
};

export default {
  send: sendAppriseMessage
};
