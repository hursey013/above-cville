const { hashtags } = require("./config");

describe("config", () => {
  describe("hashtags functions", () => {
    it("adds military hashtag", () => {
      expect(hashtags[0]({ mil: "1" }, jest.fn())).toEqual("military");
    });

    it("adds frequentflyer hashtag", () => {
      expect(
        hashtags[1](
          {},
          {
            val: () => ({ timestamps: Array.from(Array(100).keys()) })
          }
        )
      ).toEqual("frequentflyer");
    });

    it("adds toFrom hashtag", () => {
      expect(
        hashtags[2](
          {
            from: "EWR Newark Liberty United States",
            to: "TPA Tampa United States"
          },
          jest.fn()
        )
      ).toEqual("EWRtoTPA");
    });
  });
});
