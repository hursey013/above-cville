"use strict";

const moment = require("moment");

const isInDateRange = (timestamps, limit = 0, intervalLength, intervalUnit) => {
  const array = Object.values(timestamps);

  return (
    array.length >= limit &&
    array
      .slice(-limit)
      .every(timestamp =>
        moment(timestamp).isAfter(
          moment().subtract(intervalLength, intervalUnit)
        )
      )
  );
};

module.exports = {
  military: ({ dbFlags }, snap) => dbFlags === 1 && "military",
  busyday: (state, snap) =>
    Boolean(snap.val()) &&
    isInDateRange(snap.val().timestamps, 3, 24, "hours") &&
    "busyday",
  frequentflyer: (state, snap) =>
    Boolean(snap.val()) &&
    isInDateRange(snap.val().timestamps, 30, 90, "days") &&
    "frequentflyer",
  phiden: ({ hex }, snap) => hex === "A0E429" && "phiden",
  firstspot: (state, snap) => !snap.val() && "firstspot"
};
