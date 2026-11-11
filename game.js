/* 드리프트 러시 - 게임 로직 (three.js r128) */
(function(){
'use strict';
const $=id=>document.getElementById(id);

/* ---------- options ---------- */
const KARTS=[
  {id:'red',name:'레드 썬더',price:0,body:0xff4d2e,trim:0xffc531,suit:0x2b2f45,helmet:0xffffff,st:{spd:1,acc:1,hnd:1,chg:1}},
  {id:'blue',name:'블루 웨이브',price:0,body:0x2f7cff,trim:0xe8f1ff,suit:0x1c2340,helmet:0xffd23f,st:{spd:1,acc:1,hnd:1,chg:1}},
  {id:'yellow',name:'옐로 비',price:0,body:0xffc531,trim:0x222222,suit:0x3a2a12,helmet:0xff6aa2,st:{spd:1,acc:1,hnd:1,chg:1}},
  {id:'mint',name:'민트 젯',price:0,body:0x22c7a0,trim:0xffffff,suit:0x15322c,helmet:0x7c5cff,st:{spd:1,acc:1,hnd:1,chg:1}},
  {id:'fin',name:'스트리트 핀',price:600,body:0x9b5cff,trim:0xffffff,suit:0x241a3d,helmet:0x9b5cff,fin:true,st:{spd:1.03,acc:1.05,hnd:1.04,chg:1.06}},
  {id:'blaze',name:'블레이즈 X',price:1500,body:0xff2e6a,trim:0x1b1e28,suit:0x1b1e28,helmet:0xffc531,fin:true,wide:true,st:{spd:1.06,acc:1.08,hnd:1.06,chg:1.12}},
  {id:'aurora',name:'오로라 GT',price:3000,body:0x18d0ff,trim:0xeafffb,suit:0x0e2a3a,helmet:0xffffff,wide:true,glow:0x18d0ff,st:{spd:1.09,acc:1.11,hnd:1.08,chg:1.18}},
  {id:'phantom',name:'팬텀 R',price:5000,body:0x2a2d3a,trim:0xff3b3b,suit:0x111318,helmet:0x2a2d3a,fin:true,wide:true,glow:0xff3b3b,st:{spd:1.12,acc:1.14,hnd:1.1,chg:1.24}},
  {id:'solar',name:'솔라 플레어',price:8000,body:0xffb21a,trim:0xff4d2e,suit:0x3a1a08,helmet:0xffffff,fin:true,wide:true,glow:0xffd84a,st:{spd:1.16,acc:1.18,hnd:1.13,chg:1.3}}
];
/* drift exit: ext 1.0 (starter) .. 1.3 (top) */
const EXT={red:1,blue:1,yellow:1,mint:1,fin:1.06,blaze:1.12,aurora:1.18,phantom:1.24,solar:1.3};
KARTS.forEach(k=>{k.st.ext=EXT[k.id]||1;});
function exitParams(ext){const u=Math.max(0,Math.min(1,(ext-1)/.3));return {time:.3+.55*u,conv:.2+.5*u};}
const STARTERS=KARTS.filter(k=>k.price===0);
const kartById=id=>KARTS.find(k=>k.id===id)||KARTS[0];
const opt={laps:2,diff:1};
const DIFF=[{n:'느긋하게',m:.86,bonus:.8},{n:'보통',m:.94,bonus:1},{n:'빡세게',m:1.0,bonus:1.3}];
const RANK_P=[100,70,45,25];
function store(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function load(k){try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch(e){return null;}}
{const o=load('drift-rush-opt');if(o){if(o.laps)opt.laps=o.laps;if(o.diff!=null)opt.diff=o.diff;}}
const save=Object.assign({points:0,owned:STARTERS.map(k=>k.id),sel:'red'},load('drift-rush-save')||{});
STARTERS.forEach(k=>{if(!save.owned.includes(k.id))save.owned.push(k.id);});
if(!save.owned.includes(save.sel))save.sel='red';
function saveGame(){store('drift-rush-save',save);}
const hex=c=>'#'+c.toString(16).padStart(6,'0');

/* ---------- three setup ---------- */
const canvas=$('gl');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
const scene=new THREE.Scene();
const SKY=0xbfe1ff;
scene.background=new THREE.Color(SKY);
scene.fog=new THREE.Fog(SKY,320,1500);
const camera=new THREE.PerspectiveCamera(70,1,.1,3200);
scene.add(new THREE.HemisphereLight(0xffffff,0x6a8a4a,.75));
const sun=new THREE.DirectionalLight(0xffffff,.75);sun.position.set(200,400,120);scene.add(sun);

function canvasTex(w,h,draw,rep){
  const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);if(rep){t.wrapS=t.wrapT=THREE.RepeatWrapping;}
  t.anisotropy=renderer.capabilities.getMaxAnisotropy?Math.min(8,renderer.capabilities.getMaxAnisotropy()):1;return t;
}
function rnd(seed){return()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};}

/* sky dome */
{
  const g=new THREE.SphereGeometry(2600,24,12);const cols=[];const p=g.attributes.position;
  for(let i=0;i<p.count;i++){const y=p.getY(i)/2600;const t=Math.max(0,y);const a=new THREE.Color(0xbfe1ff),b=new THREE.Color(0x3d8bff);a.lerp(b,Math.pow(t,.6));cols.push(a.r,a.g,a.b);}
  g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));
  scene.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false})));
}

/* ---------- track ---------- */
const CTRL_BASE=[[0,-200],[140,-210],[232,-150],[244,-40],[176,22],[112,92],[150,172],[240,206],[256,300],[150,344],[20,302],[-60,232],[-150,262],[-242,200],[-254,80],[-182,0],[-212,-102],[-150,-192]];
const MAP_SCALE=1.55;
const CTRL=CTRL_BASE.map(([x,z])=>[x*MAP_SCALE,z*MAP_SCALE]);
const N=1300, HALF=15, WALL=HALF+7, KR=1.0, LANE=HALF/2;
function buildSamples(ctrl,n){
  const dense=[],L=ctrl.length;
  for(let i=0;i<L;i++){
    const p0=ctrl[(i-1+L)%L],p1=ctrl[i],p2=ctrl[(i+1)%L],p3=ctrl[(i+2)%L];
    for(let k=0;k<40;k++){const t=k/40,t2=t*t,t3=t2*t;
      const f=(a,b,c,d)=>.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t2+(-a+3*b-3*c+d)*t3);
      dense.push([f(p0[0],p1[0],p2[0],p3[0]),f(p0[1],p1[1],p2[1],p3[1])]);}
  }
  const cum=[0];for(let i=1;i<=dense.length;i++){const a=dense[i-1],b=dense[i%dense.length];cum.push(cum[i-1]+Math.hypot(b[0]-a[0],b[1]-a[1]));}
  const total=cum[cum.length-1],out=[];let j=0;
  for(let i=0;i<n;i++){const d=i/n*total;while(cum[j+1]<d)j++;const a=dense[j],b=dense[(j+1)%dense.length],u=(d-cum[j])/(cum[j+1]-cum[j]||1);out.push([a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u]);}
  const S=[];
  for(let i=0;i<n;i++){const a=out[(i-1+n)%n],b=out[(i+1)%n];let tx=b[0]-a[0],tz=b[1]-a[1];const l=Math.hypot(tx,tz)||1;tx/=l;tz/=l;S.push({x:out[i][0],z:out[i][1],tx,tz,nx:-tz,nz:tx});}
  return {S,total};
}
const TR=buildSamples(CTRL,N),S=TR.S,TRACK_LEN=TR.total,SP=TRACK_LEN/N;
const ang=(i)=>Math.atan2(S[(i%N+N)%N].tx,S[(i%N+N)%N].tz);

