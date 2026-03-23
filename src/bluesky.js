import { Buffer } from 'node:buffer';
import { BskyAgent, RichText } from '@atproto/api';
import logger from './logger.js';

const MAX_BSKY_CHARS = 300;
const MAX_IMAGE_BYTES = 976 * 1024; // Bluesky image uploads must stay under ~1 MB
const IMAGE_FETCH_HEADERS = {
  Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
  'User-Agent':
    'above-cville/2.0.0 (+https://github.com/hursey013/above-cville)',
};
const DEFAULT_IMAGE_ALT_TEXT = 'Recent aircraft photo';
const textEncoder = new TextEncoder();
const HASHTAG_PATTERN = /#[\p{L}\p{N}_]+/gu;

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

const normalizeServiceUrl = (value) => {
  const sanitized = sanitizeUrl(value);
  if (!sanitized) {
    return '';
  }

  try {
    const url = new URL(sanitized);
    if (url.hostname === 'bsky.app' || url.hostname === 'www.bsky.app') {
      return 'https://bsky.social';
    }
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/$/, '') || '/';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
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

const toByteLength = (value) => textEncoder.encode(value).length;

const appendHashtagFacets = (richText) => {
  if (!richText || typeof richText.text !== 'string') {
    return;
  }

  const text = richText.text;
  const existingFacets = Array.isArray(richText.facets) ? richText.facets : [];
  const seenRanges = new Set(
    existingFacets
      .map((facet) =>
        facet?.index ? `${facet.index.byteStart}:${facet.index.byteEnd}` : null,
      )
      .filter(Boolean),
  );

  for (const match of text.matchAll(HASHTAG_PATTERN)) {
    const hashtag = match[0];
    if (!hashtag || match.index == null) {
      continue;
    }
    const tag = hashtag.slice(1);
    if (!tag) {
      continue;
    }

    const byteStart = toByteLength(text.slice(0, match.index));
    const byteEnd = byteStart + toByteLength(hashtag);
    const rangeKey = `${byteStart}:${byteEnd}`;
    if (seenRanges.has(rangeKey)) {
      continue;
    }

    existingFacets.push({
      index: { byteStart, byteEnd },
      features: [
        {
          $type: 'app.bsky.richtext.facet#tag',
          tag,
        },
      ],
    });
    seenRanges.add(rangeKey);
  }

  richText.facets = existingFacets;
};

const normalizeAttachment = (attachment) => {
  if (typeof attachment === 'string') {
    const url = sanitizeUrl(attachment);
    return url ? { url, altText: null } : null;
  }

  if (attachment && typeof attachment === 'object') {
    const urlCandidate =
      attachment.url ??
      attachment.href ??
      attachment.src ??
      attachment.imageUrl ??
      null;
    const url = sanitizeUrl(urlCandidate);
    if (!url) {
      return null;
    }
    const rawAlt =
      typeof attachment.altText === 'string'
        ? attachment.altText
        : typeof attachment.alt === 'string'
          ? attachment.alt
          : null;
    const altText = rawAlt?.trim?.() ? rawAlt.trim() : null;
    return { url, altText };
  }

  return null;
};

const downloadImage = async (url) => {
  try {
    const response = await fetch(url, {
      headers: IMAGE_FETCH_HEADERS,
    });

    if (!response.ok) {
      return {
        image: null,
        reason: 'downloadFailed',
        details: { status: response.status },
      };
    }

    const mimeType = parseMimeType(response.headers?.get?.('content-type'));
    if (!mimeType || !mimeType.startsWith('image/')) {
      return {
        image: null,
        reason: 'invalidContentType',
        details: { mimeType },
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || !arrayBuffer.byteLength) {
      return {
        image: null,
        reason: 'emptyImage',
        details: {},
      };
    }

    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      return {
        image: null,
        reason: 'imageTooLarge',
        details: {
          byteLength: arrayBuffer.byteLength,
          maxBytes: MAX_IMAGE_BYTES,
        },
      };
    }

    const bytes = Buffer.from(arrayBuffer);
    return {
      image: { bytes, mimeType },
      reason: null,
      details: { byteLength: arrayBuffer.byteLength },
    };
  } catch (error) {
    return {
      image: null,
      reason: 'downloadError',
      details: { err: error },
    };
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

const createImageEmbed = async (agent, attachment) => {
  if (typeof agent?.uploadBlob !== 'function') {
    return null;
  }

  const url = attachment?.url;
  if (!url) {
    return null;
  }

  const download = await downloadImage(url);
  const image = download.image;
  if (!image) {
    logger.warn(
      {
        url,
        reason: download.reason,
        ...download.details,
      },
      'Falling back to external Bluesky card for attachment',
    );
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
          alt: attachment?.altText || DEFAULT_IMAGE_ALT_TEXT,
        },
      ],
    };
  } catch (error) {
    if (isExpiredTokenError(error)) {
      throw error;
    }
    logger.warn(
      {
        url,
        err: error,
      },
      'Failed to upload Bluesky image; falling back to external card',
    );
    return null;
  }
};

const buildEmbed = async (agent, attachments) => {
  if (!Array.isArray(attachments)) {
    return undefined;
  }
  for (const attachment of attachments) {
    const normalized = normalizeAttachment(attachment);
    if (normalized?.url) {
      const imageEmbed = await createImageEmbed(agent, normalized);
      if (imageEmbed) {
        return imageEmbed;
      }
      return createExternalEmbed(normalized.url);
    }
  }
  return undefined;
};

/**
 * Lazily authenticate against Bluesky and provide a simple `publish` helper.
 */
export const createPoster = ({
  service,
  identifier,
  appPassword,
  agentFactory = (serviceUrl) => new BskyAgent({ service: serviceUrl }),
} = {}) => {
  const handle = typeof identifier === 'string' ? identifier.trim() : '';
  const password = typeof appPassword === 'string' ? appPassword.trim() : '';
  const serviceUrl = normalizeServiceUrl(service);

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

    const trimmed = text.trim();

    const attemptPublish = async (attempt = 0) => {
      const agent = await resolveAgent();
      const richText = new RichText({ text: trimmed });

      try {
        await richText.detectFacets(agent);
        appendHashtagFacets(richText);

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

  return {
    publish,
  };
};

export default {
  createPoster,
};
