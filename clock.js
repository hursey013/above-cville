"use strict";

const { setIntervalAsync } = require("set-interval-async/dynamic");

const { refreshSeconds } = require("./config");
const app = require("./app");

setIntervalAsync(() => app(), refreshSeconds * 1000);