function ribbon(offA,offB,y0,y1,vScale,vertical){
  const pos=[],uv=[],idx=[];let dist=0;
  for(let i=0;i<=N;i++){
    const s=S[i%N];if(i>0){const q=S[i-1];dist+=Math.hypot(s.x-q.x,s.z-q.z);}
    if(vertical){pos.push(s.x+s.nx*offA,y0,s.z+s.nz*offA, s.x+s.nx*offA,y1,s.z+s.nz*offA);}
    else{pos.push(s.x+s.nx*offA,y0,s.z+s.nz*offA, s.x+s.nx*offB,y0,s.z+s.nz*offB);}
    uv.push(0,dist/vScale,1,dist/vScale);
    if(i<N){const a=i*2;idx.push(a,a+1,a+2, a+1,a+3,a+2);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
const asphalt=canvasTex(128,256,(c,w,h)=>{
  c.fillStyle='#4c5059';c.fillRect(0,0,w,h);const r=rnd(5);
  for(let i=0;i<2600;i++){const v=60+r()*40|0;c.fillStyle=`rgba(${v},${v+2},${v+8},.5)`;c.fillRect(r()*w,r()*h,1.5,1.5);}
  c.fillStyle='#f4f4f0';c.fillRect(5,0,4,h);c.fillRect(w-9,0,4,h);
  c.fillStyle='#f4f4f0';c.fillRect(w/2-2,0,4,h);
  c.fillStyle='rgba(255,255,255,.85)';c.fillRect(w/4-1.5,0,3,h*0.45);c.fillRect(w*3/4-1.5,0,3,h*0.45);
},true);
const road=new THREE.Mesh(ribbon(HALF,-HALF,.03,0,26,false),new THREE.MeshLambertMaterial({map:asphalt,side:THREE.DoubleSide}));
scene.add(road);
const curbTex=canvasTex(64,64,(c,w,h)=>{c.fillStyle='#ffffff';c.fillRect(0,0,w,h);c.fillStyle='#e3342f';c.fillRect(0,0,w,h/2);},true);
scene.add(new THREE.Mesh(ribbon(HALF+1.8,HALF,.05,0,6,false),new THREE.MeshLambertMaterial({map:curbTex,side:THREE.DoubleSide})));
scene.add(new THREE.Mesh(ribbon(-HALF,-HALF-1.8,.05,0,6,false),new THREE.MeshLambertMaterial({map:curbTex,side:THREE.DoubleSide})));
const wallTex=canvasTex(64,64,(c,w,h)=>{c.fillStyle='#1f5fd6';c.fillRect(0,0,w,h);c.fillStyle='#ffffff';c.fillRect(0,0,w,h*.18);c.fillRect(0,h*.82,w,h*.18);c.fillStyle='#ffd23f';c.fillRect(0,h*.42,w/2,h*.16);},true);
const wallMat=new THREE.MeshLambertMaterial({map:wallTex,side:THREE.DoubleSide});
scene.add(new THREE.Mesh(ribbon(WALL,0,0,1.5,5,true),wallMat));
scene.add(new THREE.Mesh(ribbon(-WALL,0,0,1.5,5,true),wallMat));
// shoulder (sand)
const sandMat=new THREE.MeshLambertMaterial({color:0xd9c79a,side:THREE.DoubleSide});
scene.add(new THREE.Mesh(ribbon(WALL+.2,HALF+1.8,.02,0,10,false),sandMat));
scene.add(new THREE.Mesh(ribbon(-HALF-1.8,-WALL-.2,.02,0,10,false),sandMat));

/* ground */
{
  const gt=canvasTex(256,256,(c,w,h)=>{c.fillStyle='#6cbc58';c.fillRect(0,0,w,h);const r=rnd(9);for(let i=0;i<1800;i++){c.fillStyle=r()>.5?'rgba(80,160,70,.6)':'rgba(140,210,110,.5)';c.fillRect(r()*w,r()*h,3,3);}},true);
  gt.repeat.set(80,80);
  const g=new THREE.Mesh(new THREE.PlaneGeometry(4000,4000),new THREE.MeshLambertMaterial({map:gt}));
  g.rotation.x=-Math.PI/2;g.position.y=-.06;scene.add(g);
}
/* scenery */
function nearTrack(x,z,d){for(let i=0;i<N;i+=3){const s=S[i];if((s.x-x)**2+(s.z-z)**2<d*d)return true;}return false;}
{
  const r=rnd(42),M=new THREE.Matrix4(),Q=new THREE.Quaternion(),V=new THREE.Vector3(),Sc=new THREE.Vector3();
  const TREES=480;
  const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.5,.7,3,6),new THREE.MeshLambertMaterial({color:0x7a5236}),TREES);
  const leaves=new THREE.InstancedMesh(new THREE.ConeGeometry(3.4,8,7),new THREE.MeshLambertMaterial({color:0x2f8f4a}),TREES);
  const leaves2=new THREE.InstancedMesh(new THREE.ConeGeometry(2.6,6,7),new THREE.MeshLambertMaterial({color:0x3fae5c}),TREES);
  let n=0;
  while(n<TREES){
    const x=(r()-.5)*1450,z=(r()-.5)*1450;if(nearTrack(x,z,WALL+8))continue;
    const s=.7+r()*.9;
    M.compose(V.set(x,1.5*s,z),Q,Sc.set(s,s,s));trunks.setMatrixAt(n,M);
    M.compose(V.set(x,6.5*s,z),Q,Sc.set(s,s,s));leaves.setMatrixAt(n,M);
    M.compose(V.set(x,9.5*s,z),Q,Sc.set(s,s,s));leaves2.setMatrixAt(n,M);n++;
  }
  [trunks,leaves,leaves2].forEach(m=>{m.frustumCulled=false;m.instanceMatrix.needsUpdate=true;});
  scene.add(trunks,leaves,leaves2);
  const mt=new THREE.MeshLambertMaterial({color:0x8fa8c4});
  for(let i=0;i<18;i++){const a=i/18*Math.PI*2+r()*.2,d=1150+r()*300,h=160+r()*200;const m=new THREE.Mesh(new THREE.ConeGeometry(140+r()*100,h,6),mt);m.position.set(Math.cos(a)*d,h/2-10,Math.sin(a)*d);scene.add(m);}
  // grandstands near start
  const st=new THREE.MeshLambertMaterial({color:0xe9edf5});
  for(let k=0;k<4;k++){const s=S[(N-40+k*12)%N];const g=new THREE.Mesh(new THREE.BoxGeometry(26,7,9),st);g.position.set(s.x-s.nx*(WALL+9),3,s.z-s.nz*(WALL+9));g.rotation.y=Math.atan2(s.tx,s.tz);scene.add(g);
    const roof=new THREE.Mesh(new THREE.BoxGeometry(28,.6,11),new THREE.MeshLambertMaterial({color:k%2?0xff4d2e:0x2f7cff}));roof.position.copy(g.position).setY(9.5);roof.rotation.y=g.rotation.y;scene.add(roof);}
}
/* start line + gate */
{
  const s=S[0],a=Math.atan2(s.tx,s.tz);
  const chk=canvasTex(256,32,(c,w,h)=>{for(let x=0;x<32;x++)for(let y=0;y<4;y++){c.fillStyle=(x+y)%2?'#111':'#fff';c.fillRect(x*8,y*8,8,8);}});
  const lg=new THREE.Group();lg.position.set(s.x,0,s.z);lg.rotation.y=a;
  const lineMesh=new THREE.Mesh(new THREE.PlaneGeometry(HALF*2,3).rotateX(-Math.PI/2),new THREE.MeshLambertMaterial({map:chk}));lineMesh.position.y=.07;lg.add(lineMesh);
  const pm=new THREE.MeshLambertMaterial({color:0x222a44});
  [-1,1].forEach(sd=>{const p=new THREE.Mesh(new THREE.BoxGeometry(1.4,11,1.4),pm);p.position.set(sd*(HALF+3),5.5,0);lg.add(p);});
  const ban=canvasTex(512,96,(c,w,h)=>{c.fillStyle='#ff4d2e';c.fillRect(0,0,w,h);c.fillStyle='#ffc531';for(let i=0;i<w;i+=40){c.beginPath();c.moveTo(i,h);c.lineTo(i+20,h);c.lineTo(i+40,h-14);c.lineTo(i+20,h-14);c.fill();}
    c.fillStyle='#fff';c.font='bold 54px "Black Han Sans", sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('DRIFT RUSH',w/2,h/2-6);});
  const banner=new THREE.Mesh(new THREE.BoxGeometry(HALF*2+8,3.4,.8),[pm,pm,pm,pm,new THREE.MeshLambertMaterial({map:ban}),new THREE.MeshLambertMaterial({map:ban})]);
  banner.position.y=10.5;lg.add(banner);scene.add(lg);
}
/* boost pads */
const PADS=[];
{
  const pt=canvasTex(128,160,(c,w,h)=>{c.fillStyle='rgba(255,120,20,.9)';c.fillRect(0,0,w,h);c.fillStyle='#ffe27a';
    for(let k=0;k<3;k++){const y=24+k*46;c.beginPath();c.moveTo(w/2,y);c.lineTo(w-16,y+34);c.lineTo(w-36,y+34);c.lineTo(w/2,y+14);c.lineTo(36,y+34);c.lineTo(16,y+34);c.closePath();c.fill();}});
  const geo=new THREE.PlaneGeometry(6,8).rotateX(-Math.PI/2).rotateY(Math.PI);
  const mat=new THREE.MeshBasicMaterial({map:pt,transparent:true});
  [[.06,-1.5],[.2,1.5],[.34,-.5],[.47,.5],[.6,1.5],[.73,-1.5],[.86,.5]].forEach(([f,ln])=>{const i=Math.floor(N*f),s=S[i],off=ln*LANE;const m=new THREE.Mesh(geo,mat);m.position.set(s.x+s.nx*off,.08,s.z+s.nz*off);m.rotation.y=Math.atan2(s.tx,s.tz);scene.add(m);PADS.push({i,off});});
}

/* ---------- karts ---------- */
const KSCALE=.75;
function makeKart(k){
  const g=new THREE.Group(),body=new THREE.Group();g.add(body);
  const L=(c)=>new THREE.MeshLambertMaterial({color:c});
  const main=L(k.body),trim=L(k.trim),dark=L(0x1b1e28);
  const b=new THREE.Mesh(new THREE.BoxGeometry(2.1,.5,3.1),main);b.position.y=.6;body.add(b);
  const nose=new THREE.Mesh(new THREE.BoxGeometry(1.7,.35,1.2),main);nose.position.set(0,.55,1.9);nose.rotation.x=.22;body.add(nose);
  const bumper=new THREE.Mesh(new THREE.BoxGeometry(2.3,.25,.35),trim);bumper.position.set(0,.4,2.45);body.add(bumper);
  [-1,1].forEach(s=>{const pod=new THREE.Mesh(new THREE.BoxGeometry(.45,.4,2.2),trim);pod.position.set(s*1.2,.55,.1);body.add(pod);});
  const seat=new THREE.Mesh(new THREE.BoxGeometry(1.2,.9,.3),dark);seat.position.set(0,1.15,-.75);body.add(seat);
  const torso=new THREE.Mesh(new THREE.CylinderGeometry(.42,.5,.85,10),L(k.suit));torso.position.set(0,1.3,-.35);body.add(torso);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.56,16,12),L(k.helmet));head.position.set(0,2.05,-.3);body.add(head);
  const visor=new THREE.Mesh(new THREE.BoxGeometry(.78,.26,.22),new THREE.MeshLambertMaterial({color:0x1d2a44,emissive:0x0a1430}));visor.position.set(0,2.07,.18);body.add(visor);
  const wheel=new THREE.MeshLambertMaterial({color:0x15161b}),hub=L(k.trim);
  const wheels=[];
  [[-1.15,1.15],[1.15,1.15],[-1.2,-1.15],[1.2,-1.15]].forEach(([x,z],i)=>{
    const wg=new THREE.Group();wg.position.set(x,.48,z);
    const w=new THREE.Mesh(new THREE.CylinderGeometry(i<2?.42:.5,i<2?.42:.5,i<2?.38:.5,14),wheel);w.rotation.z=Math.PI/2;wg.add(w);
    const h=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.52,8),hub);h.rotation.z=Math.PI/2;wg.add(h);
    g.add(wg);wheels.push(wg);
  });
  const spoiler=new THREE.Mesh(new THREE.BoxGeometry(2.3,.12,.6),trim);spoiler.position.set(0,1.3,-1.7);body.add(spoiler);
  [-.8,.8].forEach(x=>{const st=new THREE.Mesh(new THREE.BoxGeometry(.12,.55,.12),dark);st.position.set(x,1,-1.65);body.add(st);});
  const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,.5,8),L(0x9aa3b5));pipe.rotation.x=Math.PI/2;pipe.position.set(.5,.65,-1.75);body.add(pipe);
  if(k.fin){const fin=new THREE.Mesh(new THREE.BoxGeometry(.12,.7,1.1),trim);fin.position.set(0,1.75,-1.75);fin.rotation.x=-.25;body.add(fin);}
  if(k.wide){[-1,1].forEach(s=>{const wp=new THREE.Mesh(new THREE.BoxGeometry(.14,.55,.75),main);wp.position.set(s*1.2,1.35,-1.7);body.add(wp);});
    const lip=new THREE.Mesh(new THREE.BoxGeometry(2.5,.1,.5),main);lip.position.set(0,.28,2.55);body.add(lip);}
  if(k.glow){const gm=new THREE.MeshBasicMaterial({color:k.glow});[-1,1].forEach(s=>{const strip=new THREE.Mesh(new THREE.BoxGeometry(.06,.08,2.2),gm);strip.position.set(s*1.44,.42,.1);body.add(strip);});
    const tail=new THREE.Mesh(new THREE.BoxGeometry(1.4,.1,.06),gm);tail.position.set(0,.72,-1.58);body.add(tail);}
  const sh=new THREE.Mesh(new THREE.CircleGeometry(1.9,20).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.28,depthWrite:false}));sh.position.y=.09;sh.scale.set(.75,1,1);g.add(sh);
  g.scale.setScalar(KSCALE);
  scene.add(g);
  return {g,body,wheels};
}

