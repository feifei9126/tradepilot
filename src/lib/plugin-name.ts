export const PLUGIN_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function isValidPluginName(value: string) {
  return PLUGIN_NAME_PATTERN.test(value);
}
