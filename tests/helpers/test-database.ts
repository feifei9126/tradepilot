/** Never fall back to a developer's DATABASE_URL, even in child test replicas. */
export function configureTestDatabase() {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) throw new Error("TEST_DATABASE_URL is required; use a separate local *_test database");
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || !/^\/[a-zA-Z0-9_-]+_test$/.test(url.pathname)) throw new Error("Refusing integration tests outside a loopback *_test database");
  process.env.DATABASE_URL = value;
  process.env.PGSSLMODE = "disable";
  return value;
}