/* particles */
const puffTex=canvasTex(64,64,(c,w,h)=>{const gr=c.createRadialGradient(32,32,2,32,32,30);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=gr;c.fillRect(0,0,w,h);});
const POOL=[];
for(let i=0;i<220;i++){const m=new THREE.SpriteMaterial({map:puffTex,transparent:true,depthWrite:false,opacity:0});const s=new THREE.Sprite(m);s.visible=false;scene.add(s);POOL.push({s,life:0,max:1,vx:0,vy:0,vz:0,g0:1,g1:2,o:.5});}
let pIdx=0;
function emit(x,y,z,color,life,s0,s1,op,add,vx,vy,vz){
  const p=POOL[pIdx=(pIdx+1)%POOL.length];p.s.visible=true;p.s.position.set(x,y,z);p.life=p.max=life;p.g0=s0;p.g1=s1;p.o=op;p.vx=vx||0;p.vy=vy||0;p.vz=vz||0;
  p.s.material.color.setHex(color);p.s.material.blending=add?THREE.AdditiveBlending:THREE.NormalBlending;
}
function updateParticles(dt){
  for(const p of POOL){if(p.life<=0)continue;p.life-=dt;const t=1-p.life/p.max;
    if(p.life<=0){p.s.visible=false;continue;}
    p.s.position.x+=p.vx*dt;p.s.position.y+=p.vy*dt;p.s.position.z+=p.vz*dt;const sc=p.g0+(p.g1-p.g0)*t;p.s.scale.set(sc,sc,1);p.s.material.opacity=p.o*(1-t);}
}

