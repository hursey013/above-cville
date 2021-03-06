const utils = require("./utils");
const moment = require("moment");

describe("utils", () => {
  beforeEach(() => jest.resetModules());

  describe("addArticle function", () => {
    it("allows exceptions", () => {
      jest.mock("./config.js", () => ({
        articles: {
          A: ["Eurocopter EC135-P2+"],
          An: ["Banana"]
        }
      }));
      const utils = require("./utils.js");
      expect(utils.addArticle("Eurocopter EC135-P2+")).toEqual(
        "A Eurocopter EC135-P2+"
      );
      expect(utils.addArticle("Banana")).toEqual("An Banana");
    });

    it("uses indefinite when no exceptions are found", () => {
      expect(utils.addArticle("Airplane")).toEqual("An Airplane");
      expect(utils.addArticle("Cat")).toEqual("A Cat");
    });
  });

  describe("createStatus function", () => {
    let snap = { val: () => ({ timestamps: { foo: 1603572682275 } }) };
    let state = {
      hex: "A12345",
      r: "N12345",
      t: "G200",
      gs: 431.9,
      alt_baro: 28000,
      track: 220.6,
      flight: "SWA123"
    };
    let ops = { val: () => ({ CVILLE: "Cville Airlines" }) };

    describe("properly formats status with ", () => {
      beforeEach(() => {
        jest.mock("./config.js", () => ({
          abbreviations: [],
          actionPhrases: ["Can you see it?"],
          articles: {},
          adsbx: {
            lat: 38.0375,
            lon: -78.4863
          }
        }));
        jest.mock("./storage/operators.json", () => ({
          SWA: ["Southwest Airlines", "United States", "SOUTHWEST"]
        }));
        Date.now = jest.fn(() => 1603572682275);
      });

      it("all values empty", () => {
        const utils = require("./utils.js");
        expect(
          utils.createStatus({ val: () => null }, {}, { val: () => {} })
        ).toEqual(
          "Can you see it? An aircraft is currently flying overhead #firstspot"
        );
      });

      it("all values present", () => {
        const utils = require("./utils.js");
        expect(
          utils.createStatus(
            snap,
            state,
            ops,
            "https://www.myphotos.com/photo/123456"
          )
        ).toEqual(
          `Can you see it? A G200 #N12345 operated by Southwest Airlines, seen once before, is currently flying 28,000 ft overhead and heading SW at 497 mph

📸 https://www.myphotos.com/photo/123456
📡 https://globe.adsbexchange.com/?icao=A12345&lat=38.0375&lon=-78.4863&zoom=12.0&showTrace=2020-10-24`
        );
      });

      it("missing type value", () => {
        const utils = require("./utils.js");
        expect(
          utils.createStatus(snap, { ...state, t: undefined }, ops)
        ).toEqual(
          `Can you see it? An aircraft #N12345 operated by Southwest Airlines, seen once before, is currently flying 28,000 ft overhead and heading SW at 497 mph

📡 https://globe.adsbexchange.com/?icao=A12345&lat=38.0375&lon=-78.4863&zoom=12.0&showTrace=2020-10-24`
        );
      });

      it("missing identifiers values", () => {
        const utils = require("./utils.js");
        expect(
          utils.createStatus(
            snap,
            { ...state, flight: undefined, r: undefined, hex: undefined },
            ops
          )
        ).toEqual(
          "Can you see it? A G200, seen once before, is currently flying 28,000 ft overhead and heading SW at 497 mph"
        );
      });

      it("missing operator value", () => {
        jest.mock("./storage/operators.json", () => ({}));
        const utils = require("./utils.js");
        expect(utils.createStatus(snap, state, ops)).toEqual(
          `Can you see it? A G200 #N12345, seen once before, is currently flying 28,000 ft overhead and heading SW at 497 mph

📡 https://globe.adsbexchange.com/?icao=A12345&lat=38.0375&lon=-78.4863&zoom=12.0&showTrace=2020-10-24`
        );
      });

      it("missing count value", () => {
        const utils = require("./utils.js");
        expect(utils.createStatus({ val: () => {} }, state, ops)).toEqual(
          `Can you see it? A G200 #N12345 operated by Southwest Airlines is currently flying 28,000 ft overhead and heading SW at 497 mph #firstspot

📡 https://globe.adsbexchange.com/?icao=A12345&lat=38.0375&lon=-78.4863&zoom=12.0&showTrace=2020-10-24`
        );
      });

      it("missing altitude value", () => {
        const utils = require("./utils.js");
        expect(
          utils.createStatus(snap, { ...state, alt_baro: undefined }, ops)
        ).toEqual(
          `Can you see it? A G200 #N12345 operated by Southwest Airlines, seen once before, is currently flying overhead and heading SW at 497 mph

📡 https://globe.adsbexchange.com/?icao=A12345&lat=38.0375&lon=-78.4863&zoom=12.0&showTrace=2020-10-24`
        );
      });

      it("missing direction value value", () => {
        const utils = require("./utils.js");
        expect(
          utils.createStatus(snap, { ...state, track: undefined }, ops)
        ).toEqual(
          `Can you see it? A G200 #N12345 operated by Southwest Airlines, seen once before, is currently flying 28,000 ft overhead at 497 mph

📡 https://globe.adsbexchange.com/?icao=A12345&lat=38.0375&lon=-78.4863&zoom=12.0&showTrace=2020-10-24`
        );
      });

      it("missing speed value", () => {
        const utils = require("./utils.js");
        expect(
          utils.createStatus(snap, { ...state, gs: undefined }, ops)
        ).toEqual(
          `Can you see it? A G200 #N12345 operated by Southwest Airlines, seen once before, is currently flying 28,000 ft overhead and heading SW

📡 https://globe.adsbexchange.com/?icao=A12345&lat=38.0375&lon=-78.4863&zoom=12.0&showTrace=2020-10-24`
        );
      });

      it("missing hashtags values", () => {
        const utils = require("./utils.js");
        expect(
          utils.createStatus(snap, { ...state, dbFlags: undefined }, ops)
        ).toEqual(
          `Can you see it? A G200 #N12345 operated by Southwest Airlines, seen once before, is currently flying 28,000 ft overhead and heading SW at 497 mph

📡 https://globe.adsbexchange.com/?icao=A12345&lat=38.0375&lon=-78.4863&zoom=12.0&showTrace=2020-10-24`
        );
      });
    });
  });

  describe("filterStates function", () => {
    beforeEach(() => {
      jest.mock("./config.js", () => ({
        maximumAlt: 25000,
        abbreviations: [],
        articles: {}
      }));
    });

    describe("removes", () => {
      it("aircraft above maximum altitude", () => {
        const utils = require("./utils.js");
        expect(
          utils.filterStates([{ alt_baro: 35000 }], {
            val: () => []
          }).length
        ).toEqual(0);
      });

      it("operator in the ignored array from database", () => {
        const utils = require("./utils.js");
        expect(
          utils.filterStates([{ flight: "PDT123" }], {
            val: () => ["PDT"]
          }).length
        ).toEqual(0);
      });
    });

    describe("does not remove", () => {
      it("aircraft that are below maximum altitude", () => {
        const utils = require("./utils.js");
        expect(
          utils.filterStates([{ alt_baro: 23000 }], {
            val: () => []
          }).length
        ).toEqual(1);
      });

      it("operator not in the ignored array from database", () => {
        const utils = require("./utils.js");
        expect(
          utils.filterStates([{ flight: "PDT123" }], {
            val: () => ["FOO"]
          }).length
        ).toEqual(1);
      });
    });
  });

  describe("formatAltitude function", () => {
    it("properly formats string", () => {
      expect(utils.formatAltitude()).toEqual(false);
      expect(utils.formatAltitude(28000)).toEqual(" 28,000 ft");
    });
  });

  describe("formatCount function", () => {
    it("properly formats string", () => {
      expect(utils.formatCount({ val: () => {} })).toEqual(false);
      expect(
        utils.formatCount({ val: () => ({ timestamps: [1603572682275] }) })
      ).toEqual(", seen once before,");
      expect(
        utils.formatCount({
          val: () => ({ timestamps: [1603572682275, 1603572682276] })
        })
      ).toEqual(", seen 2 times before,");
    });
  });

  describe("formatDirection function", () => {
    it("properly formats string", () => {
      expect(utils.formatDirection()).toEqual(false);
      expect(utils.formatDirection(220.6)).toEqual(" and heading SW");
    });
  });

  describe("formatIdentifier function", () => {
    it("properly formats string", () => {
      expect(utils.formatIdentifier(undefined, undefined, undefined)).toEqual(
        false
      );
      expect(utils.formatIdentifier("SWA123", "N12345", undefined)).toEqual(
        " #N12345"
      );
      expect(utils.formatIdentifier("TEST123", "98-0001", undefined)).toEqual(
        " #TEST123"
      );
      expect(utils.formatIdentifier("SWA123", "N12345", 1)).toEqual(" #SWA123");
      expect(utils.formatIdentifier(undefined, "N12345", undefined)).toEqual(
        " #N12345"
      );
    });
  });

  describe("formatOperator function", () => {
    describe("properly formats string", () => {
      it("with missing value", () => {
        expect(
          utils.formatOperator(undefined, undefined, undefined, {
            val: () => ({})
          })
        ).toEqual(false);
      });

      it("with custom icao", () => {
        expect(
          utils.formatOperator(undefined, "A12345", undefined, {
            val: () => ({ icao: { A12345: "Cville Airlines" } })
          })
        ).toEqual(" operated by Cville Airlines");
      });

      it("with custom operator", () => {
        expect(
          utils.formatOperator("SWA123", undefined, undefined, {
            val: () => ({ opicao: { SWA: "Cville Airlines" } })
          })
        ).toEqual(" operated by Cville Airlines");
      });

      it("with db match", () => {
        jest.mock("./storage/operators.json", () => ({
          SWA: ["Southwest Airlines", "United States", "SOUTHWEST"]
        }));
        const utils = require("./utils.js");
        expect(
          utils.formatOperator("SWA123", undefined, undefined, {
            val: () => ({})
          })
        ).toEqual(" operated by Southwest Airlines");
      });

      it("with no db matches", () => {
        jest.mock("./storage/operators.json", () => ({}));
        const utils = require("./utils.js");
        expect(
          utils.formatOperator("SWA123", undefined, undefined, {
            val: () => ({})
          })
        ).toEqual(false);
      });

      it("not derived from callsign if military", () => {
        jest.mock("./storage/operators.json", () => ({
          CVL: ["Cville Airlines", "United States", "CVL"]
        }));
        const utils = require("./utils.js");
        expect(
          utils.formatOperator(
            "CVL123",
            undefined,
            "N12345",
            { val: () => ({}) },
            1
          )
        ).toEqual(false);
      });
    });
  });

  describe("formatSpeed function", () => {
    it("properly formats string", () => {
      expect(utils.formatSpeed()).toEqual(false);
      expect(utils.formatSpeed(0)).toEqual(false);
      expect(utils.formatSpeed(1000)).toEqual(" at 1151 mph");
    });
  });

  describe("formatType function", () => {
    describe("properly formats string", () => {
      it("with missing value", () => {
        expect(utils.formatType()).toEqual(" An aircraft");
      });

      it("with no db matches", () => {
        jest.mock("./storage/types.json", () => ({}));
        const utils = require("./utils.js");
        expect(utils.formatType("G200")).toEqual(" A G200");
      });

      describe("with type db match", () => {
        it("missing description", () => {
          jest.mock("./storage/types.json", () => ({
            G200: ["", "L1P", "L"]
          }));
          const utils = require("./utils.js");
          expect(utils.formatType("G200")).toEqual(" A G200");
        });

        it("description", () => {
          jest.mock("./storage/types.json", () => ({
            G200: ["AKROTECH G-200", "L1P", "L"]
          }));
          const utils = require("./utils.js");
          expect(utils.formatType("G200")).toEqual(" An Akrotech G-200");
        });
      });
    });
  });

  describe("isMilitary function", () => {
    it("is true if numeric registration", () => {
      expect(utils.isMilitary("0123456", undefined)).toEqual(true);
      expect(utils.isMilitary("01-23456", undefined)).toEqual(true);
    });

    it("is true if mil is true", () => {
      expect(utils.isMilitary("ABC123", 1)).toEqual(true);
    });
  });

  describe("isNewState function", () => {
    let cooldown = 5;

    it("is true if snapshot doesn't exist", () => {
      expect(
        utils.isNewState({ exists: () => false, val: () => {} }, cooldown)
      ).toEqual(true);
    });

    it("is false if timestamp array is missing", () => {
      expect(
        utils.isNewState(
          {
            exists: () => true,
            val: () => ({ description: "@abovecville" })
          },
          cooldown
        )
      ).toEqual(true);
    });

    it("is false if last timestamp is less than cooldown", () => {
      expect(
        utils.isNewState(
          {
            exists: () => true,
            val: () => ({
              timestamps: {
                0: moment()
                  .subtract(2, "minutes")
                  .valueOf()
              }
            })
          },
          cooldown
        )
      ).toEqual(false);
    });

    it("is true if last timestamp is greater than cooldown", () => {
      expect(
        utils.isNewState(
          {
            exists: () => true,
            val: () => ({
              timestamps: {
                0: moment()
                  .subtract(10, "minutes")
                  .valueOf()
              }
            })
          },
          cooldown
        )
      ).toEqual(true);
    });

    it("chooses most recent timestamp", () => {
      expect(
        utils.isNewState(
          {
            exists: () => true,
            val: () => ({
              timestamps: [
                moment().subtract(10, "minutes"),
                moment().subtract(2, "minutes")
              ]
            })
          },
          cooldown
        )
      ).toEqual(false);
    });
  });

  describe("numberWithCommas function", () => {
    it("does not add commas when not needed", () => {
      expect(utils.numberWithCommas(100)).toEqual("100");
    });

    it("adds commas when appropriate", () => {
      expect(utils.numberWithCommas(1000)).toEqual("1,000");
      expect(utils.numberWithCommas(1000000)).toEqual("1,000,000");
    });
  });

  describe("sanitizeString function", () => {
    it("removes double single quotes", () => {
      expect(utils.sanitizeString("Van''s RV-7")).toEqual("Van's RV-7");
    });

    it("sentence cases string", () => {
      expect(utils.sanitizeString("an airplane")).toEqual("An Airplane");
    });

    it("does not lowercase words with special characters or numbers", () => {
      expect(utils.sanitizeString("300ABC")).toEqual("300ABC");
      expect(utils.sanitizeString("ABC-DEF")).toEqual("ABC-DEF");
      expect(utils.sanitizeString("ABC.DEF")).toEqual("ABC.DEF");
      expect(utils.sanitizeString("@FlyCville")).toEqual("@FlyCville");
    });

    it("allows exceptions", () => {
      jest.mock("./config.js", () => ({
        abbreviations: ["III", "PSA"]
      }));
      const utils = require("./utils.js");

      expect(utils.sanitizeString("Boeing C-17A Globemaster III")).toEqual(
        "Boeing C-17A Globemaster III"
      );
      expect(utils.sanitizeString("Psa Airlines")).toEqual("PSA Airlines");
    });
  });
});
