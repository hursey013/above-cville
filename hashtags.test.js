const moment = require("moment");

const hashtags = require("./hashtags");

describe("config", () => {
  describe("hashtags functions", () => {
    it("adds military hashtag", () => {
      expect(hashtags.military({}, jest.fn())).toEqual(false);
      expect(
        hashtags.military(
          { dbFlags: 1 },
          {
            val: () => ({})
          }
        )
      ).toEqual("military");
    });

    it("adds busyday hashtag", () => {
      expect(
        hashtags.busyday({}, { exists: () => false, val: () => {} })
      ).toEqual(false);

      expect(
        hashtags.busyday(
          {},
          {
            val: () => ({
              timestamps: {
                x12fdfsd: moment()
                  .subtract(10, "minutes")
                  .valueOf()
              }
            })
          },
          {
            val: () => ({})
          }
        )
      ).toEqual(false);

      expect(
        hashtags.busyday(
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
          },
          {
            val: () => ({})
          }
        )
      ).toEqual("busyday");

      expect(
        hashtags.busyday(
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
          },
          {
            val: () => ({})
          }
        )
      ).toEqual(false);
    });
  });
});