/* ---------- audio ---------- */
let AC=null,eng=null,engGain=null,muted=!!load('drift-rush-mute');
function audioInit(){
  if(AC)return;try{AC=new (window.AudioContext||window.webkitAudioContext)();
    eng=AC.createOscillator();eng.type='sawtooth';const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=700;engGain=AC.createGain();engGain.gain.value=0;
    eng.connect(lp);lp.connect(engGain);engGain.connect(AC.destination);eng.start();}catch(e){AC=null;}
}
function beep(f,d,v){if(!AC||muted)return;const o=AC.createOscillator(),g=AC.createGain();o.type='square';o.frequency.value=f;g.gain.value=v||.08;g.gain.exponentialRampToValueAtTime(.0001,AC.currentTime+d);o.connect(g);g.connect(AC.destination);o.start();o.stop(AC.currentTime+d);}
function whoosh(){if(!AC||muted)return;const o=AC.createOscillator(),g=AC.createGain();o.type='triangle';o.frequency.setValueAtTime(200,AC.currentTime);o.frequency.exponentialRampToValueAtTime(900,AC.currentTime+.35);g.gain.value=.09;g.gain.exponentialRampToValueAtTime(.0001,AC.currentTime+.5);o.connect(g);g.connect(AC.destination);o.start();o.stop(AC.currentTime+.5);}

/* ---------- race state ---------- */
const ACCEL=30,MAXV=58,BRAKE=46,REV=12,STEER=2.0,DSTEER=2.75,GRIP=9,DGRIP=1.5;
let racers=[],player=null,state='menu',raceT=0,countT=0,finishOrder=[],camH=0,lastT=0,msgTimer=0,resultShown=false;
const keys={};
const touch={l:false,r:false,drift:false,brake:false,boost:false};
let driftPress=false;
const isTouch=window.matchMedia&&window.matchMedia('(pointer: coarse)').matches;

function nearestIdx(x,z,hint){
  let best=-1,bd=1e18;
  if(hint==null){for(let i=0;i<N;i++){const d=(S[i].x-x)**2+(S[i].z-z)**2;if(d<bd){bd=d;best=i;}}return best;}
  for(let o=-30;o<=30;o++){const i=((hint+o)%N+N)%N;const d=(S[i].x-x)**2+(S[i].z-z)**2;if(d<bd){bd=d;best=i;}}
  return best;
}
function newRacer(k,isPlayer,slot,name){
  const m=makeKart(k);
  const gi=N-12;const s=S[gi];const lat=[-1.5,-.5,.5,1.5][slot]*LANE;
  const st=isPlayer?k.st:{spd:1,acc:1,hnd:1,chg:1,ext:1};
  return {k,name,isPlayer,mesh:m,x:s.x+s.nx*lat,z:s.z+s.nz*lat,h:ang(gi),vx:0,vz:0,idx:gi,prog:gi-N,
    drifting:false,driftDir:0,driftT:0,gauge:0,boosts:0,boostT:0,lapStart:0,lapTimes:[],finished:false,finishT:0,
    maxMul:st.spd,acc:st.acc,hnd:st.hnd,chg:st.chg,ext:st.ext||1,exitT:0,exitMax:1,exitConv:0,lane:(Math.random()-.5)*HALF*1.2,seed:Math.random()*100,aiBoostCD:2,spin:0,wrongT:0,lap:0,smokeT:0};
}
function clearRace(){racers.forEach(r=>scene.remove(r.mesh.g));racers=[];}
function startRace(){
  audioInit();if(AC&&AC.state==='suspended')AC.resume();
  clearRace();finishOrder=[];resultShown=false;
  const mine=kartById(save.sel);
  let pool=STARTERS.filter(k=>k.id!==mine.id);
  while(pool.length>3)pool.splice(Math.floor(Math.random()*pool.length),1);
  pool.sort(()=>Math.random()-.5);
  const slots=[0,1,2,3].sort(()=>Math.random()-.5);
  player=newRacer(mine,true,slots[3],'나');
  racers=[newRacer(pool[0],false,slots[0],pool[0].name),newRacer(pool[1],false,slots[1],pool[1].name),newRacer(pool[2],false,slots[2],pool[2].name),player];
  racers.forEach((r,i)=>{if(!r.isPlayer){r.base=DIFF[opt.diff].m*(0.97+i*0.02);}});
  camH=player.h;raceT=0;countT=3.6;state='countdown';
  $('menu').classList.remove('on');$('result').classList.remove('on');$('hud').classList.add('on');
  $('touch').classList.toggle('on',isTouch);
  $('lap').innerHTML=`LAP 1<small>/ ${opt.laps}</small>`;
  updateHud(0);
  lastBeep=4;
}
let lastBeep=4;
function toMenu(){
  state='menu';$('hud').classList.remove('on');$('touch').classList.remove('on');$('result').classList.remove('on');$('menu').classList.add('on');
  if(engGain)engGain.gain.value=0;buildMenu();
}
function showMsg(t,d){const m=$('msg');m.textContent=t;m.classList.add('on');msgTimer=d||1.1;}

