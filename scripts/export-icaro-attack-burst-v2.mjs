import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sourceDir = path.resolve("art/source/interceptadorIcaro/generated/attackBurst-v2");
const dest = path.resolve("art/sprites/interceptadorIcaro/attackBurst");
const canvas = 384; const safe = 12; const rootX = 192; const baseline = 371;
const raw = async (file) => sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
function box(frame) { let left=frame.info.width,right=-1,top=frame.info.height,bottom=-1; for(let i=0;i<frame.info.width*frame.info.height;i++) if(frame.data[i*frame.info.channels+3]>8){const x=i%frame.info.width,y=Math.floor(i/frame.info.width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);} return {left,right,top,bottom,width:right-left+1,height:bottom-top+1}; }
const frames = await Promise.all(Array.from({ length:8 },(_,frame)=>raw(path.join(sourceDir,`frame${frame}.png`)))); const ref=box(frames[0]);
const scale=Math.min((canvas-safe*2)/ref.width,327/ref.height); const width=Math.round(ref.width*scale),height=Math.round(ref.height*scale); const left=Math.round(rootX-width/2),top=baseline-height+1;
for(let frame=0;frame<8;frame++){const image=await sharp(frames[frame].data,{raw:frames[frame].info}).extract({left:ref.left,top:ref.top,width:ref.width,height:ref.height}).resize(width,height,{kernel:sharp.kernel.lanczos3}).png().toBuffer(); await sharp({create:{width:canvas,height:canvas,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:image,left,top}]).png({compressionLevel:9,adaptiveFiltering:true,effort:10}).toFile(path.join(dest,`frame${frame}.png`));}
