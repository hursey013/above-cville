import { resolveApproxWord, formatFeet } from '../utils.js';

export const speedTemplates = [
  {
    test: (mph) => mph >= 200,
    template: (mph) => `Pacing at ${mph} mph.`,
  },
  {
    test: (mph) => mph >= 120,
    template: (mph, pickApproxWord) =>
      `Scooting ${resolveApproxWord(pickApproxWord, ['near', 'around'])} ${mph} mph.`,
  },
  {
    test: (mph) => mph >= 60,
    template: (mph, pickApproxWord) =>
      `Easy pass ${resolveApproxWord(pickApproxWord, ['around', 'near', 'about'])} ${mph} mph.`,
  },
  {
    test: () => true,
    template: (mph, pickApproxWord) =>
      `Loitering ${resolveApproxWord(pickApproxWord, ['near', 'around', 'about'])} ${mph} mph.`,
  },
];

export const altitudeTemplates = [
  {
    test: (alt) => alt >= 10000,
    template: (alt, pickApproxWord) =>
      `Steady ${resolveApproxWord(pickApproxWord, ['near', 'around'])} ${formatFeet(alt)} ft.`,
  },
  {
    test: (alt) => alt >= 5000,
    template: (alt, pickApproxWord) =>
      `Level ${resolveApproxWord(pickApproxWord, ['around', 'near', 'about'])} ${formatFeet(alt)} ft.`,
  },
  {
    test: () => true,
    template: (alt, pickApproxWord) =>
      `Low ${resolveApproxWord(pickApproxWord, ['near', 'around', 'about'])} ${formatFeet(alt)} ft.`,
  },
];