/* ---------- physics ---------- */
function physics(r,dt,inp){
  const sp=Math.hypot(r.vx,r.vz);
  const off=r.offroad;
  // steering
  let fwd=r.vx*Math.sin(r.h)+r.vz*Math.cos(r.h);
  const spdFac=Math.min(1,Math.abs(fwd)/12);
  if(r.drifting){
    const same=inp.steer===r.driftDir?1:(inp.steer===-r.driftDir?-1:0);
    const eff=r.driftDir*(same===1?1.15:same===-1?-.15:.7);
    r.h-=DSTEER*r.hnd*eff*spdFac*dt;
  }else{
    const hi=1-.28*Math.min(1,Math.max(0,fwd)/MAXV);
    r.h-=STEER*r.hnd*inp.steer*spdFac*hi*dt*(fwd>=0?1:-1);
    if(r.exitT>0)r.h-=DSTEER*r.hnd*r.driftDir*.55*spdFac*(r.exitT/r.exitMax)*dt;
  }
  const fx=Math.sin(r.h),fz=Math.cos(r.h),rx=Math.cos(r.h),rz=-Math.sin(r.h);
  let vf=r.vx*fx+r.vz*fz,vl=r.vx*rx+r.vz*rz;
  const boosting=r.boostT>0;
  let max=MAXV*r.maxMul*(boosting?1.35:1)*(off&&!boosting?.55:1);
  if(inp.throttle>0){if(vf<max)vf=Math.min(max,vf+(ACCEL*r.acc+(boosting?34:0))*dt);}
  else if(inp.throttle<0){if(vf>0)vf-=BRAKE*dt;else vf=Math.max(vf-ACCEL*.6*dt,-REV);}
  else{vf-=Math.sign(vf)*Math.min(Math.abs(vf),7*dt);}
  if(boosting&&inp.throttle>=0&&vf<max)vf=Math.min(max,vf+18*dt);
  if(vf>max)vf-=(vf-max)*Math.min(1,(off?2.5:1.6)*dt);
  // drift start / end
  if(inp.driftPress){
    if(r.drifting)endDrift(r);
    else if(inp.steer!==0&&vf>16){r.drifting=true;r.driftDir=inp.steer;r.driftT=0;r.exitT=0;vl+=inp.steer*-3.5;}
  }
  if(r.drifting){
    r.driftT+=dt;vf-=2.2*dt;
    r.gauge+=Math.abs(vl)*dt*(r.isPlayer?3.6*r.chg:0);
    if(vf<10)endDrift(r);
  }
  let grip=r.drifting?DGRIP:(off?GRIP*.7:GRIP);
  const exiting=!r.drifting&&r.exitT>0;
  if(exiting){const t=1-r.exitT/r.exitMax,e=t*t*(3-2*t);grip=DGRIP+(grip-DGRIP)*e;r.exitT-=dt;}
  const vl0=vl;vl*=Math.exp(-grip*dt);
  if(exiting&&vf>0&&vf<max)vf=Math.min(max,vf+Math.abs(vl0-vl)*r.exitConv);
  if(r.gauge>=100){r.gauge-=100;if(r.boosts<2){r.boosts++;if(r.isPlayer){showMsg('부스터 충전!',.9);beep(880,.12,.06);}}}
  r.vx=fx*vf+rx*vl;r.vz=fz*vf+rz*vl;
  r.x+=r.vx*dt;r.z+=r.vz*dt;
  if(r.boostT>0)r.boostT-=dt;
  r.fwd=vf;r.lat=vl;r.speed=sp;
}
function endDrift(r){
  r.drifting=false;
  const ep=exitParams(r.ext);r.exitT=r.exitMax=ep.time;r.exitConv=ep.conv;
  if(r.driftT>.55){r.boostT=Math.max(r.boostT,.4);if(r.isPlayer)showMsg('순간 가속!',.7);}
}
function constrain(r){
  const prev=r.idx;
  r.idx=nearestIdx(r.x,r.z,r.idx);
  let d=r.idx-prev;if(d<-N/2)d+=N;if(d>N/2)d-=N;r.prog+=d;
  const s=S[r.idx];const off=(r.x-s.x)*s.nx+(r.z-s.z)*s.nz;
  r.offroad=Math.abs(off)>HALF+1.6;r.latOff=off;
  const lim=WALL-KR;
  if(Math.abs(off)>lim){
    const sg=Math.sign(off),ex=off-sg*lim;r.x-=s.nx*ex;r.z-=s.nz*ex;
    const vn=r.vx*s.nx+r.vz*s.nz;
    if(vn*sg>0){const hard=Math.abs(vn)>4;r.vx-=s.nx*vn*(hard?1.4:1);r.vz-=s.nz*vn*(hard?1.4:1);if(hard){r.vx*=.9;r.vz*=.9;}if(r.isPlayer&&Math.abs(vn)>8){beep(110,.12,.1);}}
    if(r.drifting&&Math.abs(vn)>6)r.drifting=false;
  }
  // pads
  for(const p of PADS){let di=r.idx-p.i;if(di<-N/2)di+=N;if(di>N/2)di-=N;if(di>=-3&&di<=3){const lo=(r.x-S[p.i].x)*S[p.i].nx+(r.z-S[p.i].z)*S[p.i].nz;if(Math.abs(lo-p.off)<3.2){if(r.boostT<.5&&r.isPlayer){whoosh();showMsg('가속 발판!',.6);}r.boostT=Math.max(r.boostT,.9);}}}
}
function collide(){
  for(let i=0;i<racers.length;i++)for(let j=i+1;j<racers.length;j++){
    const a=racers[i],b=racers[j];const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),m=KR*2;
    if(d>0&&d<m){const nx=dx/d,nz=dz/d,p=(m-d)/2;a.x-=nx*p;a.z-=nz*p;b.x+=nx*p;b.z+=nz*p;
      const va=a.vx*nx+a.vz*nz,vb=b.vx*nx+b.vz*nz,dv=(va-vb)*.8;if(dv>0){a.vx-=nx*dv;a.vz-=nz*dv;b.vx+=nx*dv;b.vz+=nz*dv;}}
  }
}
function aiInput(r,dt){
  const look=Math.floor((24+Math.max(0,r.fwd||0)*.85)/SP);
  const ti=(r.idx+look)%N,t=S[ti];
  const lane=r.lane+Math.sin(raceT*.35+r.seed)*3.2;
  const tx=t.x+t.nx*lane,tz=t.z+t.nz*lane;
  const want=Math.atan2(tx-r.x,tz-r.z);let diff=want-r.h;while(diff>Math.PI)diff-=Math.PI*2;while(diff<-Math.PI)diff+=Math.PI*2;
  const steerRaw=Math.max(-1,Math.min(1,-diff*3));
  let a1=ang(r.idx),a2=ang(r.idx+Math.floor(100/SP)),cd=Math.abs(((a2-a1+Math.PI*3)%(Math.PI*2))-Math.PI);
  const curv=Math.min(1,cd/1.1);
  const gap=(player.prog-r.prog)/(N*.18);
  r.maxMul=r.base*(1-.3*curv)*(1+Math.max(-.12,Math.min(.14,gap*.12)));
  r.aiBoostCD-=dt;
  if(r.aiBoostCD<=0){r.aiBoostCD=3+Math.random()*4;if(curv<.2&&Math.random()<.45)r.boostT=Math.max(r.boostT,1.0);}
  return {throttle:1,steer:Math.abs(steerRaw)<.08?0:steerRaw,drift:false};
}
function playerInput(){
  let steer=0;
  if(keys.ArrowLeft||keys.KeyA||touch.l)steer-=1;
  if(keys.ArrowRight||keys.KeyD||touch.r)steer+=1;
  let throttle=0;
  if(keys.ArrowUp||keys.KeyW)throttle=1;
  if(isTouch&&!touch.brake)throttle=1;
  if(keys.ArrowDown||keys.KeyS||touch.brake)throttle=throttle>0&&!touch.brake?0:-1;
  if((keys.ArrowDown||keys.KeyS)&&(keys.ArrowUp||keys.KeyW))throttle=0;
  const dp=driftPress;driftPress=false;
  return {throttle,steer,driftPress:dp};
}
function useBoost(){
  if(state!=='race'||!player||player.finished)return;
  if(player.boosts>0&&player.boostT<.6){player.boosts--;player.boostT=1.35;whoosh();showMsg('부스터!',.6);}
}

