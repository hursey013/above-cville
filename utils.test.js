const moment = require("moment");

describe("utils", () => {
  const loadUtils = () => require("./utils");

  beforeEach(() => {
    jest.resetModules();
  });

  describe("addArticle function", () => {
    it("allows exceptions", () => {
      jest.mock("./config.js", () => ({
        articles: {
          A: ["Eurocopter EC135-P2+"],
          An: ["Banana"]
        }
      }));
      const utils = loadUtils();
      expect(utils.addArticle("Eurocopter EC135-P2+")).toEqual(
        "A Eurocopter EC135-P2+"
      );
      expect(utils.addArticle("Banana")).toEqual("An Banana");
    });

    it("uses indefinite when no exceptions are found", () => {
      const utils = loadUtils();
      expect(utils.addArticle("Airplane")).toEqual("An Airplane");
      expect(utils.addArticle("Cat")).toEqual("A Cat");
    });
  });

  describe("createStatus function", () => {
    let snap;
    let state;
    let ops;

    beforeEach(() => {
      snap = {
        val: () => ({ timestamps: { foo: 1603572682275 } }),
        exists: () => true
      };
      state = {
        hex: "A12345",
        r: "N12345",
        t: "G200",
        gs: 431.9,
        alt_baro: 28000,
        track: 220.6,
        flight: "SWA123"
      };
      ops = {
        val: () => ({
          icao: { A12345: "Cville Airlines" },
          opicao: { SWA: "Cville Airlines" }
        }),
        exists: () => true
      };
      jest.mock("./config.js", () => ({
        abbreviations: [],
        actionPhrases: ["Can you see it?"],
        articles: {},
        airplanesLive: {
          lat: 38.0375,
          lon: -78.4863
        }
      }));
      Date.now = jest.fn(() => 1603572682275);
    });

    it("all values empty", () => {
      const utils = loadUtils();
      expect(utils.createStatus({ val: () => null, exists: () => false }, {}, { val: () => ({}) })).toEqual(
        "Can you see it? An aircraft is currently flying overhead #firstspot"
      );
    });

    it("all values present", () => {
      jest.mock(
        "./storage/operators.json",
        () => ({
          SWA: ["Southwest Airlines", "United States", "SOUTHWEST"]
        }),
        { virtual: true }
      );
      ops = { val: () => ({}), exists: () => false };
      const utils = loadUtils();
      expect(
        utils.createStatus(
          snap,
          state,
          ops,
          "https://www.myphotos.com/photo/123456"
        )
      ).toEqual(
        `Can you see it? An Akrotech G-200 #N12345 operated by Southwest Airlines, seen once before, is currently flying 28,000 ft overhead and heading SW at 497 mph\n\n📸 https://www.myphotos.com/photo/123456\n📡 https://globe.airplanes.live/?icao=A12345&lat=38.0375&lon=-78.4863&zoom=12.0&showTrace=2020-10-24`
      );
    });

    it("missing type value", () => {
      const utils = loadUtils();
      expect(utils.createStatus(snap, { ...state, t: undefined }, ops)).toEqual(
        `Can you see it? An aircraft #N12345 operated by Cville Airlines, seen once before, is currently flying 28,000 ft overhead and heading SW at 497 mph\n\n📡 https://globe.airplanes.live/?icao=A12345&lat=38.0375&lon=-78.4863&zoom=12.0&showTrace=2020-10-24`
      );
    });

    it("missing identifiers values", () => {
      const utils = loadUtils();
      expect(
        utils.createStatus(
          snap,
          { ...state, flight: undefined, r: undefined, hex: undefined },
          ops
        )
      ).toEqual(
        "Can you see it? An Akrotech G-200, seen once before, is currently flying 28,000 ft overhead and heading SW at 497 mph"
      );
    });

    it("missing operator value", () => {
      jest.mock("./storage/operators.json", () => ({}), { virtual: true });
      ops = { val: () => ({}), exists: () => false };
      const utils = loadUtils();
      expect(utils.createStatus(snap, state, ops)).toEqual(
        `Can you see it? An Akrotech G-200 #N12345, seen once before, is currently flying 28,000 ft overhead and heading SW at 497 mph\n\n📡 https://globe.airplanes.live/?icao=A12345&lat=38.0375&lon=-78.4863&zoom=12.0&showTrace=2020-10-24`
      );
    });

    it("missing count value", () => {
      const utils = loadUtils();
      expect(utils.createStatus({ val: () => {}, exists: () => false }, state, ops)).toEqual(
        `Can you see it? An Akrotech G-200 #N12345 operated by Cville Airlines is currently flying 28,000 ft overhead and heading SW at 497 mph #firstspot\n\n📡 https://globe.airplanes.live/?icao=A12345&lat=38.0375&lon=-78.4863&zoom=12.0&showTrace=2020-10-24`
      );
    });

    it("missing altitude value", () => {
      const utils = loadUtils();
      expect(
        utils.createStatus(snap, { ...state, alt_baro: undefined }, ops)
      ).toEqual(
        `Can you see it? An Akrotech G-200 #N12345 operated by Cville Airlines, seen once before, is currently flying overhead and heading SW at 497 mph\n\n📡 https://globe.airplanes.live/?icao=A12345&lat=38.0375&lon=-78.4863&zoom=12.0&showTrace=2020-10-24`
      );
    });

    it("missing direction value value", () => {
      const utils = loadUtils();
      expect(
        utils.createStatus(snap, { ...state, track: undefined }, ops)
      ).toEqual(
        `Can you see it? An Akrotech G-200 #N12345 operated by Cville Airlines, seen once before, is currently flying 28,000 ft overhead at 497 mph\n\n📡 https://globe.airplanes.live/?icao=A12345&lat=38.0375&lon=-78.4863&zoom=12.0&showTrace=2020-10-24`
      );
    });

    it("missing speed value", () => {
      const utils = loadUtils();
      expect(
        utils.createStatus(snap, { ...state, gs: undefined }, ops)
      ).toEqual(
        `Can you see it? An Akrotech G-200 #N12345 operated by Cville Airlines, seen once before, is currently flying 28,000 ft overhead and heading SW\n\n📡 https://globe.airplanes.live/?icao=A12345&lat=38.0375&lon=-78.4863&zoom=12.0&showTrace=2020-10-24`
      );
    });

    it("missing hashtags values", () => {
      const utils = loadUtils();
      expect(
        utils.createStatus(snap, { ...state, dbFlags: undefined }, ops)
      ).toEqual(
        `Can you see it? An Akrotech G-200 #N12345 operated by Cville Airlines, seen once before, is currently flying 28,000 ft overhead and heading SW at 497 mph\n\n📡 https://globe.airplanes.live/?icao=A12345&lat=38.0375&lon=-78.4863&zoom=12.0&showTrace=2020-10-24`
      );
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

    it("removes aircraft above maximum altitude", () => {
      const utils = loadUtils();
      expect(
        utils.filterStates([{ alt_baro: 35000 }], {
          val: () => [],
          exists: () => false
        }).length
      ).toEqual(0);
    });

    it("removes operator in the ignored array from database", () => {
      const utils = loadUtils();
      expect(
        utils.filterStates([{ flight: "PDT123" }], {
          val: () => ["PDT"],
          exists: () => true
        }).length
      ).toEqual(0);
    });

    it("does not remove aircraft that are below maximum altitude", () => {
      const utils = loadUtils();
      expect(
        utils.filterStates([{ alt_baro: 23000 }], {
          val: () => [],
          exists: () => false
        }).length
      ).toEqual(1);
    });

    it("does not remove operator not in the ignored array from database", () => {
      const utils = loadUtils();
      expect(
        utils.filterStates([{ flight: "PDT123" }], {
          val: () => ["FOO"],
          exists: () => true
        }).length
      ).toEqual(1);
    });
  });

  describe("formatAltitude function", () => {
    it("properly formats string", () => {
      const utils = loadUtils();
      expect(utils.formatAltitude()).toEqual(false);
      expect(utils.formatAltitude(28000)).toEqual(" 28,000 ft");
    });
  });

  describe("formatCount function", () => {
    it("properly formats string", () => {
      const utils = loadUtils();
      expect(utils.formatCount({ val: () => {}, exists: () => false })).toEqual(false);
      expect(
        utils.formatCount({ val: () => ({ timestamps: [1603572682275] }), exists: () => true })
      ).toEqual(", seen once before,");
      expect(
        utils.formatCount({
          val: () => ({ timestamps: [1603572682275, 1603572682276] }),
          exists: () => true
        })
      ).toEqual(", seen 2 times before,");
    });
  });

  describe("formatDirection function", () => {
    it("properly formats string", () => {
      const utils = loadUtils();
      expect(utils.formatDirection()).toEqual(false);
      expect(utils.formatDirection(220.6)).toEqual(" and heading SW");
    });
  });

  describe("formatIdentifier function", () => {
    it("properly formats string", () => {
      const utils = loadUtils();
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
        const utils = loadUtils();
        expect(
          utils.formatOperator(undefined, undefined, undefined, {
            val: () => ({}),
            exists: () => false
          })
        ).toEqual(false);
      });

      it("with custom icao", () => {
        const utils = loadUtils();
        expect(
          utils.formatOperator(undefined, "A12345", undefined, {
            val: () => ({ icao: { A12345: "Cville Airlines" } }),
            exists: () => true
          })
        ).toEqual(" operated by Cville Airlines");
      });

      it("with custom operator", () => {
        const utils = loadUtils();
        expect(
          utils.formatOperator("SWA123", undefined, undefined, {
            val: () => ({ opicao: { SWA: "Cville Airlines" } }),
            exists: () => true
          })
        ).toEqual(" operated by Cville Airlines");
      });

      it("with db match", () => {
        jest.mock("./storage/operators.json", () => ({
          SWA: ["Southwest Airlines", "United States", "SOUTHWEST"]
        }), { virtual: true });
        const utils = loadUtils();
        expect(
          utils.formatOperator("SWA123", undefined, undefined, {
            val: () => ({}),
            exists: () => false
          })
        ).toEqual(" operated by Southwest Airlines");
      });

      it("with no db matches", () => {
        jest.mock("./storage/operators.json", () => ({}), { virtual: true });
        const utils = loadUtils();
        expect(
          utils.formatOperator("SWA123", undefined, undefined, {
            val: () => ({}),
            exists: () => false
          })
        ).toEqual(false);
      });

      it("not derived from callsign if military", () => {
        jest.mock("./storage/operators.json", () => ({
          CVL: ["Cville Airlines", "United States", "CVL"]
        }), { virtual: true });
        const utils = loadUtils();
        expect(
          utils.formatOperator(
            "CVL123",
            undefined,
            "N12345",
            { val: () => ({}), exists: () => false },
            1
          )
        ).toEqual(false);
      });
    });
  });

  describe("formatSpeed function", () => {
    it("properly formats string", () => {
      const utils = loadUtils();
      expect(utils.formatSpeed()).toEqual(false);
      expect(utils.formatSpeed(0)).toEqual(false);
      expect(utils.formatSpeed(1000)).toEqual(" at 1151 mph");
    });
  });

  describe("formatType function", () => {
    describe("properly formats string", () => {
      it("with missing value", () => {
        const utils = loadUtils();
        expect(utils.formatType()).toEqual(" An aircraft");
      });

      it("with no db matches", () => {
        jest.mock("./storage/types.json", () => ({}), { virtual: true });
        const utils = loadUtils();
        expect(utils.formatType("G200")).toEqual(" A G200");
      });

      describe("with type db match", () => {
        it("missing description", () => {
          jest.mock("./storage/types.json", () => ({
            G200: ["", "L1P", "L"]
          }), { virtual: true });
          const utils = loadUtils();
          expect(utils.formatType("G200")).toEqual(" A G200");
        });

        it("description", () => {
          jest.mock("./storage/types.json", () => ({
            G200: ["AKROTECH G-200", "L1P", "L"]
          }), { virtual: true });
          const utils = loadUtils();
          expect(utils.formatType("G200")).toEqual(" An Akrotech G-200");
        });
      });
    });
  });

  describe("isMilitary function", () => {
    it("is true if numeric registration", () => {
      const utils = loadUtils();
      expect(utils.isMilitary("0123456", undefined)).toEqual(true);
      expect(utils.isMilitary("01-23456", undefined)).toEqual(true);
    });

    it("is true if mil is true", () => {
      const utils = loadUtils();
      expect(utils.isMilitary("ABC123", 1)).toEqual(true);
    });
  });

  describe("isNewState function", () => {
    let cooldown = 5;

    it("is true if snapshot doesn't exist", () => {
      const utils = loadUtils();
      expect(
        utils.isNewState({ exists: () => false, val: () => {} }, cooldown)
      ).toEqual(true);
    });

    it("is false if timestamp array is missing", () => {
      const utils = loadUtils();
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
      const utils = loadUtils();
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
      const utils = loadUtils();
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
      const utils = loadUtils();
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
      const utils = loadUtils();
      expect(utils.numberWithCommas(100)).toEqual("100");
    });

    it("adds commas when appropriate", () => {
      const utils = loadUtils();
      expect(utils.numberWithCommas(1000)).toEqual("1,000");
      expect(utils.numberWithCommas(1000000)).toEqual("1,000,000");
    });
  });

  describe("sanitizeString function", () => {
    it("removes double single quotes", () => {
      const utils = loadUtils();
      expect(utils.sanitizeString("Van''s RV-7")).toEqual("Van's RV-7");
    });

    it("sentence cases string", () => {
      const utils = loadUtils();
      expect(utils.sanitizeString("an airplane")).toEqual("An Airplane");
    });

    it("does not lowercase words with special characters or numbers", () => {
      const utils = loadUtils();
      expect(utils.sanitizeString("300ABC")).toEqual("300ABC");
      expect(utils.sanitizeString("ABC-DEF")).toEqual("ABC-DEF");
      expect(utils.sanitizeString("ABC.DEF")).toEqual("ABC.DEF");
      expect(utils.sanitizeString("@FlyCville")).toEqual("@FlyCville");
    });

    it("allows exceptions", () => {
      jest.mock("./config.js", () => ({
        abbreviations: ["III", "PSA"]
      }));
      const utils = loadUtils();

      expect(utils.sanitizeString("Boeing C-17A Globemaster III")).toEqual(
        "Boeing C-17A Globemaster III"
      );
      expect(utils.sanitizeString("Psa Airlines")).toEqual("PSA Airlines");
    });
  });
});
