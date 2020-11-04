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
    let snap = { val: () => ({ timestamps: [1603572682275] }) };
    let state = {
      icao: "A12345",
      reg: "N12345",
      type: "G200",
      spd: "431.9",
      alt: "28000",
      trak: "220.6",
      call: "SWA123",
      gnd: "0",
      opicao: "SWA",
      mil: "1"
    };
    let ops = { val: () => ({ CVILLE: "Cville Airlines" }) };

    describe("properly formats status with ", () => {
      beforeEach(() => {
        jest.mock("./config.js", () => ({
          abbreviations: [],
          actionPhrases: ["Can you see it?"],
          articles: {},
          hashtags: [({ mil }, snap) => mil === "1" && "military"]
        }));
        jest.mock("./storage/operators.json", () => ({
          SWA: { n: "Southwest Airlines", c: "United States", r: "SOUTHWEST" }
        }));
      });

      it("all values empty", () => {
        const utils = require("./utils.js");
        expect(
          utils.createStatus({ val: jest.fn() }, {}, { val: jest.fn() })
        ).toEqual("Can you see it? An aircraft is currently flying overhead");
      });

      it("all values present", () => {
        const utils = require("./utils.js");
        expect(utils.createStatus(snap, state, ops)).toEqual(
          "Can you see it? A G200 #N12345 operated by Southwest Airlines, seen once before, is currently flying 28,000 ft overhead and heading SW at 497 mph #military 📡https://globe.adsbexchange.com/?icao=A12345"
        );
      });

      it("missing type value", () => {
        const utils = require("./utils.js");
        expect(utils.createStatus(snap, { ...state, type: "" }, ops)).toEqual(
          "Can you see it? An aircraft #N12345 operated by Southwest Airlines, seen once before, is currently flying 28,000 ft overhead and heading SW at 497 mph #military 📡https://globe.adsbexchange.com/?icao=A12345"
        );
      });

      it("missing identifiers values", () => {
        const utils = require("./utils.js");
        expect(
          utils.createStatus(
            snap,
            { ...state, call: "", reg: "", icao: "" },
            ops
          )
        ).toEqual(
          "Can you see it? A G200 operated by Southwest Airlines, seen once before, is currently flying 28,000 ft overhead and heading SW at 497 mph #military"
        );
      });

      it("missing operator value", () => {
        jest.mock("./storage/operators.json", () => ({}));
        const utils = require("./utils.js");
        expect(utils.createStatus(snap, state, ops)).toEqual(
          "Can you see it? A G200 #N12345, seen once before, is currently flying 28,000 ft overhead and heading SW at 497 mph #military 📡https://globe.adsbexchange.com/?icao=A12345"
        );
      });

      it("missing count value", () => {
        const utils = require("./utils.js");
        expect(utils.createStatus({ val: () => {} }, state, ops)).toEqual(
          "Can you see it? A G200 #N12345 operated by Southwest Airlines is currently flying 28,000 ft overhead and heading SW at 497 mph #military 📡https://globe.adsbexchange.com/?icao=A12345"
        );
      });

      it("missing altitude value", () => {
        const utils = require("./utils.js");
        expect(utils.createStatus(snap, { ...state, alt: "" }, ops)).toEqual(
          "Can you see it? A G200 #N12345 operated by Southwest Airlines, seen once before, is currently flying overhead and heading SW at 497 mph #military 📡https://globe.adsbexchange.com/?icao=A12345"
        );
      });

      it("missing direction value value", () => {
        const utils = require("./utils.js");
        expect(utils.createStatus(snap, { ...state, trak: "" }, ops)).toEqual(
          "Can you see it? A G200 #N12345 operated by Southwest Airlines, seen once before, is currently flying 28,000 ft overhead at 497 mph #military 📡https://globe.adsbexchange.com/?icao=A12345"
        );
      });

      it("missing speed value", () => {
        const utils = require("./utils.js");
        expect(utils.createStatus(snap, { ...state, spd: "" }, ops)).toEqual(
          "Can you see it? A G200 #N12345 operated by Southwest Airlines, seen once before, is currently flying 28,000 ft overhead and heading SW #military 📡https://globe.adsbexchange.com/?icao=A12345"
        );
      });

      it("missing hashtags values", () => {
        const utils = require("./utils.js");
        expect(utils.createStatus(snap, { ...state, mil: "0" }, ops)).toEqual(
          "Can you see it? A G200 #N12345 operated by Southwest Airlines, seen once before, is currently flying 28,000 ft overhead and heading SW at 497 mph 📡https://globe.adsbexchange.com/?icao=A12345"
        );
      });
    });
  });

  describe("filterStates function", () => {
    beforeEach(() => {
      jest.mock("./config.js", () => ({
        minimumAlt: 25000,
        abbreviations: [],
        articles: {}
      }));
    });

    describe("removes", () => {
      it("aircraft on the ground", () => {
        const utils = require("./utils.js");
        expect(utils.filterStates([{ gnd: "1" }]).length).toEqual(0);
      });

      it("aircraft above minimum altitude", () => {
        const utils = require("./utils.js");
        expect(utils.filterStates([{ alt: "30000" }]).length).toEqual(0);
      });
    });

    describe("does not remove", () => {
      it("aircraft that are not on the ground", () => {
        const utils = require("./utils.js");
        expect(utils.filterStates([{ gnd: "0" }]).length).toEqual(1);
      });

      it("aircraft that are above minimum altitude", () => {
        const utils = require("./utils.js");
        expect(utils.filterStates([{ alt: "23000" }]).length).toEqual(1);
      });
    });
  });

  describe("formatAltitude function", () => {
    it("properly formats string", () => {
      expect(utils.formatAltitude("")).toEqual("");
      expect(utils.formatAltitude("28000")).toEqual(" 28,000 ft");
    });
  });

  describe("formatCount function", () => {
    it("properly formats string", () => {
      expect(utils.formatCount({ val: () => {} })).toEqual("");
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
      expect(utils.formatDirection("")).toEqual("");
      expect(utils.formatDirection("220.6")).toEqual(" and heading SW");
    });
  });

  describe("formatHashTag function", () => {
    beforeEach(() => {
      jest.mock("./config.js", () => ({
        abbreviations: [],
        actionPhrases: [],
        articles: {},
        hashtags: [
          ({ mil }, snap) => mil === "1" && "military",
          ({ alt }, snap) => Number(alt) >= 30000 && "intheclouds"
        ]
      }));
    });

    it("properly formats string", () => {
      const utils = require("./utils.js");
      expect(utils.formatHashTag({}, { val: () => {} })).toEqual("");
      expect(utils.formatHashTag({ mil: "1" }, jest.fn())).toEqual(
        " #military"
      );
      expect(
        utils.formatHashTag({ mil: "1", alt: "40000" }, jest.fn())
      ).toEqual(" #military #intheclouds");
    });
  });

  describe("formatIdentifier function", () => {
    it("properly formats string", () => {
      expect(utils.formatIdentifier("", "A12345", "")).toEqual(" #A12345");
      expect(utils.formatIdentifier("SWA123", "A12345", "N12345")).toEqual(
        " #N12345"
      );
      expect(utils.formatIdentifier("TEST123", "A12345", "98-0001")).toEqual(
        " #TEST123"
      );
      expect(utils.formatIdentifier("", "A12345", "N12345")).toEqual(
        " #N12345"
      );
    });
  });

  describe("formatOperator function", () => {
    describe("properly formats string", () => {
      it("with missing value", () => {
        expect(
          utils.formatOperator("", { val: () => ({}) }, { val: () => ({}) })
        ).toEqual("");
      });

      it("with custom operator", () => {
        jest.mock("./storage/operators.json", () => ({
          SWA: { n: "Southwest Airlines", c: "United States", r: "SOUTHWEST" }
        }));
        const utils = require("./utils.js");
        expect(
          utils.formatOperator(
            "SWA",
            {
              val: () => ({ description: "Foobar Airlines" })
            },
            { val: () => ({ SWA: "Cville Airlines" }) }
          )
        ).toEqual(" operated by Foobar Airlines");
      });

      it("with no db matches", () => {
        jest.mock("./storage/operators.json", () => ({}));
        const utils = require("./utils.js");
        expect(
          utils.formatOperator("SWA", { val: () => ({}) }, { val: () => ({}) })
        ).toEqual("");
      });

      it("with db match", () => {
        jest.mock("./storage/operators.json", () => ({
          SWA: { n: "Southwest Airlines", c: "United States", r: "SOUTHWEST" }
        }));
        const utils = require("./utils.js");
        expect(
          utils.formatOperator("SWA", { val: () => ({}) }, { val: () => ({}) })
        ).toEqual(" operated by Southwest Airlines");
      });

      it("with operator override", () => {
        jest.mock("./storage/operators.json", () => ({
          SWA: { n: "Southwest Airlines", c: "United States", r: "SOUTHWEST" }
        }));
        const utils = require("./utils.js");
        expect(
          utils.formatOperator(
            "SWA",
            { val: () => ({}) },
            { val: () => ({ SWA: "Cville Airlines" }) }
          )
        ).toEqual(" operated by Cville Airlines");
      });
    });
  });

  describe("formatSpeed function", () => {
    it("properly formats string", () => {
      expect(utils.formatSpeed("")).toEqual("");
      expect(utils.formatSpeed("0")).toEqual("");
      expect(utils.formatSpeed("1000")).toEqual(" at 1151 mph");
    });
  });

  describe("formatType function", () => {
    describe("properly formats string", () => {
      it("with missing value", () => {
        expect(utils.formatType("")).toEqual(" An aircraft");
      });

      it("with no db matches", () => {
        jest.mock("./storage/aircrafts.json", () => ({}));
        const utils = require("./utils.js");
        expect(utils.formatType("A12345", "G200")).toEqual(" A G200");
      });

      describe("with db match", () => {
        it("missing description", () => {
          jest.mock("./storage/aircrafts.json", () => ({
            A12345: { r: "ZS-AMA", t: "C208", f: "00", d: "" }
          }));
          const utils = require("./utils.js");
          expect(utils.formatType("A12345", "G200")).toEqual(" A C208");
        });

        it("description", () => {
          jest.mock("./storage/aircrafts.json", () => ({
            A12345: { r: "ZS-AMA", t: "C208", f: "00", d: "Cessna 208 B" }
          }));
          const utils = require("./utils.js");
          expect(utils.formatType("A12345", "G200")).toEqual(" A Cessna 208 B");
        });
      });
    });
  });

  describe("isNewState function", () => {
    let cooldown = 5;

    it("is true if snapshot doesn't exist", () => {
      expect(
        utils.isNewState({ exists: () => false, val: () => {} }, cooldown)
      ).toEqual(true);
    });

    it("is false if last timestamp is less than cooldown", () => {
      expect(
        utils.isNewState(
          {
            exists: () => true,
            val: () => ({ timestamps: [moment().subtract(2, "minutes")] })
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
            val: () => ({ timestamps: [moment().subtract(10, "minutes")] })
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
      expect(utils.numberWithCommas("100")).toEqual("100");
    });

    it("adds commas when appropriate", () => {
      expect(utils.numberWithCommas("1000")).toEqual("1,000");
      expect(utils.numberWithCommas("1000000")).toEqual("1,000,000");
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
