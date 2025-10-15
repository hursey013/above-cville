import config from './config.js';
import { trimTrailingSlash } from './utils.js';

/**
 * Ensure we work with a deduplicated, trimmed list of URLs.
 * @param {unknown} list
 * @returns {string[]}
 */
const sanitizeUrls = (list) =>
  Array.isArray(list)
    ? Array.from(
        new Set(
          list
            .map((value) => (typeof value === 'string' ? value.trim() : ''))
            .filter(Boolean),
        ),
      )
    : [];

/**
 * Build a minimal Apprise API client that knows how to switch between JSON and multipart payloads.
 * @param {{ apiUrl: string, urls?: string[], configKey?: string }} params
 * @returns {{ send: (payload: { title?: string, body?: string, attachments?: string[], urls?: string[], configKey?: string }) => Promise<void> }}
 */
export const createNotifier = ({ apiUrl, urls = [], configKey = '' }) => {
  if (!apiUrl) {
    throw new Error('Apprise API URL is required');
  }

  const baseUrl = trimTrailingSlash(apiUrl);
  const defaultUrls = sanitizeUrls(urls);
  const defaultKey = typeof configKey === 'string' ? configKey.trim() : '';

  /**
   * Dispatch a notification to Apprise.
   * @param {{ title?: string, body?: string, attachments?: string[], urls?: string[], configKey?: string }} param0
   * @returns {Promise<void>}
   */
  const sendNotification = async ({
    title,
    body,
    attachments,
    urls: overrideUrls,
    configKey: overrideKey,
  }) => {
    const targets = sanitizeUrls(
      overrideUrls !== undefined ? overrideUrls : defaultUrls,
    );
    const key =
      typeof overrideKey === 'string' && overrideKey.trim()
        ? overrideKey.trim()
        : defaultKey;

    if (!targets.length && !key) {
      throw new Error('No Apprise destination provided for notification.');
    }

    const endpoint = key ? `${baseUrl}/${encodeURIComponent(key)}` : baseUrl;

    const hasAttachments = Array.isArray(attachments) && attachments.length;

    if (!hasAttachments) {
      const payload = {
        title,
        body,
      };
      if (!key && targets.length) {
        payload.urls = targets;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(
          `Apprise notification failed with status ${response.status}: ${text}`,
        );
      }

      return;
    }

    const form = new FormData();

    if (!key && targets.length) {
      form.append('urls', targets.join(','));
    }

    if (title) {
      form.append('title', title);
    }

    if (body) {
      form.append('body', body);
    }

    for (const attachment of attachments) {
      if (typeof attachment === 'string' && attachment.trim()) {
        form.append('attachment', attachment.trim());
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      body: form,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `Apprise notification failed with status ${response.status}: ${text}`,
      );
    }
  };

  return { sendNotification };
};

let appriseClient = null;

try {
  appriseClient = createNotifier(config.apprise);
} catch (error) {
  console.warn(`Apprise notifications disabled: ${error.message}`);
}

export const sendAppriseNotification = async (payload) => {
  if (!appriseClient) {
    return;
  }

  await appriseClient.sendNotification({
    urls: config.apprise.urls,
    configKey: config.apprise.configKey,
    ...payload,
  });
};

export default {
  createNotifier,
  sendNotification: sendAppriseNotification,
};
