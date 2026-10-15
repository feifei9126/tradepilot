import { corpusDigest } from "./braces-corpus.mjs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { realpathSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";

const require = createRequire(import.meta.url);
const braces = require("../../vendor/braces");
const deeplyNested = "{".repeat(4_500) + "a,b" + "}".repeat(4_500);

for (const operation of ["parse", "compile", "expand", "stringify"]) {
  test(`braces ${operation} rejects deep input with a bounded, identifiable error`, () => {
    assert.throws(() => braces[operation](deeplyNested), {
      name: "SyntaxError", code: "ERR_BRACES_MAX_DEPTH",
    });
  });
}

function nestedAst(depth) {
  let node = { type: "text", value: "x" };
  for (let i = 0; i < depth; i++) node = { type: "root", nodes: [node] };
  return node;
}

for (const operation of ["compile", "expand", "stringify"]) {
  test(`braces ${operation} validates caller-supplied AST depth and cycles`, () => {
    assert.throws(() => braces[operation](nestedAst(10_000)), { code: "ERR_BRACES_MAX_DEPTH" });
    const cyclic = { type: "root", nodes: [] };
    cyclic.nodes.push(cyclic);
    assert.throws(() => braces[operation](cyclic), { code: "ERR_BRACES_CYCLIC_AST" });
    const wide = { type: "root", nodes: Array(131_073).fill({ type: "text", value: "x" }) };
    assert.throws(() => braces[operation](wide), { code: "ERR_BRACES_MAX_NODES" });
  });
}

test("normal brace expansion, regex compilation and escaped literals stay compatible", () => {
  assert.deepEqual(braces.expand("src/{app,lib}/file-{01..03}.ts"), [
    "src/app/file-01.ts", "src/app/file-02.ts", "src/app/file-03.ts",
    "src/lib/file-01.ts", "src/lib/file-02.ts", "src/lib/file-03.ts",
  ]);
  assert.equal(braces.compile("a/{b,c}/d"), "a/(b|c)/d");
  assert.equal(braces.stringify(braces.parse("a/{b,c}/d")), "a/{b,c}/d");
  assert.deepEqual(braces.expand(String.raw`a/\{b,c\}/d`), ["a/{b,c}/d"]);
});

test("the ESLint micromatch chain actually resolves the patched local package", () => {
  const fromMicromatch = createRequire(require.resolve("micromatch"));
  assert.equal(realpathSync(fromMicromatch.resolve("braces")), realpathSync(require.resolve("../../vendor/braces")));
  const micromatch = require("micromatch");
  assert.deepEqual(micromatch(["src/app/index.ts", "src/lib/util.ts", "README.md"], "src/{app,lib}/*.ts"), [
    "src/app/index.ts", "src/lib/util.ts",
  ]);
  assert.throws(() => micromatch.braces(deeplyNested), { code: "ERR_BRACES_MAX_DEPTH" });
});

test("patched source differs from upstream only by guards and EOF normalization", () => {
  const provenance = require("../../vendor/braces/UPSTREAM.json");
  for (const [path, hash] of Object.entries(provenance.originalSha256)) {
    if (!path.endsWith(".js")) continue;
    const source = readFileSync(new URL(`../../vendor/braces/${path}`, import.meta.url), "utf8")
      .replace("\nconst { assertAst, assertDepth } = require('./depth');", "")
      .replace("\nconst { assertAst } = require('./depth');\n", "")
      .replaceAll("      assertDepth(stack.length);\n", "")
      .replaceAll("  assertAst(ast);\n", "");
    // Restore upstream's extra blank EOF line for the original source hash;
    // the checkout uses a single final newline to pass git diff --check.
    const upstreamSource = path === "lib/stringify.js" ? `${source}\n` : source;
    assert.equal(createHash("sha256").update(upstreamSource).digest("hex"), hash, path);
  }
});

test("the guard allows bounded ASTs and cannot be disabled by caller options", () => {
  assert.equal(braces.compile(nestedAst(64)), "x");
  assert.throws(() => braces.compile(deeplyNested, { maxDepth: Infinity }), { code: "ERR_BRACES_MAX_DEPTH" });
  assert.throws(() => braces.parse("(".repeat(4_500) + "x" + ")".repeat(4_500)), { code: "ERR_BRACES_MAX_DEPTH" });
  assert.throws(() => braces.parse("{".repeat(4_500) + "x"), { code: "ERR_BRACES_MAX_DEPTH" });
});

test("2800 normal operations match the pristine upstream 3.0.3 corpus", () => {
  assert.deepEqual(corpusDigest(braces), {"cases":2800,"digest":"e99a9b5b7547ca406592b067358ffec7e14ae6302c3b5bee6320c1e49c5483d2"});
});
