import fs from 'node:fs/promises';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {CLEAN_TARGET_SQL} from '../../../scripts/canonical/clean-synthetic-sql.mjs';
const root='C:/Sirket/ERP/clean/20261022/runtime',source=await fs.readFile(new URL('./assets/clean-synthetic-product.svg',import.meta.url));
await fs.mkdir(root+'/media',{recursive:true});
const images={};for(const [variant,size]of [['preview',320],['thumbnail',64]]){const bytes=await sharp(source).resize(size,size).png().toBuffer(),sha=createHash('sha256').update(bytes).digest('hex'),name=`${sha}-${variant}.png`;try{await fs.writeFile(root+'/media/'+name,bytes,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||createHash('sha256').update(await fs.readFile(root+'/media/'+name)).digest('hex')!==sha)throw e;}images[variant]={sha,name};}
const sql=`SET QUOTED_IDENTIFIER ON;SET ANSI_NULLS ON;SET XACT_ABORT ON;${CLEAN_TARGET_SQL}
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.clean_test_media',N'U') IS NOT NULL THROW 51993,'CLEAN_MEDIA_ALREADY_PRESENT',1;
CREATE TABLE dbo.clean_test_media(product_id bigint PRIMARY KEY REFERENCES dbo.products(id),source_key nvarchar(250) NOT NULL UNIQUE,preview_name nvarchar(100) NOT NULL,preview_sha256 char(64) NOT NULL,thumbnail_name nvarchar(100) NOT NULL,thumbnail_sha256 char(64) NOT NULL,verified bit NOT NULL CHECK(verified=1));
INSERT dbo.clean_test_media VALUES(1,N'SYNTHETIC/20261022/products/1',N'${images.preview.name}','${images.preview.sha}',N'${images.thumbnail.name}','${images.thumbnail.sha}',1);
INSERT dbo.product_images(product_id,file_path,storage_key,is_primary) VALUES(1,N'clean-synthetic/${images.preview.name}',N'SYNTHETIC/20261022/products/1',1);
EXEC(N'CREATE TRIGGER dbo.clean_test_media_immutable ON dbo.clean_test_media AFTER INSERT,UPDATE,DELETE AS BEGIN THROW 51993,''CLEAN_MEDIA_IMMUTABLE'',1;END;');
COMMIT;SELECT N'SYNTHETIC_MEDIA_CREATED' result;`;
await fs.writeFile(root+'/media.sql',sql);console.log('SYNTHETIC_MEDIA_PREPARED');
