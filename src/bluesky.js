import { Buffer } from 'node:buffer';
import { BskyAgent, RichText } from '@atproto/api';

import config from './config.js';

const MAX_BSKY_CHARS = 300;
const MAX_IMAGE_BYTES = 976 * 1024; // Bluesky image uploads must stay under ~1 MB
const IMAGE_FETCH_HEADERS = {
  Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
  'User-Agent':
    'above-cville/2.0.0 (+https://github.com/hursey013/above-cville)',
};
const IMAGE_ALT_TEXT = 'Recent aircraft photo';

const isExpiredTokenError = (error) => {
  const responseData = error?.response?.data;
  const code =
    responseData?.error ?? error?.data?.error ?? error?.error ?? null;
  if (code === 'ExpiredToken') {
    return true;
  }
  const message =
    responseData?.message ?? error?.message ?? error?.toString?.() ?? '';
  return typeof message === 'string' && message.includes('ExpiredToken');
};

const sanitizeUrl = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
};

const parseMimeType = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const [primary] = value.split(';');
  const trimmed = primary.trim().toLowerCase();
  return trimmed || null;
};

const downloadImage = async (url) => {
  try {
    const response = await fetch(url, {
      headers: IMAGE_FETCH_HEADERS,
    });

    if (!response.ok) {
      return null;
    }

    const mimeType = parseMimeType(response.headers?.get?.('content-type'));
    if (!mimeType || !mimeType.startsWith('image/')) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || !arrayBuffer.byteLength) {
      return null;
    }

    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      return null;
    }

    const bytes = Buffer.from(arrayBuffer);
    return { bytes, mimeType };
  } catch (error) {
    console.warn(`Failed to download attachment from ${url}`, error);
    return null;
  }
};

const createExternalEmbed = (url) => ({
  $type: 'app.bsky.embed.external',
  external: {
    uri: url,
    title: 'FlightAware photo',
    description: 'Latest photo for this aircraft.',
  },
});

const createImageEmbed = async (agent, url) => {
  if (typeof agent?.uploadBlob !== 'function') {
    return null;
  }

  const image = await downloadImage(url);
  if (!image) {
    return null;
  }

  try {
    const upload = await agent.uploadBlob(image.bytes, {
      encoding: image.mimeType,
    });
    const blob = upload?.data?.blob ?? upload?.blob ?? null;
    if (!blob) {
      return null;
    }

    return {
      $type: 'app.bsky.embed.images',
      images: [
        {
          image: blob,
          alt: IMAGE_ALT_TEXT,
        },
      ],
    };
  } catch (error) {
    if (isExpiredTokenError(error)) {
      throw error;
    }
    console.warn(`Failed to upload Bluesky image for ${url}`, error);
    return null;
  }
};

const buildEmbed = async (agent, attachments) => {
  if (!Array.isArray(attachments)) {
    return undefined;
  }
  for (const attachment of attachments) {
    const url = sanitizeUrl(attachment);
    if (url) {
      const imageEmbed = await createImageEmbed(agent, url);
      if (imageEmbed) {
        return imageEmbed;
      }
      return createExternalEmbed(url);
    }
  }
  return undefined;
};

export const createPoster = ({
  service,
  identifier,
  appPassword,
  agentFactory = (serviceUrl) => new BskyAgent({ service: serviceUrl }),
} = {}) => {
  const handle = typeof identifier === 'string' ? identifier.trim() : '';
  const password = typeof appPassword === 'string' ? appPassword.trim() : '';
  const serviceUrl = typeof service === 'string' ? service.trim() : '';

  if (!handle || !password) {
    throw new Error('Bluesky handle and app password are required.');
  }

  let agentPromise = null;

  const resolveAgent = async () => {
    if (!agentPromise) {
      agentPromise = (async () => {
        const agent = agentFactory(serviceUrl || undefined);
        await agent.login({ identifier: handle, password });
        return agent;
      })();
    }
    return agentPromise;
  };

  const publish = async ({ text, attachments } = {}) => {
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('Bluesky post text is required.');
    }

    const attemptPublish = async (attempt = 0) => {
      const agent = await resolveAgent();
      const trimmed = text.trim();
      const richText = new RichText({ text: trimmed });

      try {
        await richText.detectFacets(agent);

        if (richText.graphemeLength > MAX_BSKY_CHARS) {
          throw new Error('Bluesky post exceeds the 300 character limit.');
        }

        const embed = await buildEmbed(agent, attachments);

        await agent.post({
          text: richText.text,
          facets: richText.facets,
          embed,
        });
      } catch (error) {
        if (attempt === 0 && isExpiredTokenError(error)) {
          agentPromise = null;
          return attemptPublish(attempt + 1);
        }
        throw error;
      }
    };

    await attemptPublish();
  };

  return { publish };
};

let poster = null;

try {
  poster = createPoster({
    service: config.bluesky.service,
    identifier: config.bluesky.handle,
    appPassword: config.bluesky.appPassword,
  });
} catch (error) {
  console.warn(`Bluesky posting disabled: ${error.message}`);
}

export const publishBlueskyPost = async (payload) => {
  if (!poster) {
    return;
  }

  await poster.publish(payload);
};

export default {
  createPoster,
  publish: publishBlueskyPost,
};