/* ---------- visuals per frame ---------- */
function syncMesh(r,dt){
  const g=r.mesh.g;g.position.set(r.x,0,r.z);g.rotation.y=r.h;
  r.spin+=(r.fwd||0)*dt*2.2;r.mesh.wheels.forEach((w,i)=>{w.children[0].rotation.x=r.spin;w.children[1].rotation.x=r.spin;});
  const roll=r.drifting?-r.driftDir*.08:(r.exitT>0?-r.driftDir*.08*(r.exitT/r.exitMax):0);r.mesh.body.rotation.z+=(roll-r.mesh.body.rotation.z)*Math.min(1,dt*8);
  r.mesh.body.position.y=r.offroad?Math.sin(raceT*40+r.seed)*.05:0;
  const fx=Math.sin(r.h),fz=Math.cos(r.h),rx=Math.cos(r.h),rz=-Math.sin(r.h);
  r.smokeT-=dt;
  if(r.smokeT<=0){
    r.smokeT=.025;
    if(r.drifting||r.exitT>r.exitMax*.35){
      const col=r.isPlayer?(r.gauge>66?0xffd86b:0xeeeeee):0xe8e8e8;
      [-1,1].forEach(s=>emit(r.x-fx*1.0+rx*s*.85,.28,r.z-fz*1.0+rz*s*.85,col,.6,.6,2.1,.55,false,-r.vx*.05,1.1,-r.vz*.05));
    }
    if(r.boostT>0){emit(r.x-fx*1.5+rx*.38,.5,r.z-fz*1.5+rz*.38,0xff8a2a,.25,.85,.25,.95,true,-fx*6,0,-fz*6);emit(r.x-fx*1.75+rx*.38,.5,r.z-fz*1.75+rz*.38,0x55c8ff,.2,.55,.15,.8,true,-fx*4,0,-fz*4);}
    if(r.offroad&&Math.abs(r.fwd||0)>12)emit(r.x-fx*1.4,.3,r.z-fz*1.4,0xc8b47a,.5,.6,1.6,.45,false,0,.8,0);
  }
}
function lerpAng(a,b,t){let d=b-a;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return a+d*t;}
function updateCamera(dt){
  const r=player;if(!r)return;
  const sp=Math.hypot(r.vx,r.vz);
  const vh=sp>4?Math.atan2(r.vx,r.vz):r.h;
  const target=(r.fwd||0)<-1?r.h:lerpAng(r.h,vh,.35);
  camH=lerpAng(camH,target,1-Math.exp(-4.5*dt));
  const back=r.boostT>0?10.2:9,hgt=4.3;
  const cx=r.x-Math.sin(camH)*back,cz=r.z-Math.cos(camH)*back;
  camera.position.x+=(cx-camera.position.x)*Math.min(1,dt*10);
  camera.position.z+=(cz-camera.position.z)*Math.min(1,dt*10);
  camera.position.y+=(hgt-camera.position.y)*Math.min(1,dt*6);
  camera.lookAt(r.x+Math.sin(camH)*7,1.1,r.z+Math.cos(camH)*7);
  const fov=70+(r.boostT>0?12:0)+Math.min(6,sp/10);
  camera.fov+=(fov-camera.fov)*Math.min(1,dt*5);camera.updateProjectionMatrix();
}

