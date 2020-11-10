const { hashtags } = require("./config");

describe("config", () => {
  describe("hashtags functions", () => {
    describe("interesting hashtag", () => {
      it("added when override is not set", () => {
        expect(
          hashtags[0](
            { interested: "1" },
            {
              val: () => ({})
            }
          )
        ).toEqual("interesting");
      });

      it("not added when override is set", () => {
        expect(
          hashtags[0](
            { interested: "1" },
            {
              val: () => ({ interesting: false })
            }
          )
        ).toEqual(false);
      });
    });

    it("adds military hashtag", () => {
      expect(hashtags[1]({ mil: "1" }, jest.fn())).toEqual("military");
    });

    it("adds frequentflyer hashtag", () => {
      expect(
        hashtags[2](
          {},
          {
            val: () => ({ timestamps: Array.from(Array(100).keys()) })
          }
        )
      ).toEqual("frequentflyer");
    });
  });
});
