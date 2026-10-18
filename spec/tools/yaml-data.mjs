// Compose bounded YAML without a JS call stack proportional to input depth.
// Each collection keeps its original syntax tokens, but its children are empty
// collection shells while yaml checks that level. Completed children are then
// attached as data. This also avoids yaml.visit/toJS recursion on unknown fields.
/**
 * Compose one YAML document into JSON-compatible data using iterative collection shells.
 * Reject composition errors/warnings, collection or non-string keys and non-JSON scalars;
 * input byte limits and lexical exclusions are enforced by the caller.
 */
export function yamlData(source, yaml) {
  const options = { schema: 'core', uniqueKeys: true, strict: true, prettyErrors: false, keepSourceTokens: true };
  const tokens = [...new yaml.Parser().parse(source)];
  const documents = tokens.filter(t => t.type === 'document');
  if (documents.length !== 1) throw Error('PROFILE_INVALID');
  const document = documents[0];
  const collections = [], pending = [document.value];
  while (pending.length) {
    const token = pending.pop();
    if (!yaml.CST.isCollection(token)) continue;
    collections.push(token);
    for (const item of token.items) {
      // Collection keys are forbidden; don't ask the composer to recurse into them.
      if (yaml.CST.isCollection(item.key)) throw Error('PROFILE_INVALID');
      if (item.value) pending.push(item.value);
    }
  }
  const values = new Map();
  /**
   * Compose one token stream, replace known shells with completed child data and build values iteratively.
   * Reject document errors/warnings and unsupported nodes or scalars; return data and the root end offset.
   */
  function compose(stream, shells) {
    const docs = [...new yaml.Composer(options).compose(stream)];
    if (docs.length !== 1 || docs[0].errors.length || docs[0].warnings.length) throw Error('PROFILE_INVALID');
    const result = {}, work = [{ node: docs[0].contents, parent: result, key: 'value' }];
    while (work.length) {
      const { node, parent, key } = work.pop();
      if (shells.has(node?.srcToken)) {
        parent[key] = shells.get(node.srcToken);
      } else if (node == null || yaml.isScalar(node)) {
        const value = node == null ? null : node.value;
        if (!jsonScalar(value)) throw Error('PROFILE_INVALID');
        parent[key] = value;
      } else if (yaml.isMap(node)) {
        const data = Object.create(null);
        parent[key] = data;
        for (const pair of [...node.items].reverse()) {
          if (!yaml.isScalar(pair.key) || typeof pair.key.value !== 'string' || !jsonScalar(pair.key.value)) throw Error('PROFILE_INVALID');
          work.push({ node: pair.value, parent: data, key: pair.key.value });
        }
      } else if (yaml.isSeq(node)) {
        const data = new Array(node.items.length);
        parent[key] = data;
        node.items.forEach((child, i) => work.push({ node: child, parent: data, key: i }));
      } else throw Error('PROFILE_INVALID');
    }
    return { data: result.value, end: docs[0].contents?.range[2] };
  }
  let root;
  for (const token of collections.reverse()) {
    const shells = new Map();
    const shallow = { ...token, items: token.items.map(item => {
      if (!yaml.CST.isCollection(item.value)) return item;
      const child = values.get(item.value);
      const shell = { ...item.value, items: [] };
      // Empty block collections end at their offset. Anchor the placeholder at
      // the already validated child's end so the next implicit key is measured
      // from its actual context, not from the start of the removed subtree.
      // Flow shells retain their original delimiters, which supply the end.
      if (shell.type !== 'flow-collection') shell.offset = child.end;
      shells.set(shell, child.data);
      return { ...item, value: shell };
    }) };
    if (token === document.value) {
      root = compose(tokens.map(t => t === document ? { ...t, value: shallow } : t), shells);
    } else {
      values.set(token, compose([{ type: 'document', offset: token.offset, start: [], value: shallow }], shells));
    }
  }
  return (collections.length ? root : compose(tokens, new Map())).data;
}

/** Accept null, booleans, finite numbers and strings without unpaired surrogates as scalar data. */
function jsonScalar(value) {
  if (typeof value === 'string') return !/[\uD800-\uDFFF]/u.test(value);
  if (typeof value === 'number') return Number.isFinite(value);
  return value === null || typeof value === 'boolean';
}
