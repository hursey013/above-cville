"use strict";

const { serializeError } = require("serialize-error");

const { apprise } = require("../config");
const { request } = require("./http");

const formatTargets = targets => {
  if (!Array.isArray(targets)) return targets;
  if (targets.length === 0) return undefined;
  return targets.length === 1 ? targets[0] : targets;
};

const sendNotification = async ({ title, body, media }) => {
  if (!apprise.url) {
    console.warn("Apprise URL is not configured. Skipping notification.");
    return false;
  }

  const urls = formatTargets(apprise.targets);

  if (!urls) {
    console.warn("Apprise targets are not configured. Skipping notification.");
    return false;
  }

  const payload = {
    title,
    body,
    urls
  };

  if (apprise.tag) payload.tag = apprise.tag;
  if (media) payload.attach = Array.isArray(media) ? media : [media];

  try {
    await request({
      url: apprise.url,
      method: "POST",
      data: payload,
      timeout: apprise.timeout
    });
    return true;
  } catch (error) {
    throw new Error(
      `Apprise notification failed: ${JSON.stringify(serializeError(error))}`
    );
  }
};

module.exports = { sendNotification };
