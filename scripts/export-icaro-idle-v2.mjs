import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
const source = path.resolve("art/source/interceptadorIcaro/v2/idle"), art = path.resolve("art/sprites/interceptadorIcaro/idle"), runtime = path.resolve("src/game/assets/troop/interceptadorIcaro/idle"), qa = path.resolve("art/qa/interceptadorIcaro-v2");
const size = 384, safe = 12, rootX = 192, baseline = 371;
await Promise.all([fs.mkdir(art,{recursive:true}),fs.mkdir(runtime,{recursive:true}),fs.mkdir(qa,{recursive:true})]);
const raw = (file) => sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
function bounds({data,info}) { let l=info.width,r=-1,t=info.height,b=-1; for(let i=0;i<info.width*info.height;i++) if(data[i*info.channels+3]>8){const x=i%info.width,y=Math.floor(i/info.width);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);} return {l,r,t,b,width:r-l+1,height:b-t+1}; }
const frames = await Promise.all(Array.from({length:8},(_,i)=>raw(path.join(source,`frame${i}.png`)))); const boxes=frames.map(bounds);
const union={l:Math.min(...boxes.map(b=>b.l)),r:Math.max(...boxes.map(b=>b.r)),t:Math.min(...boxes.map(b=>b.t)),b:Math.max(...boxes.map(b=>b.b))}; union.width=union.r-union.l+1;union.height=union.b-union.t+1;
const scale=Math.min((size-safe*2)/union.width,327/union.height), outW=Math.round(union.width*scale),outH=Math.round(union.height*scale), sourceFootX=(boxes[0].l+boxes[0].r)/2, left=Math.round(rootX-(sourceFootX-union.l)*scale),top=baseline-outH+1;
if(left<safe||left+outW>size-safe||top<safe)throw new Error("O union-bound do Ícaro não cabe no canvas runtime.");
const outputs=[];for(let i=0;i<8;i++){const crop=await sharp(frames[i].data,{raw:frames[i].info}).extract({left:union.l,top:union.t,width:union.width,height:union.height}).resize(outW,outH,{kernel:sharp.kernel.lanczos3}).png().toBuffer();const output=await sharp({create:{width:size,height:size,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:crop,left,top}]).png({compressionLevel:9,effort:10}).toBuffer();await Promise.all([fs.writeFile(path.join(art,`frame${i}.png`),output),fs.writeFile(path.join(runtime,`frame${i}.png`),output)]);outputs.push(output);}
await Promise.all([fs.writeFile(path.resolve("art/sprites/interceptadorIcaro/death/frame0.png"),outputs[0]),fs.writeFile(path.resolve("src/game/assets/troop/interceptadorIcaro/death/frame0.png"),outputs[0])]);
await sharp({create:{width:size*8,height:size,channels:4,background:{r:18,g:22,b:34,alpha:1}}}).composite(outputs.map((input,i)=>({input,left:i*size,top:0}))).png().toFile(path.join(qa,"idle-runtime-grid.png"));
const game=await Promise.all(outputs.map((input,i)=>sharp(input).resize(148,148).png().toBuffer().then(buffer=>({input:buffer,left:i*148,top:0}))));await sharp({create:{width:148*8,height:148,channels:4,background:{r:18,g:22,b:34,alpha:1}}}).composite(game).png().toFile(path.join(qa,"idle-game-size.png"));
await fs.writeFile(path.resolve("art/source/interceptadorIcaro/v2/measurements.json"),`${JSON.stringify({runtime:{size,safe,root:{x:rootX,y:baseline}},union,scale,placement:{left,top,width:outW,height:outH}},null,2)}\n`);console.log(`Idle v2 exportado: union ${union.width}x${union.height}, escala ${scale.toFixed(4)}.`);
