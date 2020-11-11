const moment = require("moment");

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
      expect(hashtags[1]({}, jest.fn())).toEqual(false);
      expect(hashtags[1]({ mil: "1" }, jest.fn())).toEqual("military");
    });

    it("adds busyday hashtag", () => {
      expect(hashtags[2]({}, { exists: () => false, val: () => {} })).toEqual(
        false
      );

      expect(
        hashtags[2](
          {},
          {
            val: () => ({
              timestamps: {
                x12fdfsd: moment()
                  .subtract(10, "minutes")
                  .valueOf()
              }
            })
          }
        )
      ).toEqual(false);

      expect(
        hashtags[2](
          {},
          {
            val: () => ({
              timestamps: {
                x12fdfsd: moment()
                  .subtract(10, "minutes")
                  .valueOf(),
                fsdg2342: moment()
                  .subtract(20, "minutes")
                  .valueOf(),
                r3242343: moment()
                  .subtract(30, "minutes")
                  .valueOf()
              }
            })
          }
        )
      ).toEqual("busyday");

      expect(
        hashtags[2](
          {},
          {
            val: () => ({
              timestamps: {
                r3242343: moment()
                  .subtract(2, "days")
                  .valueOf(),
                fsdg2342: moment()
                  .subtract(4, "days")
                  .valueOf(),
                x12fdfsd: moment()
                  .subtract(6, "days")
                  .valueOf()
              }
            })
          }
        )
      ).toEqual(false);
    });
  });
});
