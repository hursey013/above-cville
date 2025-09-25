"use strict";

const { serializeError } = require("serialize-error");

const { pocketbase } = require("../config");
const { createClient, HttpError } = require("./http");

const createArraySnapshot = (value = []) => ({
  exists: () => Array.isArray(value) && value.length > 0,
  val: () => value
});

const createObjectSnapshot = (value = {}) => ({
  exists: () => Boolean(value && Object.keys(value).length),
  val: () => value
});

const createStateSnapshot = record => ({
  exists: () => Boolean(record),
  val: () =>
    record
      ? {
          timestamps: Array.isArray(record.timestamps)
            ? record.timestamps
            : record.timestamps
            ? Object.values(record.timestamps)
            : []
        }
      : null
});

class PocketBaseService {
  constructor(config) {
    this.config = {
      ...config,
      cacheTtlMs: Number.isFinite(config.cacheTtlMs) ? config.cacheTtlMs : 0
    };
    this.token = config.adminToken || null;
    this.http = createClient({
      baseUrl: config.baseUrl,
      timeout: config.requestTimeout,
      headers: { Accept: "application/json" }
    });
    this.cache = new Map();
    this.initPromise = null;
  }

  async init() {
    if (this.initPromise) return this.initPromise;

    if (!this.config.baseUrl) {
      throw new Error("PocketBase baseUrl is not configured");
    }

    this.initPromise = (async () => {
      if (this.token) return this.token;

      if (this.config.adminEmail && this.config.adminPassword) {
        const data = await this.http.request({
          method: "POST",
          path: "/api/admins/auth-with-password",
          data: {
            identity: this.config.adminEmail,
            password: this.config.adminPassword
          }
        });

        this.token = data && data.token;
        if (!this.token) {
          throw new Error("PocketBase authentication did not return a token");
        }

        return this.token;
      }

      throw new Error(
        "PocketBase credentials are required. Provide either POCKETBASE_ADMIN_TOKEN or POCKETBASE_ADMIN_EMAIL/POCKETBASE_ADMIN_PASSWORD."
      );
    })();

    return this.initPromise;
  }

  async request(options) {
    await this.init();

    try {
      return await this.http.request({
        ...options,
        headers: {
          ...(options.headers || {}),
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {})
        }
      });
    } catch (error) {
      // Retry once on unauthorized errors to refresh the token
      if (error instanceof HttpError && error.status === 401) {
        this.token = null;
        this.initPromise = null;
        await this.init();
        return this.request(options);
      }

      throw error;
    }
  }

  async fetchAll(collection) {
    try {
      const results = [];
      let page = 1;
      let totalPages = 1;

      do {
        const data = await this.request({
          method: "GET",
          path: `/api/collections/${collection}/records`,
          params: { page, perPage: 200 }
        });

        results.push(...(data.items || []));
        totalPages = data.totalPages || 1;
        page += 1;
      } while (page <= totalPages);

      return results;
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        return [];
      }

      throw error;
    }
  }

  getCachedValue(key) {
    if (!this.config.cacheTtlMs) return null;

    const entry = this.cache.get(key);

    if (!entry) return null;

    if (entry.expiresAt && entry.expiresAt > Date.now()) {
      return entry.value;
    }

    this.cache.delete(key);
    return null;
  }

  setCachedValue(key, value) {
    if (!this.config.cacheTtlMs) return;

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.config.cacheTtlMs
    });
  }

  async getIgnoredOperatorsSnapshot() {
    const cached = this.getCachedValue("ignored");
    if (cached) {
      return createArraySnapshot(cached);
    }

    const records = await this.fetchAll(this.config.ignoredCollection);
    const ignored = records
      .map(record =>
        [record.code, record.opicao, record.operator]
          .flat()
          .find(value => typeof value === "string")
      )
      .filter(Boolean)
      .map(value => value.toUpperCase());

    const unique = [...new Set(ignored)];
    this.setCachedValue("ignored", unique);

    return createArraySnapshot(unique);
  }

  async getOperatorsSnapshot() {
    const cached = this.getCachedValue("operators");
    if (cached) {
      return createObjectSnapshot(cached);
    }

    const records = await this.fetchAll(this.config.operatorsCollection);

    const result = records.reduce(
      (accumulator, record) => {
        const name =
          record.name || record.operator || record.description || record.value;
        const icao =
          record.icao || record.hex || record.icao24 || record.registration;
        const opicao = record.opicao || record.code;

        if (name && icao) {
          accumulator.icao[icao.toUpperCase()] = name;
        }

        if (name && opicao) {
          accumulator.opicao[opicao.toUpperCase()] = name;
        }

        return accumulator;
      },
      { icao: {}, opicao: {} }
    );

    this.setCachedValue("operators", result);

    return createObjectSnapshot(result);
  }

  async fetchState(hex) {
    if (!hex) {
      return { record: null, snapshot: createStateSnapshot(null) };
    }

    const formattedHex = hex.toUpperCase();

    try {
      const data = await this.request({
        method: "GET",
        path: `/api/collections/${this.config.statesCollection}/records`,
        params: {
          filter: `hex="${formattedHex}"`,
          perPage: 1
        }
      });

      const record = data.items && data.items[0];
      return { record, snapshot: createStateSnapshot(record) };
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        return { record: null, snapshot: createStateSnapshot(null) };
      }

      throw error;
    }
  }

  async saveTimestamp(hex, time, record) {
    if (!hex) return null;

    const formattedHex = hex.toUpperCase();
    const timestamps = Array.isArray(record && record.timestamps)
      ? [...record.timestamps, time]
      : [time];

    try {
      if (record && record.id) {
        await this.request({
          method: "PATCH",
          path: `/api/collections/${this.config.statesCollection}/records/${record.id}`,
          data: { hex: formattedHex, timestamps }
        });
      } else {
        await this.request({
          method: "POST",
          path: `/api/collections/${this.config.statesCollection}/records`,
          data: { hex: formattedHex, timestamps }
        });
      }

      return timestamps;
    } catch (error) {
      throw new Error(
        `Failed to persist timestamp for ${formattedHex}: ${JSON.stringify(
          serializeError(error)
        )}`
      );
    }
  }
}

module.exports = new PocketBaseService(pocketbase);
module.exports.createArraySnapshot = createArraySnapshot;
module.exports.createObjectSnapshot = createObjectSnapshot;
module.exports.createStateSnapshot = createStateSnapshot;
