import { resolveApproxWord, formatFeet } from '../utils.js';

export const speedTemplates = [
  {
    test: (mph) => mph >= 300,
    template: (mph, pickApproxWord) =>
      `Hauling ${resolveApproxWord(pickApproxWord, ['near', 'around'])} ${mph} mph.`,
  },
  {
    test: (mph) => mph >= 200,
    template: (mph, pickApproxWord) =>
      `Rolling ${resolveApproxWord(pickApproxWord, ['near', 'around'])} ${mph} mph.`,
  },
  {
    test: () => true,
    template: (mph, pickApproxWord) =>
      `Keeping the widebody moving ${resolveApproxWord(pickApproxWord, ['around', 'near', 'about'])} ${mph} mph.`,
  },
];

export const altitudeTemplates = [
  {
    test: (alt) => alt >= 30000,
    template: (alt, pickApproxWord) =>
      `Stacked way up ${resolveApproxWord(pickApproxWord, ['near', 'around'])} ${formatFeet(alt)} ft.`,
  },
  {
    test: (alt) => alt >= 20000,
    template: (alt, pickApproxWord) =>
      `Cruising that big frame ${resolveApproxWord(pickApproxWord, ['near', 'around'])} ${formatFeet(alt)} ft.`,
  },
  {
    test: (alt) => alt >= 10000,
    template: (alt, pickApproxWord) =>
      `Looming overhead ${resolveApproxWord(pickApproxWord, ['around', 'near', 'about'])} ${formatFeet(alt)} ft.`,
  },
  {
    test: () => true,
    template: (alt, pickApproxWord) =>
      `Low ${resolveApproxWord(pickApproxWord, ['around', 'near', 'about'])} ${formatFeet(alt)} ft.`,
  },
];
