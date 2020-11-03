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

    it("adds registration hashtag", () => {
      expect(
        hashtags[2](
          {
            call: "",
            reg: ""
          },
          jest.fn()
        )
      ).toEqual("");

      expect(
        hashtags[2](
          {
            call: "ABC-123",
            reg: ""
          },
          jest.fn()
        )
      ).toEqual("ABC123");
    });
  });
});

// 89-26190
