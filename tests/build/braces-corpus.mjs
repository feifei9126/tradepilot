import { createHash } from "node:crypto";

export function corpusDigest(braces) {
  const patterns = [
    "", "x", "a{b,c}d", "{1..5}", "{05..01}", "{-2..3}", "{a..e}",
    "{a,b{c,d}}", "a{b}c", "{{a,b},{c,d}}", "{a,a,,b}",
    String.raw`a\{b,c\}`, '(a{b,c})', '["{a,b}"]', '${a,b}',
    "a{b,c", "a{b}c}", "{a..c..2}", "{5..1..2}", "{a,b}/**/*.{ts,tsx}",
  ];
  for (let i = 0; i < 80; i++) patterns.push(`root/{a,b${i}}/file{1..3}.ts`);
  const options = [
    {}, { expand: true }, { expand: true, nodupes: true },
    { expand: true, noempty: true }, { escapeInvalid: true },
    { keepEscaping: true }, { keepQuotes: true },
  ];
  const results = [];
  for (const pattern of patterns) {
    for (const option of options) {
      for (const operation of ["compile", "expand", "stringify", "create"]) {
        results.push(braces[operation](pattern, option));
      }
    }
  }
  return { cases: results.length, digest: createHash("sha256").update(JSON.stringify(results)).digest("hex") };
}