/* ---------- HUD ---------- */
const mini=$('mini'),mctx=mini.getContext('2d');
let minX=1e9,maxX=-1e9,minZ=1e9,maxZ=-1e9;S.forEach(s=>{minX=Math.min(minX,s.x);maxX=Math.max(maxX,s.x);minZ=Math.min(minZ,s.z);maxZ=Math.max(maxZ,s.z);});
const mscale=250/Math.max(maxX-minX,maxZ-minZ);
const mp=(x,z)=>[150-(x-(minX+maxX)/2)*mscale,150-(z-(minZ+maxZ)/2)*mscale];
function drawMini(){
  mctx.clearRect(0,0,300,300);
  mctx.lineJoin='round';mctx.lineCap='round';
  mctx.beginPath();S.forEach((s,i)=>{const [x,y]=mp(s.x,s.z);i?mctx.lineTo(x,y):mctx.moveTo(x,y);});mctx.closePath();
  mctx.strokeStyle='rgba(255,255,255,.9)';mctx.lineWidth=15;mctx.stroke();mctx.strokeStyle='#3b4258';mctx.lineWidth=10;mctx.stroke();
  const [sx,sy]=mp(S[0].x,S[0].z);mctx.fillStyle='#fff';mctx.fillRect(sx-5,sy-5,10,10);
  racers.forEach(r=>{if(r.isPlayer)return;const [x,y]=mp(r.x,r.z);mctx.fillStyle=hex(r.k.body);mctx.beginPath();mctx.arc(x,y,8,0,7);mctx.fill();mctx.strokeStyle='#fff';mctx.lineWidth=2;mctx.stroke();});
  if(player){const [x,y]=mp(player.x,player.z);mctx.save();mctx.translate(x,y);mctx.rotate(-player.h);mctx.fillStyle='#ffc531';mctx.strokeStyle='#111';mctx.lineWidth=2.5;mctx.beginPath();mctx.moveTo(0,-13);mctx.lineTo(10,10);mctx.lineTo(0,5);mctx.lineTo(-10,10);mctx.closePath();mctx.fill();mctx.stroke();mctx.restore();}
}
function fmt(t){const m=Math.floor(t/60),s=t-m*60;return String(m).padStart(2,'0')+':'+s.toFixed(2).padStart(5,'0');}
function standings(){
  return racers.slice().sort((a,b)=>{if(a.finished&&b.finished)return a.finishT-b.finishT;if(a.finished)return -1;if(b.finished)return 1;return b.prog-a.prog;});
}
let hudT=0;
function updateHud(dt){
  hudT-=dt;
  const st=standings(),pos=st.indexOf(player)+1;
  $('rank').innerHTML=`<b>${pos}</b><span>/ ${racers.length}위</span>`;
  $('speed').querySelector('b').textContent=Math.round(Math.max(0,player.fwd||0)*3.6);
  $('gauge').firstElementChild.style.width=Math.min(100,player.gauge)+'%';
  $('s0').classList.toggle('full',player.boosts>=1);$('s1').classList.toggle('full',player.boosts>=2);
  $('flash').classList.toggle('on',player.boostT>0);
  if(hudT<=0){
    hudT=.1;
    $('time').textContent=fmt(raceT);
    $('board').innerHTML=st.map((r,i)=>`<div class="${r.isPlayer?'me':''}">${i+1}. ${r.name}${r.finished?' 🏁':''}</div>`).join('');
    drawMini();
  }
}

/* ---------- loop ---------- */
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(.05,(now-(lastT||now))/1000);lastT=now;
  if(state==='countdown'||state==='race'||state==='finish'){
    if(state==='countdown'){
      countT-=dt;const c=Math.ceil(countT-.6);
      if(c!==lastBeep&&c>=0){lastBeep=c;if(c>0){$('count').textContent=c;$('count').classList.remove('is-go');beep(440,.18,.08);}else{$('count').textContent='GO!';$('count').classList.add('is-go');beep(880,.35,.1);}}
      if(countT<=.6){state='race';raceT=0;racers.forEach(r=>r.lapStart=0);}
    }else{
      if(state==='race'||state==='finish')raceT+=dt;
      if(countT>-1){countT-=dt;if(countT<-.4){$('count').textContent='';$('count').classList.remove('is-go');}}
      racers.forEach(r=>{
        let inp;
        if(r.finished){inp={throttle:r.isPlayer?0:.5,steer:0,drift:false};if(!r.isPlayer){inp=aiInput(r,dt);inp.throttle=1;r.maxMul*=.6;}}
        else inp=r.isPlayer?playerInput():aiInput(r,dt);
        physics(r,dt,inp);constrain(r);
        const lap=Math.floor(r.prog/N);
        if(lap>r.lap&&lap>=1&&!r.finished){r.lapTimes.push(raceT-r.lapStart);r.lapStart=raceT;
          if(r.isPlayer&&lap<opt.laps){showMsg(lap===opt.laps-1?'마지막 바퀴!':`LAP ${lap+1}`,1.2);beep(660,.15,.07);}
        }
        r.lap=Math.max(r.lap,lap);
        if(!r.finished&&r.prog>=opt.laps*N){r.finished=true;r.finishT=raceT;finishOrder.push(r);
          if(r.isPlayer){showMsg('FINISH!',2);beep(990,.4,.1);state='finish';setTimeout(showResult,2200);}}
        if(r.isPlayer){
          const tAng=ang(r.idx);let dd=Math.abs(((r.h-tAng+Math.PI*3)%(Math.PI*2))-Math.PI);
          if(dd>2.1&&Math.abs(r.fwd)>6){r.wrongT+=dt;if(r.wrongT>.8&&msgTimer<=0)showMsg('역주행!',.6);}else r.wrongT=0;
        }
      });
      collide();
    }
    racers.forEach(r=>syncMesh(r,dt));
    updateCamera(dt);updateHud(dt);
    if(msgTimer>0){msgTimer-=dt;if(msgTimer<=0)$('msg').classList.remove('on');}
    if(engGain){const sp=Math.max(0,player.fwd||0);engGain.gain.value=muted?0:.035+Math.min(.03,sp/1500);eng.frequency.value=55+sp*2.6+(player.boostT>0?40:0);}
  }else{
    // menu: orbit camera
    const t=now/1000*.08;const s=S[Math.floor((t*N))%N];
    camera.position.set(s.x+Math.cos(t*3)*60,40,s.z+Math.sin(t*3)*60);camera.lookAt(s.x,0,s.z);
  }
  updateParticles(dt);
  renderer.render(scene,camera);
}

/* ---------- result ---------- */
function showResult(){
  if(resultShown)return;resultShown=true;
  const st=standings(),pos=st.indexOf(player)+1;
  $('resRank').textContent=pos+'위';
  $('resLabel').textContent=pos===1?'우승이야!':pos===2?'아깝다, 한 끗 차이':'다음엔 드리프트로 따라잡자';
  const best=load('drift-rush-best')||{};const key=opt.laps+'';
  let rec='';
  if(!best[key]||player.finishT<best[key]){best[key]=player.finishT;store('drift-rush-best',best);rec=' · 새 최고 기록!';}
  const bestLap=Math.min(...player.lapTimes);
  $('resTable').innerHTML=st.map((r,i)=>`<tr class="${r.isPlayer?'me':''}"><td>${i+1}위</td><td>${r.name}</td><td>${r.finished?fmt(r.finishT):'주행 중'}</td></tr>`).join('');
  $('resBest').textContent=`내 기록 ${fmt(player.finishT)} · 베스트 랩 ${fmt(bestLap)}${rec}`;
  const earned=Math.round(RANK_P[pos-1]*opt.laps*DIFF[opt.diff].bonus/5)*5;
  save.points+=earned;saveGame();
  $('resEarn').innerHTML=`+${earned.toLocaleString()} P<small>보유 ${save.points.toLocaleString()} P</small>`;
  $('result').classList.add('on');$('touch').classList.remove('on');
}
function renderBest(){
  const best=load('drift-rush-best')||{};
  const parts=Object.keys(best).sort().map(k=>`${k}바퀴 ${fmt(best[k])}`);
  $('best').textContent=parts.length?'최고 기록 · '+parts.join(' · '):'아직 기록이 없어. 첫 레이스를 달려봐!';
}

