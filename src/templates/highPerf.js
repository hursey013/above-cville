import { resolveApproxWord, formatFeet } from '../utils.js';

export const speedTemplates = [
  {
    test: (mph) => mph >= 300,
    template: (mph, pickApproxWord) =>
      `Ripping along ${resolveApproxWord(pickApproxWord, ['near', 'around'])} ${mph} mph.`,
  },
  {
    test: (mph) => mph >= 200,
    template: (mph, pickApproxWord) =>
      `Keeping the throttle up ${resolveApproxWord(pickApproxWord, ['around', 'near'])} ${mph} mph.`,
  },
  {
    test: () => true,
    template: (mph, pickApproxWord) =>
      `Loosening the reins ${resolveApproxWord(pickApproxWord, ['around', 'near', 'about'])} ${mph} mph.`,
  },
];

export const altitudeTemplates = [
  {
    test: (alt) => alt >= 20000,
    template: (alt, pickApproxWord) =>
      `Knifing through ${resolveApproxWord(pickApproxWord, ['around', 'near'])} ${formatFeet(alt)} ft.`,
  },
  {
    test: (alt) => alt >= 10000,
    template: (alt, pickApproxWord) =>
      `Slicing the sky ${resolveApproxWord(pickApproxWord, ['near', 'around'])} ${formatFeet(alt)} ft.`,
  },
  {
    test: () => true,
    template: (alt, pickApproxWord) =>
      `Darting by ${resolveApproxWord(pickApproxWord, ['around', 'near', 'about'])} ${formatFeet(alt)} ft.`,
  },
];
