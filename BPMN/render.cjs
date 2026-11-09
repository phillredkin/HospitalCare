#!/usr/bin/env node
/**
 * Rebuild the editable BPMN/draw.io and SVG/PNG exports from diagram_model.json.
 *   node BPMN/render.cjs                 # includes PNGs; finds Chrome/Chromium
 *   node BPMN/render.cjs --vector-only   # no browser required
 *   node BPMN/render.cjs --check         # read-only model/layout validation
 * Optional: CHROME_PATH or --browser <executable>. No npm packages are needed.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const DIR = __dirname;
const m = JSON.parse(fs.readFileSync(path.join(DIR, 'diagram_model.json'), 'utf8'));
const nodes = Object.values(m.nodes);
const view = m.presentation;
const theme = view.theme;
const STEP = 12;
const esc = v => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const round = n => Math.round(n * 100) / 100;
const isTask = n => n.kind?.endsWith('Task') || false;
const bounds = n => ({ x:n.x, y:n.y, w:n.w, h:n.h });
const overlaps = (a,b,p=0) => a.x < b.x+b.w+p && a.x+a.w > b.x-p && a.y < b.y+b.h+p && a.y+a.h > b.y-p;
const inside = (p,r,pad=0) => p[0]>r.x-pad && p[0]<r.x+r.w+pad && p[1]>r.y-pad && p[1]<r.y+r.h+pad;
function width(text, size) {
  return [...text].reduce((sum,c)=>sum+(/[ilIjtfr.,:;!'|]/u.test(c)?0.29:/[MW@%]/u.test(c)?0.86:c===' '?0.28:0.56),0)*size;
}
function wrap(text,maxWidth,size=18) {
  const result=[];
  for (const paragraph of text.split('\n')) {
    let line='';
    for(const word of paragraph.split(/\s+/).filter(Boolean)) {
      if(line && width(`${line} ${word}`,size)>maxWidth){result.push(line);line=word;}
      else line=line?`${line} ${word}`:word;
    }
    if(line)result.push(line);
  }
  return result;
}
function labelRect(n) {
  if(!n.label || isTask(n) || n.kind==='subProcess')return null;
  const w = n.kind==='exclusiveGateway'?240:192;
  const lines=wrap(n.label,w-12,16);
  const h=lines.length*22+8;
  if(n.kind==='boundaryEvent')return {x:n.x-w-24,y:n.cy+12,w,h};
  return {x:n.cx-w/2,y:n.kind==='exclusiveGateway'?n.y-h-12:n.y+n.h+12,w,h};
}
for(const n of nodes) {
  n.labelBounds=labelRect(n);
  if(isTask(n))assert.ok(wrap(n.label,n.w-32,theme.taskFont).length<=4,`Task caption too long: ${n.id}`);
}
function crosses(a,b,r,pad=0) {
  if(a[0]===b[0])return a[0]>r.x-pad && a[0]<r.x+r.w+pad && Math.max(a[1],b[1])>r.y-pad && Math.min(a[1],b[1])<r.y+r.h+pad;
  assert.equal(a[1],b[1],'Connectors must be orthogonal');
  return a[1]>r.y-pad && a[1]<r.y+r.h+pad && Math.max(a[0],b[0])>r.x-pad && Math.min(a[0],b[0])<r.x+r.w+pad;
}
function compact(points) {
  const out=[];
  for(const p of points) {
    if(out.length&&out.at(-1)[0]===p[0]&&out.at(-1)[1]===p[1])continue;
    while(out.length>1 && ((out.at(-2)[0]===out.at(-1)[0]&&out.at(-1)[0]===p[0]) || (out.at(-2)[1]===out.at(-1)[1]&&out.at(-1)[1]===p[1])))out.pop();
    out.push(p);
  }
  return out;
}
class Heap {
  constructor(){this.items=[];}
  push(item){let i=this.items.length;this.items.push(item);while(i){const p=(i-1)>>1;if(this.items[p].priority<=item.priority)break;this.items[i]=this.items[p];i=p;}this.items[i]=item;}
  pop(){const root=this.items[0],last=this.items.pop();if(this.items.length){let i=0;while(i*2+1<this.items.length){let c=i*2+1;if(c+1<this.items.length&&this.items[c+1].priority<this.items[c].priority)c++;if(last.priority<=this.items[c].priority)break;this.items[i]=this.items[c];i=c;}this.items[i]=last;}return root;}
}
const usage = new Map();
const key = p => `${p[0]},${p[1]}`;
const allLines=[];
const flowLabels=[];
function areaFor(scope) {
  if(scope==='SP_Predict'){const s=m.nodes.SP_Predict;return {x:s.x+24,y:s.y+72,w:s.w-48,h:s.h-96};}
  if(scope==='P2')return {x:5544,y:4032,w:4752,h:1320};
  if(scope==='P1')return {x:240,y:312,w:10056,h:3408};
  return {x:240,y:312,w:view.width-264,h:5040};
}
function obstaclesFor(scope) {
  const result=[];
  for(const n of nodes) {
    if(scope==='ALL' ? n.scope==='SP_Predict' : n.scope!==scope)continue;
    result.push({...bounds(n),id:n.id});
    if(n.labelBounds)result.push({...n.labelBounds,id:`label:${n.id}`});
  }
  for(const a of m.annotations||[])if(scope==='ALL'||a.scope===scope)result.push({...bounds(a),id:a.id});
  // Message flows can cross a pool border, while avoiding its heading text.
  if(scope==='ALL')for(const b of m.boxes.filter(b=>b.kind==='pool'))result.push({x:b.x,y:b.y,w:width(b.label,22)+64,h:72,id:`header:${b.id}`});
  for(const r of flowLabels)result.push({...r,id:'flow-label'});
  return result;
}
function port(n,side) {
  const p=side==='R'?[n.x+n.w,n.cy]:side==='L'?[n.x,n.cy]:side==='T'?[n.cx,n.y]:[n.cx,n.y+n.h];
  const delta={R:[36,0],L:[-36,0],T:[0,-36],B:[0,36]}[side];
  return {p,stub:[p[0]+delta[0],p[1]+delta[1]],side};
}
function sides(n,other,source) {
  if(n.kind==='boundaryEvent')return ['B','R','L'];
  const dx=other.cx-n.cx,dy=other.cy-n.cy;
  let order=Math.abs(dx)>Math.abs(dy)*0.7 ? (dx>=0?['R','B','T','L']:['L','B','T','R']) : (dy>=0?['B','R','L','T']:['T','R','L','B']);
  // Keep top-mounted gateway captions outside connector exit paths.
  if(n.kind==='exclusiveGateway'&&n.label)order=order.filter(s=>s!=='T');
  return order;
}
const hints={
 F004:['B','T'],F017:['B','T'],F027:['B','T'],F033:['R','L'],F034:['B','L'],
 F011:['R','L'],F012:['B','L'],F048:['B','B'],F050:['R','L'],F061:['B','B'],
 F099:['R','L'],F100:['B','T'],F102:['R','L'],F103:['B','T'],F105:['R','L'],
 F106:['B','B'],F127:['R','L'],F128:['B','B'],F130:['B','B'],
 F112:['R','L'],F113:['B','R'],F134:['B','T'],F135:['R','L'],F137:['R','L'],F138:['B','T'],
 F145:['R','L'],F146:['B','T'],F169:['R','L'],F170:['B','B'],F160:['B','T'],F161:['R','L'],
 M_Request:['B','T'],M_Response:['T','R'],
};
function search(start,end,area,obstacles,limit=240000) {
  if(!inside(start,area,-0.1)||!inside(end,area,-0.1))return null;
  const nx=Math.round(area.w/STEP)+1,ny=Math.round(area.h/STEP)+1;
  const ix=x=>Math.round((x-area.x)/STEP),iy=y=>Math.round((y-area.y)/STEP);
  const sx=ix(start[0]),sy=iy(start[1]),tx=ix(end[0]),ty=iy(end[1]);
  const blocked=new Uint8Array(nx*ny);
  for(const r of obstacles) {
    const x1=Math.max(0,Math.ceil((r.x-18-area.x+0.01)/STEP)),x2=Math.min(nx-1,Math.floor((r.x+r.w+18-area.x-0.01)/STEP));
    const y1=Math.max(0,Math.ceil((r.y-18-area.y+0.01)/STEP)),y2=Math.min(ny-1,Math.floor((r.y+r.h+18-area.y-0.01)/STEP));
    for(let y=y1;y<=y2;y++)blocked.fill(1,y*nx+x1,y*nx+x2+1);
  }
  if(blocked[sy*nx+sx]||blocked[ty*nx+tx])return null;
  const heap=new Heap(),cost=new Map(),previous=new Map();
  const initial=(sy*nx+sx)*3;
  cost.set(initial,0);heap.push({id:initial,x:sx,y:sy,dir:0,priority:(Math.abs(tx-sx)+Math.abs(ty-sy))*STEP,cost:0});
  let visits=0;
  while(heap.items.length && visits++<limit) {
    const c=heap.pop();if(c.cost!==cost.get(c.id))continue;
    if(c.x===tx&&c.y===ty) {
      const points=[];let id=c.id;
      while(id!==undefined){const pos=Math.floor(id/3);points.push([area.x+(pos%nx)*STEP,area.y+Math.floor(pos/nx)*STEP]);id=previous.get(id);}
      return {points:compact(points.reverse()),cost:c.cost};
    }
    for(const [dx,dy,dir] of [[1,0,1],[-1,0,1],[0,1,2],[0,-1,2]]) {
      const x=c.x+dx,y=c.y+dy;
      if(x<0||x>=nx||y<0||y>=ny||blocked[y*nx+x])continue;
      const wx=area.x+x*STEP,wy=area.y+y*STEP,used=usage.get(`${wx},${wy}`)||0;
      const shared=used&dir,intersection=used&&(used&dir)===0;
      const nearby=usage.get(`${wx+(dir===2?STEP:0)},${wy+(dir===1?STEP:0)}`)||usage.get(`${wx-(dir===2?STEP:0)},${wy-(dir===1?STEP:0)}`)||0;
      const distance=c.cost+STEP+(c.dir&&c.dir!==dir?28:0)+(shared?180:0)+(intersection?42:0)+(nearby&dir?18:0);
      const id=(y*nx+x)*3+dir;
      if(distance>=(cost.get(id)??Infinity))continue;
      cost.set(id,distance);previous.set(id,c.id);
      heap.push({id,x,y,dir,cost:distance,priority:distance+(Math.abs(tx-x)+Math.abs(ty-y))*STEP});
    }
  }
  return null;
}
function addUsage(points) {
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dir=a[1]===b[1]?1:2;
    const steps=(Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]))/STEP;
    for(let j=0;j<=steps;j++){
      const p=[a[0]+Math.sign(b[0]-a[0])*j*STEP,a[1]+Math.sign(b[1]-a[1])*j*STEP];
      usage.set(key(p),(usage.get(key(p))||0)|dir);
    }
    allLines.push([a,b]);
  }
}
function placeFlowLabel(f,obstacles) {
  if(!f.label){delete f.labelBounds;delete f.label_pos;return;}
  const lines=wrap(f.label,190,theme.flowFont),w=Math.max(40,Math.ceil(Math.max(...lines.map(l=>width(l,theme.flowFont))))+16),h=lines.length*21+8;
  const candidates=[];
  for(let i=1;i<f.points.length;i++){
    const a=f.points[i-1],b=f.points[i],length=Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);
    if(length<48)continue;
    const near=Math.min(0.5,((a[1]===b[1]?w:h)/2+24)/length);
    for(const [rank,t] of [near,0.5,0.75].entries()){
      const x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;
      const score=10000-i*500-rank*80+Math.min(length,200);
      if(a[1]===b[1])for(const above of [true,false])candidates.push({x:x-w/2,y:above?y-h-10:y+10,w,h,score});
      else for(const right of [true,false])candidates.push({x:right?x+12:x-w-12,y:y-h/2,w,h,score});
    }
  }
  const area=areaFor(m.messages.includes(f)?'ALL':m.nodes[f.source].scope);
  candidates.sort((a,b)=>b.score-a.score);
  const r=candidates.find(r=>r.x>=area.x&&r.y>=area.y&&r.x+r.w<=area.x+area.w&&r.y+r.h<=area.y+area.h && !obstacles.some(o=>overlaps(r,o,8)) && !allLines.some(([a,b])=>crosses(a,b,r,6)));
  if(!r)throw Error(`No clear label position: ${f.id} (${f.label})`);
  delete r.score;f.labelBounds=r;f.label_pos=[round(r.x+r.w/2),round(r.y+r.h/2)];flowLabels.push(r);
}
function route(f,message=false) {
  const source=m.nodes[f.source],target=m.nodes[f.target],scope=message?'ALL':source.scope;
  const obstacles=obstaclesFor(scope),area=areaFor(scope);
  const combos=[];
  if(hints[f.id])combos.push(hints[f.id]);
  const ss=hints[f.id]?[hints[f.id][0]]:sides(source,target,true),ts=sides(target,source,false);
  for(let rank=0;rank<7;rank++)for(let i=0;i<ss.length;i++)for(let j=0;j<ts.length;j++)if(i+j===rank&&!combos.some(p=>p[0]===ss[i]&&p[1]===ts[j]))combos.push([ss[i],ts[j]]);
  let winner;
  for(const [a,b] of combos){
    const s=port(source,a),t=port(target,b);
    if(obstacles.some(o=>o.id!==source.id&&o.id!==target.id&&(crosses(s.p,s.stub,o,4)||crosses(t.p,t.stub,o,4))))continue;
    const found=search(s.stub,t.stub,area,obstacles);
    if(!found)continue;
    winner=compact([s.p,...found.points,t.p]);break;
  }
  if(!winner)throw Error(`Cannot route ${f.id}: ${f.source} -> ${f.target}`);
  f.points=winner;addUsage(f.points);
  placeFlowLabel(f,obstacles);
}
function routeAll() {
  // Local, forward paths first; long return paths take the remaining corridors.
  const distance=f=>{const a=m.nodes[f.source],b=m.nodes[f.target];return Math.abs(a.cx-b.cx)+Math.abs(a.cy-b.cy)+(b.cx<a.cx?1800:0);};
  const secondary=f=>f.condition?.startsWith('!')?1:0;
  const sorted=[...m.flows].sort((a,b)=>(m.nodes[a.source].scope==='SP_Predict'?-1:0)-(m.nodes[b.source].scope==='SP_Predict'?-1:0)||secondary(a)-secondary(b)||distance(a)-distance(b)||a.id.localeCompare(b.id));
  for(const f of sorted)route(f);
  for(const f of m.messages)route(f,true);
  for(const a of m.annotations||[]){const target=m.nodes[a.target];a.points=[[a.x+a.w,a.y+48],[target.x,a.y+48]];}
}
function validate() {
  assert.equal(nodes.filter(isTask).length,72);
  assert.equal(m.boxes.filter(b=>b.kind==='pool').length,2);
  assert.equal(m.flows.length,125);
  assert.equal(m.messages.length,2);
  const ids=[...nodes.map(n=>n.id),...m.boxes.map(b=>b.id),...m.flows.map(f=>f.id),...m.messages.map(f=>f.id),...(m.annotations||[]).map(a=>a.id)];
  assert.equal(ids.length,new Set(ids).size,'Duplicate IDs');
  for(let i=1;i<=72;i++)assert.ok(isTask(m.nodes[`T${String(i).padStart(2,'0')}`]));
  for(const n of nodes){
    const container=n.scope==='SP_Predict'?m.nodes.SP_Predict:m.boxes.find(b=>b.kind==='lane'&&b.lane===n.lane);
    if(n.kind!=='boundaryEvent')assert.ok(n.x>=container.x&&n.y>=container.y&&n.x+n.w<=container.x+container.w&&n.y+n.h<=container.y+container.h,`${n.id} outside its container`);
    if(n.kind==='boundaryEvent'){
      const owner=m.nodes[n.attachedToRef];assert.ok(owner,`Missing attachment: ${n.id}`);
      assert.ok(n.cy===owner.y+owner.h||n.cx===owner.x+owner.w,`Detached event: ${n.id}`);
    }
  }
  for(const a of m.annotations||[]){
    const lane=m.boxes.find(b=>b.kind==='lane'&&b.parent===m.boxes.find(p=>p.processRef===a.scope)?.id);
    assert.ok(lane&&a.x>=lane.x+144&&a.x+a.w<=lane.x+lane.w,`Annotation overlaps a lane heading: ${a.id}`);
  }
  const obstacles=nodes.filter(n=>n.kind!=='subProcess').flatMap(n=>[{...bounds(n),id:n.id},...(n.labelBounds?[{...n.labelBounds,id:`label:${n.id}`}]:[])]);
  for(const f of [...m.flows,...m.messages]){
    const a=m.nodes[f.source],b=m.nodes[f.target];assert.ok(a&&b,`Unresolved flow: ${f.id}`);
    if(m.flows.includes(f))assert.equal(a.scope,b.scope,`Cross-scope sequence: ${f.id}`);
    else assert.notEqual(a.scope,b.scope,`Message must connect pools: ${f.id}`);
    const onBoundary=(p,n)=>[port(n,'R'),port(n,'L'),port(n,'T'),port(n,'B')].some(a=>a.p[0]===p[0]&&a.p[1]===p[1]);
    assert.ok(onBoundary(f.points[0],a)&&onBoundary(f.points.at(-1),b),`Detached connector: ${f.id}`);
    for(let i=1;i<f.points.length;i++){
      assert.ok(f.points[i][0]===f.points[i-1][0]||f.points[i][1]===f.points[i-1][1],`Diagonal: ${f.id}`);
      for(const o of obstacles)if(![a.id,b.id].includes(o.id))assert.ok(!crosses(f.points[i-1],f.points[i],o),`${f.id} crosses ${o.id}`);
    }
    if(f.labelBounds)for(const o of obstacles)assert.ok(!overlaps(f.labelBounds,o),`Label ${f.id} overlaps ${o.id}`);
  }
  for(const f of [...m.flows,...m.messages])for(const other of [...m.flows,...m.messages]){
    if(f===other||!other.labelBounds)continue;
    for(let i=1;i<f.points.length;i++)assert.ok(!crosses(f.points[i-1],f.points[i],other.labelBounds),`${f.id} crosses caption ${other.id}`);
  }
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
    const a=nodes[i],b=nodes[j];
    if(a.kind==='boundaryEvent'||b.kind==='boundaryEvent'||a.scope!==b.scope)continue;
    assert.ok(!overlaps(a,b),`Overlapping nodes: ${a.id}, ${b.id}`);
    if(a.labelBounds)assert.ok(!overlaps(a.labelBounds,b),`Caption ${a.id} overlaps ${b.id}`);
    if(b.labelBounds)assert.ok(!overlaps(b.labelBounds,a),`Caption ${b.id} overlaps ${a.id}`);
  }
  const visited=new Set(),pending=nodes.filter(n=>n.kind==='startEvent'&&n.scope!=='SP_Predict').map(n=>n.id);
  while(pending.length){const id=pending.pop();if(visited.has(id))continue;visited.add(id);for(const f of m.flows)if(f.source===id)pending.push(f.target);for(const n of nodes)if((n.kind==='startEvent'&&n.scope===id)||(n.kind==='boundaryEvent'&&n.attachedToRef===id))pending.push(n.id);}
  assert.ok(nodes.filter(isTask).every(n=>visited.has(n.id)),'Unreachable activities');
  return {activities:72,gateways:nodes.filter(n=>n.kind==='exclusiveGateway').length,sequenceFlows:m.flows.length,messageFlows:m.messages.length,allActivitiesReachable:true,connectorsAvoidNodesAndCaptions:true};
}
function text(r,value,size=18,{color=theme.text,bold=false,align='center',maxWidth=r.w-16}={}) {
  const lines=wrap(value,maxWidth,size),lineHeight=size*1.25,x=align==='left'?r.x+8:r.x+r.w/2;
  const y=r.y+r.h/2-(lines.length-1)*lineHeight/2+size*0.35;
  return `<text x="${round(x)}" y="${round(y)}" text-anchor="${align==='left'?'start':'middle'}" font-size="${size}" fill="${color}"${bold?' font-weight="600"':''}>${lines.map((l,i)=>`<tspan x="${round(x)}" dy="${i?lineHeight:0}">${esc(l)}</tspan>`).join('')}</text>`;
}
function glyph(type,color=theme.text) {
  const common=`fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`;
  if(type==='userTask')return `<g ${common}><circle cx="12" cy="6" r="3.3"/><path d="M6 21v-7a6 6 0 0 1 12 0v7M6 15H3v-3M18 15h3v-3M9 16v5m6-5v5"/></g>`;
  if(type==='serviceTask')return `<g ${common}><path d="m9 2 .8 3 2.4 1.4 3-.8 2 3-2.1 2.3v2.8l2.1 2.3-2 3-3-.8-2.4 1.4-.8 3H5.6l-.8-3-2.4-1.4-3 .8-2-3 2.1-2.3v-2.8L-2.6 8.6l2-3 3 .8L4.8 5l.8-3Z" transform="translate(4 0) scale(.85)"/><circle cx="10.1" cy="10.4" r="3"/><path d="m19 14 1 2 2 .4v3l-2 .4-1 2h-3l-1-2-2-.4v-3l2-.4 1-2Z"/><circle cx="17.5" cy="18" r="1.6"/></g>`;
  if(type==='sendTask'||type==='receiveTask'||type==='message')return `<g ${common}><rect x="2" y="5" width="20" height="14" rx=".5" fill="${type==='sendTask'?color:'#FFFFFF'}"/><path d="m2 5 10 8 10-8" stroke="${type==='sendTask'?'#FFFFFF':color}"/></g>`;
  if(type==='timer')return `<g ${common}><circle cx="12" cy="12" r="9.5"/>${Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return `<path d="M${12+8*Math.sin(a)} ${12-8*Math.cos(a)} L${12+6.5*Math.sin(a)} ${12-6.5*Math.cos(a)}"/>`;}).join('')}<path d="M12 6v6l4 3"/></g>`;
  if(type==='error')return `<path d="m14 1-9 12 6-1-1 11 9-14-6 2Z" fill="${color}"/>`;
  return '';
}
function icon(type,x,y,size=24,color=theme.text){return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24">${glyph(type,color)}</svg>`;}
function nodeColor(n){return n.lane==='Admin'?'#42678E':n.lane==='Doctor'?'#287765':n.lane==='ML'?'#71638E':theme.border;}
function svgNode(n){
  let out=`<g id="${esc(n.id)}"><title>${esc(n.id)} · ${esc(n.documentation||n.label)}</title>`;
  if(isTask(n))out+=`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="12" fill="${theme.taskFill}" stroke="${nodeColor(n)}" stroke-width="2"/>${icon(n.kind,n.x+12,n.y+10,24)}${text({x:n.x+n.w-60,y:n.y+7,w:50,h:24},n.id,12,{color:theme.muted})}${text({x:n.x+12,y:n.y+36,w:n.w-24,h:n.h-48},n.label,theme.taskFont)}`;
  else if(n.kind==='exclusiveGateway')out+=`<path d="M${n.cx} ${n.y} ${n.x+n.w} ${n.cy} ${n.cx} ${n.y+n.h} ${n.x} ${n.cy}Z" fill="${theme.gatewayFill}" stroke="${theme.gatewayStroke}" stroke-width="2"/><path d="m${n.cx-12} ${n.cy-12} 24 24m0-24-24 24" stroke="${theme.gatewayStroke}" stroke-width="3"/>`;
  else if(n.kind.endsWith('Event')){
    const color=n.kind==='startEvent'?theme.start:n.kind==='endEvent'?theme.end:theme.line;
    out+=`<circle cx="${n.cx}" cy="${n.cy}" r="${n.w/2-1}" fill="#FFFFFF" stroke="${color}" stroke-width="${n.kind==='endEvent'?4:1.8}"/>`;
    if(n.kind==='boundaryEvent')out+=`<circle cx="${n.cx}" cy="${n.cy}" r="${n.w/2-6}" fill="none" stroke="${color}" stroke-width="1.5"/>`;
    if(n.event)out+=icon(n.event.type,n.cx-13,n.cy-13,26,color);
  }
  if(n.labelBounds)out+=text(n.labelBounds,n.label,16,{bold:n.kind==='exclusiveGateway'});
  return out+'</g>';
}
function svgEdge(f,message=false){
  const p=f.points;
  // White underlay makes crossings readable; there is no junction dot.
  let out=`<g id="${f.id}"><polyline points="${p.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linejoin="round"/><polyline points="${p.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${message?theme.message:theme.line}" stroke-width="1.8" stroke-linejoin="round"${message?' stroke-dasharray="8 6" marker-start="url(#message-start)"':''} marker-end="url(#${message?'message-end':'sequence-end'})"/>`;
  if(f.labelBounds)out+=`<rect x="${f.labelBounds.x}" y="${f.labelBounds.y}" width="${f.labelBounds.w}" height="${f.labelBounds.h}" rx="3" fill="#FFFFFF" fill-opacity=".97"/>${text(f.labelBounds,f.label,theme.flowFont,{color:message?theme.message:theme.text})}`;
  return out+'</g>';
}
function renderSvg(){
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${view.width}" height="${view.height}" viewBox="0 0 ${view.width} ${view.height}" font-family="Arial, sans-serif" role="img" aria-labelledby="diagram-title diagram-description"><title id="diagram-title">HospitalCare · BPMN</title><desc id="diagram-description">72 činností, dva bazény, tri roly v HospitalCare a rozbalený podproces Python. Geometria a obsah pochádzajú z diagram_model.json.</desc><defs><marker id="sequence-end" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto"><path d="M1 1 11 6 1 11Z" fill="${theme.line}"/></marker><marker id="message-end" markerUnits="userSpaceOnUse" markerWidth="14" markerHeight="14" refX="12" refY="7" orient="auto"><path d="m2 1 10 6-10 6" fill="none" stroke="${theme.message}" stroke-width="1.8"/></marker><marker id="message-start" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" refX="6" refY="6"><circle cx="6" cy="6" r="4" fill="#FFFFFF" stroke="${theme.message}" stroke-width="1.8"/></marker></defs><rect width="100%" height="100%" fill="#FFFFFF"/>`;
  svg+=text({x:48,y:24,w:1000,h:52},view.title,34,{bold:true,align:'left'});
  svg+=text({x:48,y:78,w:1800,h:40},view.subtitle,22,{color:theme.muted,align:'left'});
  svg+=text({x:7920,y:48,w:2400,h:48},'72 činností · 2 bazény · T01–T72',20,{color:theme.muted});
  for(const s of view.sections)svg+=text({x:s.x-120,y:144,w:1700,h:40},s.label,18,{bold:true,align:'left'});
  for(const b of m.boxes){
    svg+=`<rect id="${b.id}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${b.kind==='pool'?'#FFFFFF':theme.laneFill[b.lane]}" stroke="#AAB8C5" stroke-width="1.5"/>`;
    if(b.kind==='pool')svg+=`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="72" fill="#EEF2F6" stroke="#AAB8C5"/>${text({x:b.x+16,y:b.y+12,w:b.w-32,h:48},b.label,22,{bold:true,align:'left'})}`;
    else svg+=`<rect x="${b.x}" y="${b.y}" width="120" height="${b.h}" fill="#EAF0F4" stroke="#AAB8C5"/><text transform="translate(${b.x+70} ${b.y+b.h/2}) rotate(-90)" text-anchor="middle" font-size="20" font-weight="600" fill="${theme.text}">${esc(b.label)}</text>`;
  }
  for(const n of nodes.filter(n=>n.kind==='subProcess'))svg+=`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="12" fill="${theme.subprocessFill}" stroke="#71638E" stroke-width="2"/>${text({x:n.x+16,y:n.y+8,w:n.w-32,h:48},n.label,20,{bold:true,align:'left'})}`;
  for(const f of m.flows)svg+=svgEdge(f);
  for(const f of m.messages)svg+=svgEdge(f,true);
  for(const n of nodes.filter(n=>n.kind!=='subProcess'))svg+=svgNode(n);
  for(const a of m.annotations||[])svg+=`<g id="${a.id}"><polyline points="${a.points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${theme.muted}" stroke-width="1.5" stroke-dasharray="2 5"/><path d="M${a.x+16} ${a.y}h-16v${a.h}h16" fill="none" stroke="${theme.muted}" stroke-width="1.5"/>${text({x:a.x+16,y:a.y,w:a.w-24,h:a.h},a.text,18,{align:'left'})}</g>`;
  svg+=legendSvg();
  return svg+'</svg>\n';
}
function legendSvg(){
  let out=text({x:96,y:3960,w:4200,h:56},'Ako čítať diagram',24,{bold:true,align:'left'});
  const entries=[['userTask','Činnosť používateľa'],['serviceTask','Automatická činnosť systému'],['sendTask','Odoslanie správy'],['receiveTask','Prijatie správy']];
  entries.forEach(([type,label],i)=>{const y=4068+i*72;out+=icon(type,120,y,28)+text({x:168,y:y-4,w:2200,h:40},label,20,{align:'left'});});
  out+=`<path d="M120 4404H360" stroke="${theme.line}" stroke-width="1.8" marker-end="url(#sequence-end)"/>`+text({x:408,y:4384,w:3100,h:40},'Sekvenčný tok v rámci jedného bazéna',20,{align:'left'});
  out+=`<path d="M120 4476H360" stroke="${theme.message}" stroke-width="1.8" stroke-dasharray="8 6" marker-start="url(#message-start)" marker-end="url(#message-end)"/>`+text({x:408,y:4456,w:3100,h:40},'Správa medzi samostatnými účastníkmi',20,{align:'left'});
  out+=text({x:96,y:4608,w:4700,h:48},'Uloženie výsledkov',24,{bold:true,align:'left'});
  out+=text({x:96,y:4680,w:4700,h:144},'Azure SQL uchováva väzbu predikcie na hospitalizáciu. PostgreSQL uchováva samotný výsledok. Redis uchováva výsledok na 24 hodín. Otvorenie hospitalizácie nespúšťa nový výpočet.',20,{align:'left',maxWidth:4400});
  out+=text({x:96,y:4920,w:4700,h:96},'Detailné výrezy 01–06 zobrazujú časti tejto istej schémy. Identifikátory T01–T72 zostávajú zhodné vo všetkých formátoch.',20,{color:theme.muted,align:'left',maxWidth:4300});
  out+=text({x:48,y:5424,w:10272,h:48},'HospitalCare · Prerušované správy nespájajú poradie činností medzi bazénmi. Kríženie čiar bez bodky nie je spojenie.',18,{color:theme.muted,align:'left'});
  return out;
}
const incoming=id=>m.flows.filter(f=>f.target===id),outgoing=id=>m.flows.filter(f=>f.source===id);
function renderBpmn(){
  const refs=id=>incoming(id).map(f=>`<bpmn:incoming>${f.id}</bpmn:incoming>`).join('')+outgoing(id).map(f=>`<bpmn:outgoing>${f.id}</bpmn:outgoing>`).join('');
  function node(n){
    const attrs=n.kind==='boundaryEvent'?` attachedToRef="${n.attachedToRef}" cancelActivity="${n.event.interrupting!==false}"`:n.kind==='exclusiveGateway'?` gatewayDirection="${incoming(n.id).length>1?(outgoing(n.id).length>1?'Mixed':'Converging'):(outgoing(n.id).length>1?'Diverging':'Unspecified')}"`:'';
    let body=n.documentation?`<bpmn:documentation>${esc(n.documentation)}</bpmn:documentation>`:'';
    body+=refs(n.id);
    if(n.kind==='subProcess')body+=scope(n.id);
    if(n.event?.type==='message')body+=`<bpmn:messageEventDefinition id="EventDefinition_${n.id}" messageRef="${n.event.messageRef}"/>`;
    if(n.event?.type==='timer')body+=`<bpmn:timerEventDefinition id="EventDefinition_${n.id}"><bpmn:timeDuration xsi:type="bpmn:tFormalExpression">${n.event.duration}</bpmn:timeDuration></bpmn:timerEventDefinition>`;
    if(n.event?.type==='error')body+=`<bpmn:errorEventDefinition id="EventDefinition_${n.id}"/>`;
    return `<bpmn:${n.kind} id="${n.id}"${n.label?` name="${esc(n.label)}"`:''}${attrs}>${body}</bpmn:${n.kind}>`;
  }
  function scope(id){
    let out='';
    const pool=m.boxes.find(b=>b.processRef===id),lanes=pool?m.boxes.filter(b=>b.parent===pool.id):[];
    if(lanes.length)out+=`<bpmn:laneSet id="LaneSet_${id}">${lanes.map(l=>`<bpmn:lane id="${l.id}" name="${esc(l.label)}">${nodes.filter(n=>n.scope===id&&n.lane===l.lane).map(n=>`<bpmn:flowNodeRef>${n.id}</bpmn:flowNodeRef>`).join('')}</bpmn:lane>`).join('')}</bpmn:laneSet>`;
    out+=nodes.filter(n=>n.scope===id).map(node).join('');
    out+=m.flows.filter(f=>m.nodes[f.source].scope===id).map(f=>`<bpmn:sequenceFlow id="${f.id}" sourceRef="${f.source}" targetRef="${f.target}"${f.label?` name="${esc(f.label)}"`:''}>${f.condition?`<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${esc(f.condition)}</bpmn:conditionExpression>`:''}</bpmn:sequenceFlow>`).join('');
    for(const a of m.annotations||[])if(a.scope===id)out+=`<bpmn:textAnnotation id="${a.id}"><bpmn:text>${esc(a.text)}</bpmn:text></bpmn:textAnnotation><bpmn:association id="Association_${a.id}" sourceRef="${a.id}" targetRef="${a.target}" associationDirection="None"/>`;
    return out;
  }
  let xml='<?xml version="1.0" encoding="UTF-8"?>\n<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0" id="Definitions_HospitalCare" targetNamespace="https://hospitalcare.local/bpmn" exporter="HospitalCare" exporterVersion="3.0">';
  xml+='<bpmn:message id="Message_Request" name="Požiadavka na výpočet"/><bpmn:message id="Message_Response" name="Výsledok alebo chyba"/>';
  for(const p of m.boxes.filter(b=>b.kind==='pool'))xml+=`<bpmn:process id="${p.processRef}" name="${esc(p.label)}" isExecutable="false">${scope(p.processRef)}</bpmn:process>`;
  xml+='<bpmn:collaboration id="Collaboration_HospitalCare">'+m.boxes.filter(b=>b.kind==='pool').map(p=>`<bpmn:participant id="${p.id}" name="${esc(p.label)}" processRef="${p.processRef}"/>`).join('')+m.messages.map(f=>`<bpmn:messageFlow id="${f.id}" name="${esc(f.label)}" sourceRef="${f.source}" targetRef="${f.target}" messageRef="${m.nodes[f.target].event?.messageRef||'Message_Response'}"/>`).join('')+'</bpmn:collaboration>';
  xml+='<bpmndi:BPMNDiagram id="Diagram_HospitalCare"><bpmndi:BPMNPlane id="Plane_HospitalCare" bpmnElement="Collaboration_HospitalCare">';
  function shape(n){
    const fill=n.kind==='exclusiveGateway'?theme.gatewayFill:n.kind==='lane'?theme.laneFill[n.lane]:n.kind==='subProcess'?theme.subprocessFill:'#FFFFFF';
    const stroke=n.kind==='exclusiveGateway'?theme.gatewayStroke:n.kind==='startEvent'?theme.start:n.kind==='endEvent'?theme.end:isTask(n)?nodeColor(n):theme.border;
    const caption=n.labelBounds?label(n.labelBounds):isTask(n)?label({x:n.x+16,y:n.y+36,w:n.w-32,h:n.h-48},'TaskLabelStyle_HospitalCare'):n.kind==='subProcess'?label({x:n.x+24,y:n.y+8,w:n.w-48,h:48},'TitleLabelStyle_HospitalCare'):'';
    return `<bpmndi:BPMNShape id="${n.id}_DI" bpmnElement="${n.id}" bioc:fill="${fill}" bioc:stroke="${stroke}"${n.kind==='subProcess'?' isExpanded="true"':n.kind==='pool'||n.kind==='lane'?' isHorizontal="true"':n.kind==='exclusiveGateway'?' isMarkerVisible="true"':''}><dc:Bounds x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}"/>${caption}</bpmndi:BPMNShape>`;
  }
  function label(r,style='LabelStyle_HospitalCare'){return `<bpmndi:BPMNLabel labelStyle="${style}"><dc:Bounds x="${round(r.x)}" y="${round(r.y)}" width="${round(r.w)}" height="${round(r.h)}"/></bpmndi:BPMNLabel>`;}
  xml+=m.boxes.map(shape).join('')+nodes.map(shape).join('')+(m.annotations||[]).map(shape).join('');
  for(const f of [...m.flows,...m.messages,...(m.annotations||[]).map(a=>({id:`Association_${a.id}`,points:a.points}))])xml+=`<bpmndi:BPMNEdge id="${f.id}_DI" bpmnElement="${f.id}">${f.points.map(p=>`<di:waypoint x="${p[0]}" y="${p[1]}"/>`).join('')}${f.labelBounds?label(f.labelBounds):''}</bpmndi:BPMNEdge>`;
  return xml+'</bpmndi:BPMNPlane><bpmndi:BPMNLabelStyle id="LabelStyle_HospitalCare"><dc:Font name="Arial" size="16"/></bpmndi:BPMNLabelStyle><bpmndi:BPMNLabelStyle id="TaskLabelStyle_HospitalCare"><dc:Font name="Arial" size="18"/></bpmndi:BPMNLabelStyle><bpmndi:BPMNLabelStyle id="TitleLabelStyle_HospitalCare"><dc:Font name="Arial" size="20" isBold="true"/></bpmndi:BPMNLabelStyle></bpmndi:BPMNDiagram></bpmn:definitions>\n';
}
function renderDrawio(){
  let out=`<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net" version="24.7.17"><diagram id="hospitalcare" name="HospitalCare · 72 činností"><mxGraphModel grid="1" gridSize="24" page="1" pageWidth="${view.width}" pageHeight="${view.height}"><root><mxCell id="0"/><mxCell id="1" parent="0"/>`;
  const geometry=(r,p)=>`<mxGeometry x="${round(r.x-(p?.x||0))}" y="${round(r.y-(p?.y||0))}" width="${r.w}" height="${r.h}" as="geometry"/>`;
  const cell=(id,value,style,r,parent='1',origin)=>`<mxCell id="${id}" value="${esc(value)}" style="${esc(style)}" vertex="1" parent="${parent}">${geometry(r,origin)}</mxCell>`;
  const textCell=(id,value,r,parent='1',origin,size=18,extra='')=>cell(id,value,`text;html=0;whiteSpace=wrap;fontFamily=Arial;fontSize=${size};fontColor=${theme.text};align=center;verticalAlign=middle;connectable=0;${extra}`,r,parent,origin);
  out+=textCell('Diagram_Title',view.title,{x:56,y:24,w:1000,h:52},'1',null,34,'align=left;fontStyle=1;');
  out+=textCell('Diagram_Subtitle',view.subtitle,{x:56,y:78,w:1800,h:40},'1',null,22,'align=left;');
  out+=textCell('Diagram_Count','72 činností · 2 bazény · T01–T72',{x:7920,y:48,w:2400,h:48},'1',null,20);
  for(const [i,s]of view.sections.entries())out+=textCell(`Section_${i}`,s.label,{x:s.x-112,y:144,w:1700,h:40},'1',null,18,'align=left;fontStyle=1;');
  for(const b of m.boxes){
    const p=m.boxes.find(x=>x.id===b.parent);
    out+=cell(b.id,b.label,`swimlane;html=0;container=1;collapsible=0;recursiveResize=0;resizeParent=0;horizontal=${b.kind==='pool'?1:0};startSize=${b.kind==='pool'?72:120};whiteSpace=wrap;fontFamily=Arial;fontSize=20;fontStyle=1;fillColor=${b.kind==='pool'?'#EEF2F6':'#EAF0F4'};swimlaneFillColor=${b.kind==='pool'?'#FFFFFF':theme.laneFill[b.lane]};strokeColor=#AAB8C5;`,b,p?.id||'1',p);
  }
  for(const n of nodes){
    const parent=n.kind==='boundaryEvent'?m.nodes[n.attachedToRef]:n.scope==='SP_Predict'?m.nodes.SP_Predict:m.boxes.find(b=>b.lane===n.lane);
    let style=`html=0;whiteSpace=wrap;fontFamily=Arial;fontSize=18;fontColor=${theme.text};container=1;collapsible=0;recursiveResize=0;resizeParent=0;strokeWidth=2;`;
    let value=n.label;
    if(isTask(n))style+=`rounded=1;arcSize=12;spacingTop=24;spacingLeft=16;spacingRight=16;fillColor=#FFFFFF;strokeColor=${nodeColor(n)};`;
    else if(n.kind==='exclusiveGateway'){style+=`rhombus;fillColor=${theme.gatewayFill};strokeColor=${theme.gatewayStroke};fontSize=36;fontColor=${theme.gatewayStroke};`;value='×';}
    else if(n.kind==='subProcess')style+=`rounded=1;arcSize=3;fillColor=${theme.subprocessFill};strokeColor=#71638E;verticalAlign=top;align=left;spacingTop=14;spacingLeft=24;fontSize=20;fontStyle=1;`;
    else{style+=`ellipse;fillColor=#FFFFFF;strokeColor=${n.kind==='startEvent'?theme.start:n.kind==='endEvent'?theme.end:theme.line};strokeWidth=${n.kind==='endEvent'?4:1.8};`;value='';}
    out+=cell(n.id,value,style,n,parent.id,parent);
    if(n.kind==='boundaryEvent')out+=cell(`${n.id}_inner`,'','ellipse;fillColor=none;strokeWidth=1.5;strokeColor=#536579;connectable=0;movable=0;resizable=0;',{x:n.x+6,y:n.y+6,w:n.w-12,h:n.h-12},n.id,n);
    if(n.labelBounds)out+=textCell(`${n.id}_caption`,n.label,n.labelBounds,n.id,n,16,n.kind==='exclusiveGateway'?'fontStyle=1;':'');
    const type=isTask(n)?n.kind:n.event?.type;
    if(type){
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${glyph(type)}</svg>`;
      // Embedded vector markers need no diagrams.net stencil/plugin installation.
      const image='data:image/svg+xml,'+encodeURIComponent(svg).replaceAll(';','%3B');
      out+=cell(`${n.id}_marker`,'',`shape=image;image=${image};imageAspect=1;connectable=0;movable=0;resizable=0;`,isTask(n)?{x:n.x+12,y:n.y+10,w:24,h:24}:{x:n.cx-13,y:n.cy-13,w:26,h:26},n.id,n);
    }
    if(isTask(n))out+=textCell(`${n.id}_identifier`,n.id,{x:n.x+n.w-60,y:n.y+7,w:50,h:24},n.id,n,12,`fontColor=${theme.muted};movable=0;resizable=0;`);
  }
  for(const f of [...m.flows,...m.messages]){
    const source=m.nodes[f.source],target=m.nodes[f.target],msg=m.messages.includes(f);
    const parent=msg?null:source.scope==='SP_Predict'?m.nodes.SP_Predict:m.boxes.find(b=>b.processRef===source.scope);
    const first=f.points[0],last=f.points.at(-1),ox=parent?.x||0,oy=parent?.y||0;
    const style=`edgeStyle=none;html=0;rounded=0;jumpStyle=arc;jumpSize=8;strokeWidth=1.8;strokeColor=${msg?theme.message:theme.line};endArrow=${msg?'open':'block'};endFill=${msg?0:1};${msg?'dashed=1;dashPattern=8 6;startArrow=oval;startFill=0;':''}fontFamily=Arial;fontSize=16;whiteSpace=wrap;labelBackgroundColor=#FFFFFF;${f.labelBounds?`labelWidth=${f.labelBounds.w};`:''}exitX=${(first[0]-source.x)/source.w};exitY=${(first[1]-source.y)/source.h};exitPerimeter=0;entryX=${(last[0]-target.x)/target.w};entryY=${(last[1]-target.y)/target.h};entryPerimeter=0;`;
    let offset='';
    if(f.labelBounds){
      const length=f.points.slice(1).reduce((sum,p,i)=>sum+Math.abs(p[0]-f.points[i][0])+Math.abs(p[1]-f.points[i][1]),0);
      let remaining=length/2,mid=first;
      for(let i=1;i<f.points.length;i++){
        const a=f.points[i-1],b=f.points[i],segment=Math.abs(b[0]-a[0])+Math.abs(b[1]-a[1]);
        if(remaining<=segment){mid=[a[0]+(b[0]-a[0])*remaining/segment,a[1]+(b[1]-a[1])*remaining/segment];break;}
        remaining-=segment;
      }
      offset=`<mxPoint x="${round(f.label_pos[0]-mid[0])}" y="${round(f.label_pos[1]-mid[1])}" as="offset"/>`;
    }
    out+=`<mxCell id="${f.id}" value="${esc(f.label)}" edge="1" parent="${parent?.id||'1'}" source="${source.id}" target="${target.id}" style="${style}"><mxGeometry x="0" y="0" relative="1" as="geometry">${offset}<Array as="points">${f.points.slice(1,-1).map(p=>`<mxPoint x="${p[0]-ox}" y="${p[1]-oy}"/>`).join('')}</Array></mxGeometry></mxCell>`;
  }
  for(const a of m.annotations||[]){
    const p=m.boxes.find(b=>b.processRef===a.scope);
    const target=m.nodes[a.target],first=a.points[0],last=a.points.at(-1);
    out+=cell(a.id,a.text,'shape=partialRectangle;top=0;right=0;bottom=0;left=1;whiteSpace=wrap;html=0;fontFamily=Arial;fontSize=18;align=left;spacing=16;fillColor=none;strokeColor=#526477;',a,p.id,p);
    out+=`<mxCell id="Association_${a.id}" edge="1" parent="${p.id}" source="${a.id}" target="${a.target}" style="edgeStyle=none;endArrow=none;dashed=1;dashPattern=2 5;strokeColor=#526477;exitX=${(first[0]-a.x)/a.w};exitY=${(first[1]-a.y)/a.h};exitPerimeter=0;entryX=${(last[0]-target.x)/target.w};entryY=${(last[1]-target.y)/target.h};entryPerimeter=0;"><mxGeometry relative="1" as="geometry"><Array as="points">${a.points.slice(1,-1).map(q=>`<mxPoint x="${q[0]-p.x}" y="${q[1]-p.y}"/>`).join('')}</Array></mxGeometry></mxCell>`;
  }
  out+=textCell('Legend_Title','Ako čítať diagram',{x:104,y:3960,w:4200,h:56},'1',null,24,'align=left;fontStyle=1;');
  out+=textCell('Legend_Text','Činnosť používateľa · automatická činnosť systému · odoslanie / prijatie správy\n\nPlná šípka: sekvenčný tok v jednom bazéne.\nPrerušovaná šípka s kruhom: správa medzi bazénmi.\n\nAzure SQL: väzba na hospitalizáciu. PostgreSQL: výsledok predikcie.\nRedis: výsledok na 24 hodín. Otvorenie hospitalizácie nespúšťa nový výpočet.\n\n72 činností · Identifikátory T01–T72 sú zhodné vo všetkých formátoch.',{x:104,y:4040,w:4800,h:1000},'1',null,20,'align=left;verticalAlign=top;');
  return out+'</root></mxGraphModel></diagram></mxfile>\n';
}
function findBrowser(){
  const arg=process.argv.indexOf('--browser');
  if(arg>=0)return process.argv[arg+1];
  if(process.env.CHROME_PATH)return process.env.CHROME_PATH;
  const candidates=[
    path.join(process.env.PROGRAMFILES||'', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)']||'', 'Microsoft/Edge/Application/msedge.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome',
  ];
  for(const root of [path.join(process.env.LOCALAPPDATA||'', 'ms-playwright'),path.join(os.homedir(),'.cache/ms-playwright')])if(fs.existsSync(root))for(const d of fs.readdirSync(root).sort().reverse()){
    if(d.startsWith('chromium_headless_shell-'))candidates.push(path.join(root,d,'chrome-headless-shell-win64/chrome-headless-shell.exe'),path.join(root,d,'chrome-headless-shell-linux64/chrome-headless-shell'));
    if(d.startsWith('chromium-'))candidates.push(path.join(root,d,'chrome-win64/chrome.exe'),path.join(root,d,'chrome-linux/chrome'));
  }
  const found=candidates.find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
  if(!found)throw Error('Chrome/Chromium not found. Set CHROME_PATH, use --browser <path>, or generate vectors with --vector-only.');
  return found;
}
async function pngExports(){
  const browser=findBrowser(),profile=fs.mkdtempSync(path.join(os.tmpdir(),'hospitalcare-bpmn-'));
  const trace=value=>{if(process.argv.includes('--verbose'))console.log(value);};
  trace(`PNG browser: ${browser}`);
  const child=spawn(browser,['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--allow-file-access-from-files','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  child.stderr.on('data',chunk=>trace(String(chunk).trim()));
  child.on('exit',(code,signal)=>trace(`Browser exit: ${code} ${signal||''}`));
  let socket;
  try{
    const endpoint=await new Promise((resolve,reject)=>{let err='';const timer=setTimeout(()=>reject(Error(`Browser startup timeout: ${err.slice(-800)}`)),20000);child.once('error',reject);child.stderr.on('data',b=>{err+=b;const match=err.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1]);}});child.once('exit',code=>{clearTimeout(timer);reject(Error(`Browser exited (${code}): ${err.slice(-800)}`));});});
    trace('Browser started; connecting to DevTools.');
    const browserSocket=new WebSocket(endpoint);await new Promise((r,j)=>{browserSocket.onopen=r;browserSocket.onerror=j;});
    trace('DevTools connected.');
    let seq=0;const pending=new Map();
    browserSocket.onmessage=e=>{const data=JSON.parse(e.data);if(data.id&&pending.has(data.id)){const [resolve,reject]=pending.get(data.id);pending.delete(data.id);data.error?reject(Error(data.error.message)):resolve(data.result);}};
    browserSocket.onclose=()=>{for(const [,reject]of pending.values())reject(Error('Browser DevTools connection closed.'));pending.clear();};
    const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error(`DevTools timeout: ${method}`));},60000);pending.set(id,[value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);}]);browserSocket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
    socket=browserSocket;
    const {targetId}=await send('Target.createTarget',{url:'about:blank'});
    trace('SVG target created.');
    const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
    const cdp=(method,params)=>send(method,params,sessionId);
    await cdp('Page.enable');
    await cdp('Emulation.setDeviceMetricsOverride',{width:view.width,height:view.height,deviceScaleFactor:1,mobile:false});
    await cdp('Page.navigate',{url:pathToFileURL(path.join(DIR,'HospitalCare.svg')).href});
    trace('SVG navigation requested.');
    let loaded=false;
    for(let i=0;i<100;i++){
      const r=await cdp('Runtime.evaluate',{expression:"document.documentElement.tagName==='svg' && document.readyState==='complete'",returnByValue:true});
      if(r.result.value){loaded=true;break;}await new Promise(r=>setTimeout(r,50));
    }
    assert.ok(loaded,'SVG did not load in browser');
    trace('SVG loaded.');
    await cdp('Runtime.evaluate',{expression:'document.fonts.ready',awaitPromise:true});
    const check=await cdp('Runtime.evaluate',{expression:"JSON.stringify({errors:document.querySelectorAll('parsererror').length,taskNodes:[...document.querySelectorAll('g[id]')].filter(n=>/^T[0-9]{2}$/.test(n.id)).length})",returnByValue:true});
    const info=JSON.parse(check.result.value);assert.equal(info.errors,0);assert.equal(info.taskNodes,72);
    const overflow=await cdp('Runtime.evaluate',{expression:`JSON.stringify([...document.querySelectorAll('g[id]')].filter(n=>/^T[0-9]{2}$/.test(n.id)).flatMap(n=>{const r=n.querySelector('rect').getBBox();return [...n.children].filter(c=>c.tagName==='text').filter(c=>{const b=c.getBBox();return b.x<r.x+4||b.x+b.width>r.x+r.width-4||b.y<r.y+4||b.y+b.height>r.y+r.height-4;}).map(c=>n.id+': '+c.textContent);} ))`,returnByValue:true});
    assert.deepEqual(JSON.parse(overflow.result.value),[],'Rendered task captions must fit inside their blocks');
    async function capture(file,clip){const r=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{...clip,scale:1}});fs.writeFileSync(file,Buffer.from(r.data,'base64'));}
    await capture(path.join(DIR,'BPMN.png'),{x:0,y:0,width:view.width,height:view.height});
    trace('Main PNG captured.');
    const detailDir=path.join(DIR,'details');fs.mkdirSync(detailDir,{recursive:true});
    for(const detail of view.details){
      const ns=detail.nodes.map(id=>m.nodes[id]);
      const rs=ns.flatMap(n=>[bounds(n),...(n.labelBounds?[n.labelBounds]:[])]);
      if(detail.id==='06-python')rs.push(...m.boxes.filter(b=>b.processRef==='P2').map(bounds),...(m.annotations||[]).filter(a=>a.scope==='P2').map(bounds));
      const x=Math.max(0,Math.floor((Math.min(...rs.map(n=>n.x))-96)/24)*24),y=Math.max(0,Math.floor((Math.min(...rs.map(n=>n.y))-120)/24)*24);
      const right=Math.min(view.width,Math.ceil((Math.max(...rs.map(n=>n.x+n.w))+96)/24)*24),bottom=Math.min(view.height,Math.ceil((Math.max(...rs.map(n=>n.y+n.h))+96)/24)*24);
      await capture(path.join(detailDir,`${detail.id}.png`),{x,y,width:right-x,height:bottom-y});
    }
    console.log('Rendered BPMN.png and six detail PNGs at native resolution.');
    await send('Browser.close').catch(()=>{});
  }finally{
    socket?.close();
    if(child.exitCode===null)child.kill();
    // Only this invocation's own temporary browser profile is removed.
    await new Promise(r=>setTimeout(r,200));
    assert.equal(path.dirname(path.resolve(profile)),path.resolve(os.tmpdir()));
    assert.ok(path.basename(profile).startsWith('hospitalcare-bpmn-'));
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:4,retryDelay:200});
  }
}
async function main(){
  if(process.argv.includes('--check')){console.log(JSON.stringify(validate(),null,2));return;}
  routeAll();const report=validate();
  fs.writeFileSync(path.join(DIR,'diagram_model.json'),JSON.stringify(m,null,2)+'\n');
  fs.writeFileSync(path.join(DIR,'HospitalCare.svg'),renderSvg());
  fs.writeFileSync(path.join(DIR,'HospitalCare.bpmn'),renderBpmn());
  fs.writeFileSync(path.join(DIR,'HospitalCare.drawio'),renderDrawio());
  console.log(JSON.stringify(report));
  if(!process.argv.includes('--vector-only'))await pngExports();
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
