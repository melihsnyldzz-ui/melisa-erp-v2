import test from 'node:test';import assert from 'node:assert/strict';
import {MASTER_V3_OPERATION_CHECK_SQL,MASTER_V3_RESERVE_SQL,MASTER_V3_FINISH_SQL} from './master-v3-journal-sql.mjs';
import {LOCAL_MASTER_RESERVE_SQL,LOCAL_MASTER_FINISH_SQL} from './local-master-schema-proposal.mjs';
test('v3 extends only the v2 operation clause while keeping request and payload checks intact',()=>{
 for(const [next,old] of [[MASTER_V3_RESERVE_SQL,LOCAL_MASTER_RESERVE_SQL],[MASTER_V3_FINISH_SQL,LOCAL_MASTER_FINISH_SQL]]){assert.match(next,/N'supplier\.create'/);assert.doesNotMatch(old,/N'supplier\.create'/);assert.match(next,/payload_hash/);assert.match(next,/@@TRANCOUNT/);assert.match(next,/actor_id/);}
 assert.match(MASTER_V3_OPERATION_CHECK_SQL,/DATALENGTH\(operation\)/);assert.match(MASTER_V3_OPERATION_CHECK_SQL,/CONVERT\(varbinary\(48\),operation\)/);
});
