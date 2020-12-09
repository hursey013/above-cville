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
  interesting: ({ interested }, snap) =>
    !(snap.val() && snap.val().interesting === false) &&
    interested === "1" &&
    "interesting",
  military: ({ mil }, snap) => mil === "1" && "military",
  busyday: (state, snap) =>
    Boolean(snap.val()) &&
    isInDateRange(snap.val().timestamps, 3, 24, "hours") &&
    "busyday",
  frequentflyer: (state, snap) =>
    Boolean(snap.val()) &&
    isInDateRange(snap.val().timestamps, 30, 90, "days") &&
    "frequentflyer",
  heyfriend: ({ icao }) => icao === "A0E429" && "heyfriend"
};
