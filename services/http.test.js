"use strict";

const http = require("http");

const createFetchStub = () => (input, init = {}) => {
  const target = typeof input === "string" ? new URL(input) : input;
  const { method = "GET", headers = {}, body, signal } = init;
  const options = {
    method,
    hostname: target.hostname,
    port: target.port || 80,
    path: `${target.pathname}${target.search}`,
    headers
  };

  return new Promise((resolve, reject) => {
    let settled = false;
    const rejectOnce = error => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const req = http.request(options, res => {
      const chunks = [];

      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => {
        if (signal) {
          signal.removeEventListener("abort", abortHandler);
        }

        const buffer = Buffer.concat(chunks);
        const headerLookup = name => {
          const value = res.headers[name.toLowerCase()];
          if (Array.isArray(value)) return value[0];
          return typeof value === "undefined" ? null : value;
        };

        settled = true;
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          headers: { get: headerLookup },
          text: () => Promise.resolve(buffer.toString()),
          json: () => {
            const text = buffer.toString();
            return Promise.resolve(text ? JSON.parse(text) : null);
          }
        });
      });
    });

    const abortHandler = () => {
      const error = new Error("Aborted");
      error.name = "AbortError";
      req.destroy(error);
      rejectOnce(error);
    };

    req.on("error", rejectOnce);

    if (signal) {
      if (signal.aborted) {
        abortHandler();
        return;
      }

      signal.addEventListener("abort", abortHandler, { once: true });
    }

    if (body) {
      req.write(body);
    }

    req.end();
  });
};

let HttpError;
let request;

describe("services/http", () => {
  let server;
  let baseUrl;
  let handler;

  beforeAll(async () => {
    global.fetch = createFetchStub();
    ({ HttpError, request } = require("./http"));
    server = http.createServer((req, res) => handler(req, res));
    await new Promise(resolve => server.listen(0, resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
  });

  beforeEach(() => {
    handler = (req, res) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Test handler not configured" }));
    };
  });

  it("performs JSON requests with query parameters", async () => {
    handler = (req, res) => {
      expect(req.url).toBe("/test?foo=bar");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    };

    const response = await request({
      baseUrl,
      path: "/test",
      params: { foo: "bar" }
    });

    expect(response).toEqual({ ok: true });
  });

  it("sends JSON bodies for POST requests", async () => {
    handler = (req, res) => {
      const chunks = [];
      req.on("data", chunk => chunks.push(chunk));
      req.on("end", () => {
        const payload = Buffer.concat(chunks).toString();
        expect(payload).toEqual(JSON.stringify({ hello: "world" }));
        res.writeHead(201, { "Content-Type": "text/plain" });
        res.end("created");
      });
    };

    const response = await request({
      baseUrl,
      path: "/submit",
      method: "POST",
      data: { hello: "world" }
    });

    expect(response).toEqual("created");
  });

  it("throws HttpError on non-2xx responses", async () => {
    handler = (req, res) => {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    };

    await expect(
      request({
        baseUrl,
        path: "/missing"
      })
    ).rejects.toMatchObject({ status: 404, data: { error: "Not found" } });
  });

  it("aborts requests that exceed the timeout", async () => {
    handler = (req, res) => {
      setTimeout(() => {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("slow");
      }, 50);
    };

    await expect(
      request({
        baseUrl,
        path: "/slow",
        timeout: 10
      })
    ).rejects.toBeInstanceOf(HttpError);
  });
});
