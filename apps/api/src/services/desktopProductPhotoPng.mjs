import {isDesktopPhotoDataUrl} from '../../../../packages/shared/src/desktopProductPhoto.mjs';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const fail=()=>{throw Error('DESKTOP_PRODUCT_PHOTO_INVALID');};
const table=Array.from({length:256},(_,i)=>{let n=i;for(let j=0;j<8;j++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(bytes){let v=0xffffffff;for(const b of bytes)v=table[(v^b)&255]^(v>>>8);return (v^0xffffffff)>>>0;}
export function validateDesktopPhotoPng(dataUrl){
 if(!isDesktopPhotoDataUrl(dataUrl))fail();const text=dataUrl.slice(22);const bytes=Buffer.from(text,'base64');if(bytes.length>4194304||bytes.length<57||bytes.toString('base64')!==text||!bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))fail();
 let p=8,width,height,depth,color,channels,rowBytes,idat=[],sawHeader=false,sawEnd=false,sawData=false,dataEnded=false,palette=0;
 while(p<bytes.length){if(p+12>bytes.length)fail();const n=bytes.readUInt32BE(p),end=p+12+n;if(end>bytes.length||n>4194304)fail();const kind=bytes.toString('ascii',p+4,p+8),body=bytes.subarray(p+8,p+8+n);if(!/^[A-Za-z]{4}$/.test(kind)||kind[2]!==kind[2].toUpperCase()||crc(bytes.subarray(p+4,p+8+n))!==bytes.readUInt32BE(p+8+n))fail();
  if(['acTL','fcTL','fdAT'].includes(kind))fail();if(!sawHeader&&kind!=='IHDR')fail();if(sawEnd)fail();if(sawData&&kind!=='IDAT')dataEnded=true;
  if(kind==='IHDR'){if(sawHeader||n!==13)fail();sawHeader=true;width=body.readUInt32BE(0);height=body.readUInt32BE(4);depth=body[8];color=body[9];channels=({0:1,2:3,3:1,4:2,6:4})[color];const allowed={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};if(!width||!height||width>2048||height>2048||!allowed[color]?.includes(depth)||body[10]||body[11]||body[12])fail();rowBytes=Math.ceil(width*channels*depth/8);}
  else if(kind==='PLTE'){if(palette||sawData||!n||n%3||n>768||[0,4].includes(color)||color===3&&n/3>2**depth)fail();palette=n/3;}
  else if(kind==='IDAT'){if(dataEnded||color===3&&!palette)fail();sawData=true;idat.push(body);}
  else if(kind==='IEND'){if(n||!sawData||end!==bytes.length)fail();sawEnd=true;}
  else if(kind[0]===kind[0].toUpperCase())fail();
  p=end;
 }
 if(!sawEnd)fail();let raw;try{const compressed=Buffer.concat(idat),result=inflateSync(compressed,{maxOutputLength:(rowBytes+1)*height,info:true});if(result.engine.bytesWritten!==compressed.length)fail();raw=result.buffer;}catch{fail();}if(raw.length!==(rowBytes+1)*height)fail();let previous=Buffer.alloc(rowBytes);const bpp=Math.max(1,Math.ceil(channels*depth/8));for(let y=0;y<height;y++){const offset=y*(rowBytes+1),filter=raw[offset];if(filter>4)fail();const row=Buffer.from(raw.subarray(offset+1,offset+1+rowBytes));for(let x=0;x<rowBytes;x++){const left=x>=bpp?row[x-bpp]:0,up=previous[x],ul=x>=bpp?previous[x-bpp]:0;let add=0;if(filter===1)add=left;else if(filter===2)add=up;else if(filter===3)add=Math.floor((left+up)/2);else if(filter===4){const v=left+up-ul,a=Math.abs(v-left),b=Math.abs(v-up),c=Math.abs(v-ul);add=a<=b&&a<=c?left:b<=c?up:ul;}row[x]=(row[x]+add)&255;}if(color===3)for(let x=0;x<width;x++){const bit=x*depth,shift=8-depth-(bit%8),index=(row[Math.floor(bit/8)]>>shift)&((1<<depth)-1);if(index>=palette)fail();}previous=row;}return Object.freeze({bytes,width,height,sha256:createHash('sha256').update(bytes).digest('hex')});
}
