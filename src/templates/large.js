import { resolveApproxWord, formatFeet } from '../utils.js';

export const speedTemplates = [
  {
    test: (mph) => mph >= 280,
    template: (mph, pickApproxWord) =>
      `Making a brisk pass ${resolveApproxWord(pickApproxWord, ['around', 'near'])} ${mph} mph.`,
  },
  {
    test: (mph) => mph >= 200,
    template: (mph, pickApproxWord) =>
      `Keeping the cadence ${resolveApproxWord(pickApproxWord, ['near', 'around'])} ${mph} mph.`,
  },
  {
    test: () => true,
    template: (mph, pickApproxWord) =>
      `Rolling by ${resolveApproxWord(pickApproxWord, ['around', 'near', 'about'])} ${mph} mph.`,
  },
];

export const altitudeTemplates = [
  {
    test: (alt) => alt >= 20000,
    template: (alt, pickApproxWord) =>
      `Cruising solid ${resolveApproxWord(pickApproxWord, ['near', 'around'])} ${formatFeet(alt)} ft.`,
  },
  {
    test: (alt) => alt >= 10000,
    template: (alt, pickApproxWord) =>
      `Keeping a stately perch ${resolveApproxWord(pickApproxWord, ['around', 'near'])} ${formatFeet(alt)} ft.`,
  },
  {
    test: () => true,
    template: (alt, pickApproxWord) =>
      `Rolling through ${resolveApproxWord(pickApproxWord, ['around', 'near', 'about'])} ${formatFeet(alt)} ft.`,
  },
];
