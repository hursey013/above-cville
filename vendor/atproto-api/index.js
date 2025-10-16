const textEncoder = new TextEncoder();

const toCodePointLength = (input) => Array.from(input).length;

const toByteLength = (input) => textEncoder.encode(input).length;

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
  } catch (error) {
    return null;
  }
};

export class RichText {
  constructor({ text = '' } = {}) {
    this.text = typeof text === 'string' ? text : '';
    this.facets = [];
  }

  get graphemeLength() {
    return toCodePointLength(this.text);
  }

  async detectFacets() {
    const matches = [];
    const urlPattern =
      /(?:https?:\/\/)[\w.-]+(?:\.[\w.-]+)+(?:[\w\-._~:/?#[\]@!$&'()*+,;=%]*)/gi;

    for (const match of this.text.matchAll(urlPattern)) {
      const uri = sanitizeUrl(match[0]);
      if (!uri) {
        continue;
      }
      if (match.index == null) {
        continue;
      }
      const byteStart = toByteLength(this.text.slice(0, match.index));
      const byteEnd = byteStart + toByteLength(match[0]);
      matches.push({
        index: {
          byteStart,
          byteEnd,
        },
        features: [
          {
            $type: 'app.bsky.richtext.facet#link',
            uri,
          },
        ],
      });
    }

    this.facets = matches;
    return matches;
  }
}

const resolveService = (service) => {
  if (typeof service !== 'string' || !service.trim()) {
    return 'https://bsky.social';
  }
  return service.trim().replace(/\/$/, '');
};

export class BskyAgent {
  constructor({ service } = {}) {
    this.service = resolveService(service);
    this.session = null;

    this.app = {
      bsky: {
        feed: {
          post: {
            create: async (params, record) =>
              this.#createRecord(params, record),
          },
        },
      },
    };
  }

  async login({ identifier, password }) {
    const id = typeof identifier === 'string' ? identifier.trim() : '';
    const pass = typeof password === 'string' ? password.trim() : '';

    if (!id || !pass) {
      throw new Error(
        'Identifier and app password are required for Bluesky login.',
      );
    }

    const response = await fetch(
      `${this.service}/xrpc/com.atproto.server.createSession`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: id, password: pass }),
      },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `Failed to create Bluesky session (${response.status}): ${text}`,
      );
    }

    const payload = await response.json();
    this.session = {
      did: payload.did,
      handle: payload.handle,
      accessJwt: payload.accessJwt,
      refreshJwt: payload.refreshJwt,
    };
    return this.session;
  }

  async post({ text, facets, embed }) {
    if (!this.session) {
      throw new Error('Must login before posting to Bluesky.');
    }

    const record = {
      $type: 'app.bsky.feed.post',
      text,
      facets,
      createdAt: new Date().toISOString(),
    };

    if (embed) {
      record.embed = embed;
    }

    return this.#createRecord({ repo: this.session.did }, record);
  }

  async uploadBlob(data, { encoding } = {}) {
    if (!this.session) {
      throw new Error('Must login before uploading Bluesky blobs.');
    }

    const contentType =
      typeof encoding === 'string' && encoding.trim()
        ? encoding.trim()
        : 'application/octet-stream';

    let body = null;
    if (data instanceof Uint8Array) {
      body = data;
    } else if (data instanceof ArrayBuffer) {
      body = new Uint8Array(data);
    } else if (ArrayBuffer.isView(data)) {
      body = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    } else {
      throw new Error('Unsupported blob data type.');
    }

    const response = await fetch(
      `${this.service}/xrpc/com.atproto.repo.uploadBlob`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.session.accessJwt}`,
          'Content-Type': contentType,
        },
        body,
      },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `Failed to upload Bluesky blob (${response.status}): ${text}`,
      );
    }

    const payload = await response.json();
    return { data: payload };
  }

  async #createRecord(params, record) {
    if (!this.session) {
      throw new Error('Must login before creating Bluesky records.');
    }

    const body = {
      repo: params?.repo ?? this.session.did,
      collection: 'app.bsky.feed.post',
      record,
    };

    const response = await fetch(
      `${this.service}/xrpc/com.atproto.repo.createRecord`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.session.accessJwt}`,
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `Failed to create Bluesky record (${response.status}): ${text}`,
      );
    }

    return response.json();
  }
}

export default {
  BskyAgent,
  RichText,
};
