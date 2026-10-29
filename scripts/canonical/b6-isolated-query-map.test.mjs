import test from 'node:test';
import assert from 'node:assert/strict';
import {
  B6_ISOLATED_QUERY_ARTIFACT,
  B6_ISOLATED_SELECTED_QUERIES,
  extractB6IsolatedQueryContext,
} from './b6-isolated-query-map.mjs';

// Public tests contain no captured definitions or business records. Successful
// source extraction was checked separately against the private frozen artifact.
const rejected = /B6_QUERY_FROZEN_DEFINITION_MISMATCH/;
const end = fragment => fragment.offset + fragment.length;
const within = (child, parent) => {
  assert(child.offset >= parent.offset);
  assert(end(child) <= end(parent));
};
const contextOf = map => [
  ...map.declareStatements,
  ...map.tempContext,
].sort((a, b) => a.fragment.offset - b.fragment.offset);

test('only exact known reader names can request a source slice', () => {
  const known = B6_ISOLATED_SELECTED_QUERIES[0].module;
  for (const name of [undefined, null, '', known.toUpperCase(), `${known} `,
    'dbo.usp_b6_reader_unknown_v1', 'dbo.usp_other; DROP TABLE dbo.products']) {
    assert.throws(() => extractB6IsolatedQueryContext(name, 'SELECT 1;'), rejected);
  }
});

test('caller objects and synthetic SQL cannot substitute for a frozen definition', () => {
  const notText = { toString() { throw new Error('COERCION_MUST_NOT_RUN'); } };
  for (const map of B6_ISOLATED_SELECTED_QUERIES) {
    for (const value of [undefined, null, notText, Buffer.from('SELECT 1;'),
      new String('SELECT 1;'), '', 'SELECT 1;', 'SELECT 1;\n']) {
      assert.throws(() => extractB6IsolatedQueryContext(map.module, value), rejected);
    }
    // Correct offsets/length and a plausible SELECT shape are insufficient.
    const length = map.statement.length;
    const select = 'SELECT 1;'.padEnd(length, ' ');
    const synthetic = ' '.repeat(map.statement.offset) + select + '\nEND;';
    for (const value of [synthetic, synthetic + ' ', synthetic.replace('SELECT', 'select'),
      synthetic.replace('\n', '\r\n'), '\uFEFF' + synthetic]) {
      assert.throws(() => extractB6IsolatedQueryContext(map.module, value), rejected);
    }
  }
});

test('exported metadata cannot be widened or repinned by an importing caller', () => {
  const map = B6_ISOLATED_SELECTED_QUERIES[0];
  assert.throws(() => { B6_ISOLATED_QUERY_ARTIFACT.classification = 'REHEARSAL'; }, TypeError);
  assert.throws(() => B6_ISOLATED_SELECTED_QUERIES.push({ module: 'caller' }), TypeError);
  assert.throws(() => { map.definitionHash = '0'.repeat(64); }, TypeError);
  assert.throws(() => { map.statement.offset = 0; }, TypeError);
  assert.throws(() => map.tempContext.push({ relation: '#caller' }), TypeError);
  assert.throws(() => map.selectedReferences.variables.push('@caller'), TypeError);
  assert.throws(() => { map.aggregates[0].query.length = 1; }, TypeError);
});

test('fragment ranges preserve statement/query containment and distinct aggregate scopes', () => {
  assert.equal(B6_ISOLATED_SELECTED_QUERIES.length, 2);
  for (const map of B6_ISOLATED_SELECTED_QUERIES) {
    assert.equal(map.statement.type, 'SelectStatement');
    assert.equal(map.outerQuery.type, 'QuerySpecification');
    within(map.outerQuery, map.statement);
    assert.equal(map.aggregates.length, 2);
    const [metadata, payload] = map.aggregates;
    assert.notEqual(metadata.ordering, payload.ordering);
    assert(end(metadata.query) <= payload.query.offset);
    for (const item of map.aggregates) {
      within(item.query, map.outerQuery);
      within(item.call, item.query);
      assert.equal(item.call.type, 'FunctionCall');
      assert.equal(item.query.type, 'QuerySpecification');
    }
    const fragments = [map.statement, map.outerQuery,
      ...map.aggregates.flatMap(item => [item.query, item.call]),
      ...map.procedureParameters.map(item => item.fragment),
      ...contextOf(map).map(item => item.fragment)];
    for (const fragment of fragments) {
      assert(Number.isSafeInteger(fragment.offset) && fragment.offset >= 0);
      assert(Number.isSafeInteger(fragment.length) && fragment.length > 0);
      assert(fragment.line > 0 && fragment.endLine >= fragment.line && fragment.column > 0);
      assert.match(fragment.sha256Utf16LE, /^[A-F0-9]{64}$/);
      assert(end(fragment) <= end(map.statement));
    }
  }
  // Separate AST scopes/different ordering is metadata, not an 8711 diagnosis.
});

test('source-ordered context has no unresolved local variables or temporary relations', () => {
  for (const map of B6_ISOLATED_SELECTED_QUERIES) {
    const variables = new Set(map.procedureParameters.map(item => item.name));
    const temps = new Set();
    let previousEnd = 0;
    for (const item of contextOf(map)) {
      assert(item.fragment.offset >= previousEnd);
      assert(end(item.fragment) <= map.statement.offset);
      previousEnd = end(item.fragment);
      for (const variable of item.references.variables) assert(variables.has(variable), variable);
      for (const relation of item.references.relations.filter(name => name.startsWith('#'))) {
        assert(temps.has(relation), relation);
      }
      for (const variable of item.variables || []) variables.add(variable.name);
      if (item.relation) {
        assert.match(item.relation, /^#[A-Za-z][A-Za-z0-9]*$/);
        assert(!temps.has(item.relation));
        temps.add(item.relation);
        const expectedType = { CREATE_TEMP_TABLE: 'CreateTableStatement',
          SELECT_INTO_TEMP: 'SelectStatement' }[item.kind];
        assert(expectedType, item.kind);
        assert.equal(item.fragment.type, expectedType);
      } else assert.equal(item.fragment.type, 'DeclareVariableStatement');
    }
    for (const variable of map.selectedReferences.variables) assert(variables.has(variable), variable);
    for (const relation of map.selectedReferences.relations.filter(name => name.startsWith('#'))) {
      assert(temps.has(relation), relation);
    }
    assert.equal(map.procedureParameters.filter(item => !item.hasDefault).length, 1);
    assert.equal(map.procedureParameters.find(item => !item.hasDefault).name, '@actor_id');
  }
});

test('scope remains two display SELECT diagnostics without projection or admission context', () => {
  assert.equal(B6_ISOLATED_QUERY_ARTIFACT.classification, 'DIAGNOSTIC_PARTIAL_NOT_REHEARSAL');
  assert.deepEqual(B6_ISOLATED_SELECTED_QUERIES.map(map => map.tempContext.length), [7, 19]);
  assert.deepEqual(B6_ISOLATED_SELECTED_QUERIES.map(map => map.declareStatements.length), [2, 1]);
  for (const map of B6_ISOLATED_SELECTED_QUERIES) {
    assert.equal(map.selectedProjectionCalls, 0);
    assert.equal(map.moduleExecuteAsOwner, true);
    assert(map.functions.includes('OBJECT_DEFINITION'));
    assert(map.selectedReferences.relations.includes('sys.triggers'));
    assert(!map.selectedReferences.relations.some(name => /canonical_business_sale_(scope|intents)/i.test(name)));
  }
});
