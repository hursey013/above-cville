import { BskyAgent, RichText } from '@atproto/api';

import config from './config.js';

const MAX_BSKY_CHARS = 300;

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

const buildEmbed = (attachments) => {
  if (!Array.isArray(attachments)) {
    return undefined;
  }
  for (const attachment of attachments) {
    const url = sanitizeUrl(attachment);
    if (url) {
      return {
        $type: 'app.bsky.embed.external',
        external: {
          uri: url,
          title: 'FlightAware photo',
          description: 'Latest photo for this aircraft.',
        },
      };
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

    const agent = await resolveAgent();

    const trimmed = text.trim();
    const richText = new RichText({ text: trimmed });
    await richText.detectFacets(agent);

    if (richText.graphemeLength > MAX_BSKY_CHARS) {
      throw new Error('Bluesky post exceeds the 300 character limit.');
    }

    const embed = buildEmbed(attachments);

    await agent.post({
      text: richText.text,
      facets: richText.facets,
      embed,
    });
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
