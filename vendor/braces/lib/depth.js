'use strict';

// TradePilot security patch for GHSA-vfj7-8cjw-p6xm. Keep this validation
// iterative: using recursion here would reproduce the vulnerable AST walkers.
const MAX_DEPTH = 64;
const MAX_NODES = 131072;

const invalid = (code, message) => {
  const error = new SyntaxError(message);
  error.code = code;
  return error;
};

const assertDepth = depth => {
  if (depth > MAX_DEPTH) {
    throw invalid('ERR_BRACES_MAX_DEPTH', `Brace AST exceeds maximum depth (${MAX_DEPTH})`);
  }
};

const assertAst = ast => {
  const pending = [{ node: ast, depth: 0 }];
  const ancestors = new WeakSet();
  let scheduled = 1;

  while (pending.length > 0) {
    const { node, depth, leaving } = pending.pop();
    if (node === null || typeof node !== 'object') continue;
    if (leaving) {
      ancestors.delete(node);
      continue;
    }
    assertDepth(depth);
    if (ancestors.has(node)) {
      throw invalid('ERR_BRACES_CYCLIC_AST', 'Brace AST contains a child-node cycle');
    }
    ancestors.add(node);
    pending.push({ node, leaving: true });

    if (Array.isArray(node.nodes)) {
      scheduled += node.nodes.length;
      if (scheduled > MAX_NODES) {
        throw invalid('ERR_BRACES_MAX_NODES', `Brace AST exceeds maximum nodes (${MAX_NODES})`);
      }
      for (let i = node.nodes.length - 1; i >= 0; i--) {
        pending.push({ node: node.nodes[i], depth: depth + 1 });
      }
    }
  }
};

module.exports = { assertAst, assertDepth };
