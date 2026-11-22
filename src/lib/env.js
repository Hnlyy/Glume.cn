export function envGet(env, key, fallback = '') {
  if (env && typeof env[key] === 'string' && env[key] !== '') return env[key];
  try {
    if (globalThis.process && globalThis.process.env && globalThis.process.env[key]) {
      return globalThis.process.env[key];
    }
  } catch (_) {}
  return fallback;
}
