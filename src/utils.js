export const trimTrailingSlash = (value = '') => {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = value.toString();
  return stringValue.replace(/\/+$/, '');
};

export default {
  trimTrailingSlash
};
