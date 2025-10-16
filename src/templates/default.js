import { resolveApproxWord, formatFeet } from '../utils.js';

export const speedTemplates = [
  {
    test: (mph) => mph >= 300,
    template: (mph, pickApproxWord) =>
      `Bolting along ${resolveApproxWord(pickApproxWord, ['near', 'around'])} ${mph} mph.`,
  },
  {
    test: (mph) => mph >= 200,
    template: (mph, pickApproxWord) =>
      `Cruising ${resolveApproxWord(pickApproxWord, ['near', 'around'])} ${mph} mph.`,
  },
  {
    test: (mph) => mph >= 120,
    template: (mph, pickApproxWord) =>
      `Making good time ${resolveApproxWord(pickApproxWord, ['around', 'near', 'about'])} ${mph} mph.`,
  },
  {
    test: (mph) => mph >= 60,
    template: (mph, pickApproxWord) =>
      `Taking a leisurely pass ${resolveApproxWord(pickApproxWord, ['around', 'near'])} ${mph} mph.`,
  },
  {
    test: () => true,
    template: (mph, pickApproxWord) =>
      `Drifting by ${resolveApproxWord(pickApproxWord, ['around', 'near', 'about'])} ${mph} mph.`,
  },
];

export const altitudeTemplates = [
  {
    test: (alt) => alt >= 30000,
    template: (alt, pickApproxWord) =>
      `Way up ${resolveApproxWord(pickApproxWord, ['around', 'near'])} ${formatFeet(alt)} ft.`,
  },
  {
    test: (alt) => alt >= 20000,
    template: (alt, pickApproxWord) =>
      `Cruising high ${resolveApproxWord(pickApproxWord, ['near', 'around'])} ${formatFeet(alt)} ft.`,
  },
  {
    test: (alt) => alt >= 10000,
    template: (alt, pickApproxWord) =>
      `Gliding along ${resolveApproxWord(pickApproxWord, ['around', 'near', 'about'])} ${formatFeet(alt)} ft.`,
  },
  {
    test: (alt) => alt >= 5000,
    template: (alt, pickApproxWord) =>
      `Keeping a comfy perch ${resolveApproxWord(pickApproxWord, ['around', 'near'])} ${formatFeet(alt)} ft.`,
  },
  {
    test: () => true,
    template: (alt, pickApproxWord) =>
      `Keeping it low ${resolveApproxWord(pickApproxWord, ['near', 'around', 'about'])} ${formatFeet(alt)} ft.`,
  },
];
