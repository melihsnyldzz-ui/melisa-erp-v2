import fs from 'node:fs/promises';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {CLEAN_TARGET_SQL} from '../../../scripts/canonical/clean-synthetic-sql.mjs';
const root='C:/Sirket/ERP/clean/20261022/runtime',source=await fs.readFile(new URL('./assets/clean-synthetic-product.svg',import.meta.url));
const originalOnly=process.argv.slice(2).join()==='--original-only';if(process.argv.length>2&&!originalOnly)throw Error('Unsupported media preparation mode');
await fs.mkdir(root+'/media',{recursive:true});
const images={};for(const [variant,size]of [['preview',320],['thumbnail',64]]){const bytes=await sharp(source).resize(size,size).png().toBuffer(),sha=createHash('sha256').update(bytes).digest('hex'),name=`${sha}-${variant}.png`;try{await fs.writeFile(root+'/media/'+name,bytes,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||createHash('sha256').update(await fs.readFile(root+'/media/'+name)).digest('hex')!==sha)throw e;}images[variant]={sha,name};}
// Preserve the source's natural raster dimensions. No resized preview is enlarged.
const original=await sharp(source).png().toBuffer(),natural=await sharp(original).metadata(),originalSha=createHash('sha256').update(original).digest('hex'),originalName=originalSha+'-original.png';
try{await fs.writeFile(root+'/media/'+originalName,original,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||createHash('sha256').update(await fs.readFile(root+'/media/'+originalName)).digest('hex')!==originalSha)throw e;}
const originalSql=`IF OBJECT_ID(N'dbo.clean_test_original_media',N'U') IS NOT NULL THROW 51993,'CLEAN_ORIGINAL_ALREADY_PRESENT',1;
IF NOT EXISTS(SELECT 1 FROM dbo.clean_test_media WHERE product_id=1 AND source_key=N'SYNTHETIC/20261022/products/1' AND preview_sha256='${images.preview.sha}' AND thumbnail_sha256='${images.thumbnail.sha}' AND verified=1) THROW 51993,'CLEAN_ORIGINAL_SOURCE_CHANGED',1;
CREATE TABLE dbo.clean_test_original_media(product_id bigint PRIMARY KEY REFERENCES dbo.clean_test_media(product_id),source_key nvarchar(250) NOT NULL UNIQUE,original_name nvarchar(100) NOT NULL,original_sha256 char(64) NOT NULL,source_svg_sha256 char(64) NOT NULL,natural_width int NOT NULL,natural_height int NOT NULL);
INSERT dbo.clean_test_original_media VALUES(1,N'SYNTHETIC/20261022/products/1',N'${originalName}','${originalSha}','${createHash('sha256').update(source).digest('hex')}',${natural.width},${natural.height});
EXEC(N'CREATE TRIGGER dbo.clean_test_original_media_immutable ON dbo.clean_test_original_media AFTER INSERT,UPDATE,DELETE AS BEGIN THROW 51993,''CLEAN_ORIGINAL_IMMUTABLE'',1;END;');`;
const sql=`SET QUOTED_IDENTIFIER ON;SET ANSI_NULLS ON;SET XACT_ABORT ON;${CLEAN_TARGET_SQL}
BEGIN TRANSACTION;
${originalOnly?'':`IF OBJECT_ID(N'dbo.clean_test_media',N'U') IS NOT NULL THROW 51993,'CLEAN_MEDIA_ALREADY_PRESENT',1;
CREATE TABLE dbo.clean_test_media(product_id bigint PRIMARY KEY REFERENCES dbo.products(id),source_key nvarchar(250) NOT NULL UNIQUE,preview_name nvarchar(100) NOT NULL,preview_sha256 char(64) NOT NULL,thumbnail_name nvarchar(100) NOT NULL,thumbnail_sha256 char(64) NOT NULL,verified bit NOT NULL CHECK(verified=1));
INSERT dbo.clean_test_media VALUES(1,N'SYNTHETIC/20261022/products/1',N'${images.preview.name}','${images.preview.sha}',N'${images.thumbnail.name}','${images.thumbnail.sha}',1);
INSERT dbo.product_images(product_id,file_path,storage_key,is_primary) VALUES(1,N'clean-synthetic/${images.preview.name}',N'SYNTHETIC/20261022/products/1',1);
EXEC(N'CREATE TRIGGER dbo.clean_test_media_immutable ON dbo.clean_test_media AFTER INSERT,UPDATE,DELETE AS BEGIN THROW 51993,''CLEAN_MEDIA_IMMUTABLE'',1;END;');`}
${originalSql}
COMMIT;SELECT N'SYNTHETIC_MEDIA_CREATED' result;`;
await fs.writeFile(root+(originalOnly?'/media-original.sql':'/media.sql'),sql);console.log(JSON.stringify({result:'SYNTHETIC_MEDIA_PREPARED',originalOnly,naturalWidth:natural.width,naturalHeight:natural.height,originalSha256:originalSha}));
