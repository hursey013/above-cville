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
  interesting: ({ icao, interested }, snap, interesting) =>
    !(interesting.val() && interesting.val()[icao] === false) &&
    interested === "1" &&
    "interesting",
  military: ({ mil }, snap, interesting) => mil === "1" && "military",
  busyday: (state, snap, interesting) =>
    Boolean(snap.val()) &&
    isInDateRange(snap.val().timestamps, 3, 24, "hours") &&
    "busyday",
  frequentflyer: (state, snap, interesting) =>
    Boolean(snap.val()) &&
    isInDateRange(snap.val().timestamps, 30, 90, "days") &&
    "frequentflyer",
  phiden: ({ icao }, snap, interesting) => icao === "A0E429" && "phiden"
};
