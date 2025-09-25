"use strict";

const { URL } = require("url");

if (typeof global.fetch !== "function") {
  throw new Error(
    "Fetch API is not available in this runtime. Please upgrade Node.js to v18 or newer."
  );
}

const fetchFn = global.fetch.bind(global);

class HttpError extends Error {
  constructor(message, { status = null, data = null } = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.data = data;
  }
}

const isPlainObject = value =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  !(value instanceof Buffer) &&
  typeof value.pipe !== "function";

const buildUrl = ({ baseUrl, path, url, params }) => {
  const target = url
    ? new URL(url)
    : new URL(path || "", baseUrl);

  if (params && typeof params === "object") {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        target.searchParams.append(key, value);
      }
    });
  }

  return target;
};

const parseResponseBody = async response => {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const text = await response.text();
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch (error) {
      return text;
    }
  }

  return response.text().catch(() => null);
};

const request = async ({
  baseUrl,
  path,
  url,
  method = "GET",
  headers = {},
  params,
  data,
  timeout
} = {}) => {
  if (!url && !baseUrl) {
    throw new Error("An absolute URL or baseUrl is required");
  }

  const target = buildUrl({ baseUrl, path, url, params });
  const controller = timeout ? new AbortController() : null;
  const timer = timeout
    ? setTimeout(() => controller.abort(), timeout)
    : null;

  const finalHeaders = { ...headers };
  let body = data;

  if (isPlainObject(data)) {
    body = JSON.stringify(data);
    if (!finalHeaders["Content-Type"]) {
      finalHeaders["Content-Type"] = "application/json";
    }
  }

  try {
    const response = await fetchFn(target, {
      method,
      headers: finalHeaders,
      body,
      signal: controller ? controller.signal : undefined
    });

    if (timer) clearTimeout(timer);

    const parsedBody = await parseResponseBody(response);

    if (!response.ok) {
      throw new HttpError(`Request failed with status ${response.status}`, {
        status: response.status,
        data: parsedBody
      });
    }

    return parsedBody;
  } catch (error) {
    if (timer) clearTimeout(timer);

    if (error.name === "AbortError") {
      throw new HttpError("Request timed out", { status: 408 });
    }

    throw error;
  }
};

const createClient = ({ baseUrl, headers = {}, timeout } = {}) => ({
  request: options =>
    request({
      baseUrl,
      timeout,
      ...options,
      headers: { ...headers, ...(options && options.headers ? options.headers : {}) }
    })
});

module.exports = {
  HttpError,
  createClient,
  request
};
