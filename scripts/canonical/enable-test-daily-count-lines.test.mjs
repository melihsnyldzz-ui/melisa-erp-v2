import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(new URL('./enable-test-daily-count-lines.sql', import.meta.url), 'utf8');

test('count guard excludes only stock write fields and automatically generated rowversion', () => {
  const predicate = sql.match(/FROM sys\.columns WHERE ([^;]+);/u)?.[1];
  assert.ok(predicate, 'Product guard must build its comparison from all native columns');
  assert.equal(predicate, "object_id=OBJECT_ID(N'dbo.products') AND system_type_id<>189 AND name NOT IN(N'current_stock_qty',N'updated_at')");
  const explicitExclusions = [...predicate.matchAll(/N'([^']+)'/gu)].map(match => match[1]).slice(1);
  assert.deepEqual(explicitExclusions, ['current_stock_qty', 'updated_at']);
  for (const commercialField of ['stock_code', 'name', 'barcode', 'sale_price', 'cost_price', 'is_active', 'is_deleted']) {
    assert.ok(!explicitExclusions.includes(commercialField), `${commercialField} must remain immutable`);
  }
  assert.match(sql, /CONVERT\(varbinary\(max\),i\.'\+QUOTENAME\(name\)/u);
  assert.match(sql, /CONVERT\(varbinary\(max\),d\.'\+QUOTENAME\(name\)/u);
});

test('count field comparison retains exact commercial tuple and stock delta checks', () => {
  assert.match(sql, /NOT EXISTS\(SELECT __INSERTED_FIELDS__ EXCEPT SELECT __DELETED_FIELDS__\)/u);
  assert.match(sql, /l\.system=d\.current_stock_qty AND l\.physical=i\.current_stock_qty/u);
  assert.match(sql, /l\.fingerprint=dbo\.fn_test_daily_count_fingerprint\(i\.id,NULL\)/u);
});
