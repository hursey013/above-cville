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
      mil: "1"
    };
    let link = "https://www.airport-data.com/.../00123.html";

    describe("properly formats status with ", () => {
      beforeEach(() => {
        jest.mock("./config.js", () => ({
          abbreviations: [],
          actionPhrases: ["Can you see it?"],
          articles: {}
        }));
        jest.mock("./storage/operators.json", () => ({
          SWA: { n: "Southwest Airlines", c: "United States", r: "SOUTHWEST" }
        }));
      });

      it("all values empty", () => {
        const utils = require("./utils.js");
        expect(utils.createStatus({ val: jest.fn() }, {})).toEqual(
          "Can you see it? An aircraft is currently flying overhead"
        );
      });

      it("all values present", () => {
        const utils = require("./utils.js");
        expect(utils.createStatus(snap, state, link)).toEqual(
          "Can you see it? A G200 (SWA123) operated by Southwest Airlines, seen once before, is currently flying 28,000 ft overhead and heading SW at 497 mph #military 📡https://globe.adsbexchange.com/?icao=A12345 📷https://www.airport-data.com/.../00123.html"
        );
      });

      it("missing type value", () => {
        const utils = require("./utils.js");
        expect(utils.createStatus(snap, { ...state, type: "" }, link)).toEqual(
          "Can you see it? An aircraft (SWA123) operated by Southwest Airlines, seen once before, is currently flying 28,000 ft overhead and heading SW at 497 mph #military 📡https://globe.adsbexchange.com/?icao=A12345 📷https://www.airport-data.com/.../00123.html"
        );
      });

      it("missing identifiers values", () => {
        const utils = require("./utils.js");
        expect(
          utils.createStatus(snap, { ...state, call: "", reg: "", icao: "" })
        ).toEqual(
          "Can you see it? A G200, seen once before, is currently flying 28,000 ft overhead and heading SW at 497 mph #military"
        );
      });

      it("missing operator value", () => {
        jest.mock("./storage/operators.json", () => ({}));
        const utils = require("./utils.js");
        expect(utils.createStatus(snap, state, link)).toEqual(
          "Can you see it? A G200 (SWA123), seen once before, is currently flying 28,000 ft overhead and heading SW at 497 mph #military 📡https://globe.adsbexchange.com/?icao=A12345 📷https://www.airport-data.com/.../00123.html"
        );
      });

      it("missing count value", () => {
        const utils = require("./utils.js");
        expect(utils.createStatus({ val: () => {} }, state, link)).toEqual(
          "Can you see it? A G200 (SWA123) operated by Southwest Airlines is currently flying 28,000 ft overhead and heading SW at 497 mph #military 📡https://globe.adsbexchange.com/?icao=A12345 📷https://www.airport-data.com/.../00123.html"
        );
      });

      it("missing altitude value", () => {
        const utils = require("./utils.js");
        expect(utils.createStatus(snap, { ...state, alt: "" }, link)).toEqual(
          "Can you see it? A G200 (SWA123) operated by Southwest Airlines, seen once before, is currently flying overhead and heading SW at 497 mph #military 📡https://globe.adsbexchange.com/?icao=A12345 📷https://www.airport-data.com/.../00123.html"
        );
      });

      it("missing direction value value", () => {
        const utils = require("./utils.js");
        expect(utils.createStatus(snap, { ...state, trak: "" }, link)).toEqual(
          "Can you see it? A G200 (SWA123) operated by Southwest Airlines, seen once before, is currently flying 28,000 ft overhead at 497 mph #military 📡https://globe.adsbexchange.com/?icao=A12345 📷https://www.airport-data.com/.../00123.html"
        );
      });

      it("missing speed value", () => {
        const utils = require("./utils.js");
        expect(utils.createStatus(snap, { ...state, spd: "" }, link)).toEqual(
          "Can you see it? A G200 (SWA123) operated by Southwest Airlines, seen once before, is currently flying 28,000 ft overhead and heading SW #military 📡https://globe.adsbexchange.com/?icao=A12345 📷https://www.airport-data.com/.../00123.html"
        );
      });

      it("missing hashtags values", () => {
        const utils = require("./utils.js");
        expect(utils.createStatus(snap, { ...state, mil: "0" }, link)).toEqual(
          "Can you see it? A G200 (SWA123) operated by Southwest Airlines, seen once before, is currently flying 28,000 ft overhead and heading SW at 497 mph 📡https://globe.adsbexchange.com/?icao=A12345 📷https://www.airport-data.com/.../00123.html"
        );
      });

      it("missing photo link value", () => {
        const utils = require("./utils.js");
        expect(utils.createStatus(snap, state)).toEqual(
          "Can you see it? A G200 (SWA123) operated by Southwest Airlines, seen once before, is currently flying 28,000 ft overhead and heading SW at 497 mph #military 📡https://globe.adsbexchange.com/?icao=A12345"
        );
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
    it("properly formats string", () => {
      expect(utils.formatHashTag("", { val: () => {} })).toEqual("");
      expect(
        utils.formatHashTag("1", {
          val: () => {
            [1603572682275];
          }
        })
      ).toEqual(" #military");
      expect(
        utils.formatHashTag("", {
          val: () => ({ timestamps: Array.from(Array(20).keys()) })
        })
      ).toEqual(" #frequentflyer");
      expect(
        utils.formatHashTag("1", {
          val: () => ({ timestamps: Array.from(Array(20).keys()) })
        })
      ).toEqual(" #military #frequentflyer");
    });
  });

  describe("formatIdentifier function", () => {
    it("properly formats string", () => {
      expect(utils.formatIdentifier("")).toEqual("");
      expect(utils.formatIdentifier("SWA123", "A12345", "N12345")).toEqual(
        " (SWA123)"
      );
      expect(utils.formatIdentifier("", "A12345", "N12345")).toEqual(
        " (N12345)"
      );
      expect(utils.formatIdentifier("", "A12345", "")).toEqual(" (A12345)");
    });
  });

  describe("formatOperator function", () => {
    describe("properly formats string", () => {
      it("with missing value", () => {
        expect(utils.formatOperator("", { val: () => ({}) })).toEqual("");
      });

      it("with custom operator", () => {
        jest.mock("./storage/operators.json", () => ({
          SWA: { n: "Southwest Airlines", c: "United States", r: "SOUTHWEST" }
        }));
        const utils = require("./utils.js");
        expect(
          utils.formatOperator("SWA123", {
            val: () => ({ description: "Foobar Airlines" })
          })
        ).toEqual(" operated by Foobar Airlines");
      });

      it("with no db matches", () => {
        jest.mock("./storage/operators.json", () => ({}));
        const utils = require("./utils.js");
        expect(utils.formatOperator("SWA123", { val: () => ({}) })).toEqual("");
      });

      it("with db match", () => {
        jest.mock("./storage/operators.json", () => ({
          SWA: { n: "Southwest Airlines", c: "United States", r: "SOUTHWEST" }
        }));
        const utils = require("./utils.js");
        expect(utils.formatOperator("SWA123", { val: () => ({}) })).toEqual(
          " operated by Southwest Airlines"
        );
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
