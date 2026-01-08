// utils/validators.js
export function isValidHttpUrl(string) {
  try {
    const u = new URL(string);
    return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname;
  } catch (err) {
    return false;
  }
}
