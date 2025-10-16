import { resolveApproxWord, formatFeet } from '../utils.js';

export const speedTemplates = [
  {
    test: (mph) => mph >= 130,
    template: (mph, pickApproxWord) =>
      `Chopping through ${resolveApproxWord(pickApproxWord, ['around', 'near'])} ${mph} mph.`,
  },
  {
    test: (mph) => mph >= 80,
    template: (mph, pickApproxWord) =>
      `Cruising the pattern ${resolveApproxWord(pickApproxWord, ['around', 'near'])} ${mph} mph.`,
  },
  {
    test: () => true,
    template: (mph, pickApproxWord) =>
      `Hovering ${resolveApproxWord(pickApproxWord, ['around', 'near'])} ${mph} mph.`,
  },
];

export const altitudeTemplates = [
  {
    test: (alt) => alt <= 1200,
    template: (alt, pickApproxWord) =>
      `Skimming the skyline ${resolveApproxWord(pickApproxWord, ['near', 'around'])} ${formatFeet(alt)} ft.`,
  },
  {
    test: () => true,
    template: (alt, pickApproxWord) =>
      `Holding above town ${resolveApproxWord(pickApproxWord, ['around', 'near', 'about'])} ${formatFeet(alt)} ft.`,
  },
];
