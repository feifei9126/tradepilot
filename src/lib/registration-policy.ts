export function selfRegistrationEnabled(env: Record<string, string | undefined> = process.env) {
  return env.TRADEPILOT_SELF_REGISTRATION === "true";
}

export function isRegistrationPasswordAllowed(password: string) {
  if (password.length < 12 || password.length > 128 || new Set(password).size < 8) return false;
  return [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z\d]/].filter(pattern => pattern.test(password)).length >= 2;
}
