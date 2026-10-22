import fs from 'node:fs';
import bcrypt from 'bcrypt';
import {buildCleanSeedSql} from '../../../scripts/canonical/clean-synthetic-seed.mjs';
import {buildCleanSyntheticOrderSql} from '../../../scripts/canonical/clean-synthetic-sql.mjs';
let input='';for await(const chunk of process.stdin)input+=chunk;
const {password,output}=JSON.parse(input);if(typeof password!=='string'||password.length<20||!output.endsWith('runtime/seed-and-orders.sql'))throw Error('Preparation input rejected');
const settings='SET QUOTED_IDENTIFIER ON;SET ANSI_NULLS ON;SET ANSI_PADDING ON;SET ANSI_WARNINGS ON;SET CONCAT_NULL_YIELDS_NULL ON;SET ARITHABORT ON;SET NUMERIC_ROUNDABORT OFF;';
fs.writeFileSync(output,settings+'\n'+buildCleanSeedSql(await bcrypt.hash(password,12))+'\nGO\n'+settings+'\n'+buildCleanSyntheticOrderSql());
console.log('CLEAN_SQL_PREPARED');