/* ---------- menu UI ---------- */
function statBars(st){
  const rows=[['최고 속도',st.spd],['가속',st.acc],['핸들링',st.hnd],['드리프트 충전',st.chg],['드리프트 탈출',st.ext]];
  const ep=exitParams(st.ext);
  return rows.map(([n,v])=>`<div class="stat"><span>${n}</span><div class="bar"><i style="width:${Math.round(40+(v-1)/.3*60)}%"></i></div></div>`).join('')+`<div class="stat-note">탈출 ${ep.time.toFixed(2)}초 · 미끄럼 속도의 ${Math.round(ep.conv*100)}%를 가속으로 전환</div>`;
}
function swatch(k){return `<div class="sw" style="background:linear-gradient(120deg,${hex(k.body)} 0 66%,${hex(k.trim)} 66% 82%,${hex(k.glow||k.helmet)} 82% 100%)"></div>`;}
function buildMenu(){
  $('wallet').innerHTML=`<small>보유 포인트</small>${save.points.toLocaleString()} P`;
  const kc=$('karts');kc.innerHTML='';
  KARTS.filter(k=>save.owned.includes(k.id)).forEach(k=>{const b=document.createElement('button');b.type='button';b.className='kopt';b.setAttribute('aria-pressed',save.sel===k.id);
    b.innerHTML=swatch(k)+k.name;
    b.onclick=()=>{save.sel=k.id;saveGame();buildMenu();};kc.appendChild(b);});
  const lc=$('laps');lc.innerHTML='';
  [1,2,3].forEach(n=>{const b=document.createElement('button');b.type='button';b.className='seg';b.textContent=n+'바퀴';b.setAttribute('aria-pressed',opt.laps===n);b.onclick=()=>{opt.laps=n;store('drift-rush-opt',opt);buildMenu();};lc.appendChild(b);});
  const dc=$('diff');dc.innerHTML='';
  DIFF.forEach((d,i)=>{const b=document.createElement('button');b.type='button';b.className='seg';b.textContent=d.n;b.setAttribute('aria-pressed',opt.diff===i);b.onclick=()=>{opt.diff=i;store('drift-rush-opt',opt);buildMenu();};dc.appendChild(b);});
  const gc=$('garage');gc.innerHTML='';
  KARTS.forEach(k=>{
    const own=save.owned.includes(k.id),sel=save.sel===k.id;
    const d=document.createElement('div');d.className='gk'+(sel?' sel':'');
    const tier=k.price===0?'기본 카트':`${k.price.toLocaleString()} P`;
    let btn;
    if(sel)btn=`<button type="button" class="using disp" disabled>사용 중</button>`;
    else if(own)btn=`<button type="button" class="use disp">이 카트 쓰기</button>`;
    else btn=`<button type="button" class="buy disp" ${save.points<k.price?'disabled':''}>${save.points<k.price?`${(k.price-save.points).toLocaleString()} P 부족`:`${k.price.toLocaleString()} P로 구매`}</button>`;
    d.innerHTML=`${swatch(k)}<h3 class="disp">${k.name}</h3><div class="tier">${tier}${own&&k.price>0?' · 보유 중':''}</div>${statBars(k.st)}${btn}`;
    const bt=d.querySelector('button');
    if(own&&!sel)bt.onclick=()=>{save.sel=k.id;saveGame();buildMenu();};
    if(!own&&save.points>=k.price)bt.onclick=()=>{save.points-=k.price;save.owned.push(k.id);save.sel=k.id;saveGame();buildMenu();beep(880,.12,.06);};
    gc.appendChild(d);
  });
  renderBest();
}
function setTab(g){
  $('tabRace').hidden=g;$('tabGarage').hidden=!g;
  $('tabRaceBtn').setAttribute('aria-selected',!g);$('tabGarageBtn').setAttribute('aria-selected',g);
}
$('tabRaceBtn').onclick=()=>setTab(false);
$('tabGarageBtn').onclick=()=>setTab(true);
$('start').onclick=startRace;
$('again').onclick=startRace;
$('toMenu').onclick=toMenu;
$('quit').onclick=toMenu;

/* ---------- input ---------- */
const GAME_KEYS=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyW','KeyA','KeyS','KeyD','ControlLeft','ControlRight'];
window.addEventListener('keydown',e=>{
  if(state==='menu'||$('result').classList.contains('on')){if(e.code==='Enter'&&state==='menu'){startRace();}return;}
  if(GAME_KEYS.includes(e.code))e.preventDefault();
  keys[e.code]=true;
  if((e.code==='ShiftLeft'||e.code==='ShiftRight')&&!e.repeat&&state==='race')driftPress=true;
  if((e.code==='Space'||e.code==='ControlLeft'||e.code==='ControlRight')&&!e.repeat)useBoost();
  if(e.code==='KeyR'&&player&&state==='race'){const s=S[player.idx];player.x=s.x;player.z=s.z;player.h=ang(player.idx);player.vx=player.vz=0;player.drifting=false;camH=player.h;}
  if(e.code==='KeyM'){muted=!muted;store('drift-rush-mute',muted);showMsg(muted?'소리 끔':'소리 켬',.6);}
  if(e.code==='Escape')toMenu();
});
window.addEventListener('keyup',e=>{keys[e.code]=false;});
window.addEventListener('blur',()=>{for(const k in keys)keys[k]=false;});
function bindTouch(id,key,onDown){
  const el=$(id);
  const down=e=>{e.preventDefault();touch[key]=true;el.classList.add('down');if(onDown)onDown();};
  const up=e=>{e.preventDefault();touch[key]=false;el.classList.remove('down');};
  el.addEventListener('pointerdown',down);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('pointerleave',up);
}
bindTouch('tL','l');bindTouch('tR','r');bindTouch('tDrift','drift',()=>{if(state==='race')driftPress=true;});bindTouch('tBrake','brake');bindTouch('tBoost','boost',useBoost);

function resize(){const w=window.innerWidth,h=window.innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);resize();
buildMenu();
requestAnimationFrame(frame);
})();
