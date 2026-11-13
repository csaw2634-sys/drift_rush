/* 드리프트 러시 - 게임 로직 (three.js r128) */
(function(){
'use strict';
const $=id=>document.getElementById(id);

/* ---------- options ---------- */
const KARTS=[
  {id:'red',style:'buggy',name:'레드 썬더',price:0,body:0xff4d2e,trim:0xffc531,suit:0x2b2f45,helmet:0xffffff,st:{spd:1,acc:1,hnd:1,chg:1}},
  {id:'blue',style:'wave',name:'블루 웨이브',price:0,body:0x2f7cff,trim:0xe8f1ff,suit:0x1c2340,helmet:0xffd23f,st:{spd:1,acc:1,hnd:1,chg:1}},
  {id:'yellow',style:'bee',name:'옐로 비',price:0,body:0xffc531,trim:0x222222,suit:0x3a2a12,helmet:0xff6aa2,st:{spd:1,acc:1,hnd:1,chg:1}},
  {id:'mint',style:'jet',name:'민트 젯',price:0,body:0x22c7a0,trim:0xffffff,suit:0x15322c,helmet:0x7c5cff,st:{spd:1,acc:1,hnd:1,chg:1}},
  {id:'fin',style:'shark',name:'스트리트 핀',price:600,body:0x9b5cff,trim:0xffffff,suit:0x241a3d,helmet:0x9b5cff,st:{spd:1.03,acc:1.05,hnd:1.04,chg:1.06}},
  {id:'blaze',style:'blade',name:'블레이즈 X',price:1500,body:0xff2e6a,trim:0x1b1e28,suit:0x1b1e28,helmet:0xffc531,glow:0xff9a3c,st:{spd:1.06,acc:1.08,hnd:1.06,chg:1.12}},
  {id:'aurora',style:'gt',name:'오로라 GT',price:3000,body:0x18d0ff,trim:0xeafffb,suit:0x0e2a3a,helmet:0xffffff,glow:0x18d0ff,st:{spd:1.09,acc:1.11,hnd:1.08,chg:1.18}},
  {id:'phantom',style:'armor',name:'팬텀 R',price:5000,body:0x2a2d3a,trim:0xff3b3b,suit:0x111318,helmet:0x2a2d3a,glow:0xff3b3b,st:{spd:1.12,acc:1.14,hnd:1.1,chg:1.24}},
  {id:'solar',style:'sun',name:'솔라 플레어',price:8000,body:0xffb21a,trim:0xff4d2e,suit:0x3a1a08,helmet:0xffffff,glow:0xffd84a,st:{spd:1.16,acc:1.18,hnd:1.13,chg:1.3}}
];
/* drift exit: ext 1.0 (starter) .. 1.3 (top) */
const EXT={red:1,blue:1,yellow:1,mint:1,fin:1.06,blaze:1.12,aurora:1.18,phantom:1.24,solar:1.3};
KARTS.forEach(k=>{k.st.ext=EXT[k.id]||1;});
function exitParams(ext){const u=Math.max(0,Math.min(1,(ext-1)/.3));return {time:.3+.55*u,conv:.2+.5*u};}
const STARTERS=KARTS.filter(k=>k.price===0);
const kartById=id=>KARTS.find(k=>k.id===id)||KARTS[0];
const opt={laps:2,diff:1};
const DIFF=[{n:'느긋하게',m:.86,bonus:.8},{n:'보통',m:.94,bonus:1},{n:'빡세게',m:1.0,bonus:1.3}];
const RANK_P=[1000000,1000000,1000000,50,40,30,20,10];
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
/* 공용 도형 도우미 */
function sideProf(pts,w){ /* 옆모습(z,y) 윤곽을 x 방향으로 두께 w만큼 */
  const s=new THREE.Shape();pts.forEach(([z,y],i)=>i?s.lineTo(z,y):s.moveTo(z,y));
  const geo=new THREE.ExtrudeGeometry(s,{depth:w,bevelEnabled:false});geo.rotateY(-Math.PI/2);geo.translate(w/2,0,0);return geo;}
function planProf(pts,h){ /* 위에서 본(x,z) 윤곽을 위로 두께 h만큼 */
  const s=new THREE.Shape();pts.forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z));
  const geo=new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:false});geo.rotateX(-Math.PI/2);return geo;}
function kitFor(body,k){
  const M=c=>new THREE.MeshLambertMaterial({color:c,flatShading:true});
  const kit={M,main:M(k.body),trim:M(k.trim),dark:M(0x1b1e28),chrome:M(0xb8c0cf),
    glow:new THREE.MeshBasicMaterial({color:k.glow||k.trim}),
    add(geo,mat,x,y,z,rx,ry,rz){const m=new THREE.Mesh(geo,mat);m.position.set(x||0,y||0,z||0);m.rotation.set(rx||0,ry||0,rz||0);body.add(m);return m;},
    box(w,h,d,mat,x,y,z,rx,ry,rz){return kit.add(new THREE.BoxGeometry(w,h,d),mat,x,y,z,rx,ry,rz);},
    cyl(rt,rb,h,seg,mat,x,y,z,rx,ry,rz){return kit.add(new THREE.CylinderGeometry(rt,rb,h,seg),mat,x,y,z,rx,ry,rz);},
    side(pts,w,mat,x,y,z){return kit.add(sideProf(pts,w),mat,x,y,z);},
    plan(pts,h,mat,x,y,z){return kit.add(planProf(pts,h),mat,x,y,z);},
    mirror(f){[-1,1].forEach(f);}};
  return kit;
}
/* 카트별 차체 — 스타일 이름은 KARTS의 style 값 */
const KART_STYLES={
  /* 레드 썬더: 파이프 프레임이 드러난 오프로드 버기 */
  buggy(K){
    K.box(1.5,.14,3.2,K.dark,0,.36,.1);
    K.side([[.9,.42],[2.55,.42],[2.6,.62],[.9,1.0]],1.3,K.main,0,0,0);
    K.mirror(s=>{K.box(.42,.46,1.3,K.main,s*.95,.62,.15);
      K.cyl(.06,.06,3.3,6,K.trim,s*.78,.95,.2,Math.PI/2+.08);
      K.cyl(.06,.06,1.0,6,K.trim,s*.6,1.25,-1.4,.65);});
    K.add(new THREE.TorusGeometry(.78,.07,6,14,Math.PI),K.trim,0,1.15,-1.05);
    K.cyl(.07,.07,2.4,6,K.trim,0,.55,2.55,0,0,Math.PI/2);
    K.box(1.0,.45,.7,K.dark,0,.7,-1.55);
    K.mirror(s=>{K.cyl(.11,.11,.8,8,K.chrome,s*.32,1.15,-1.7);K.cyl(.14,.11,.1,8,K.dark,s*.32,1.58,-1.7);});
    K.mirror(s=>K.box(.35,.12,.12,K.glow,s*.4,.74,2.62));
  },
  /* 블루 웨이브: 뒤쪽 파도 마루가 말려 올라가는 차체 */
  wave(K){
    K.side([[-1.75,.32],[2.5,.32],[2.62,.52],[1.4,.82],[-.1,.78],[-1.2,1.0],[-1.75,.95]],2.0,K.main,0,0,0);
    K.mirror(s=>K.side([[-1.85,.4],[.7,.4],[-.1,.85],[-.7,1.45],[-1.25,1.75],[-1.6,1.68],[-1.3,1.45],[-1.55,1.2],[-1.85,.95]],.16,K.trim,s*1.06,0,0));
    K.mirror(s=>K.side([[.2,.5],[2.3,.5],[2.0,.62],[.4,.62]],.04,K.trim,s*1.01,0,0));
    K.box(2.2,.1,.5,K.trim,0,.3,2.5);
    K.mirror(s=>K.box(.3,.1,.08,K.glow,s*.55,.6,2.6));
  },
  /* 옐로 비: 둥근 몸통과 줄무늬 꽁무니, 더듬이 */
  bee(K){
    const sp=K.add(new THREE.SphereGeometry(1,14,10),K.main,0,.72,.55);sp.scale.set(1.05,.48,1.75);
    [[.62,.0,K.main],[.7,-.35,K.trim],[.66,-.7,K.main],[.55,-1.05,K.trim],[.4,-1.38,K.main]].forEach(([r,z,m])=>K.cyl(r,r,.36,12,m,0,.85,z-.6,Math.PI/2));
    K.add(new THREE.ConeGeometry(.3,.6,10),K.trim,0,.85,-2.3,-Math.PI/2);
    K.mirror(s=>{K.cyl(.035,.035,1.0,5,K.trim,s*.35,1.25,2.0,.9,0,s*-.35);
      K.add(new THREE.SphereGeometry(.13,8,6),K.trim,s*.52,1.55,2.38);});
    const wing=new THREE.MeshLambertMaterial({color:0xffffff,transparent:true,opacity:.55,side:THREE.DoubleSide});
    K.mirror(s=>{const w=K.add(new THREE.CircleGeometry(.75,12),wing,s*.85,1.75,-1.05,-Math.PI/2+.35,0,0);w.scale.set(.6,1.2,1);w.rotation.y=s*.5;});
  },
  /* 민트 젯: 동체형 차체와 뒤쪽 제트 엔진 */
  jet(K){
    K.cyl(.62,.66,3.2,12,K.main,0,.72,0,Math.PI/2);
    K.add(new THREE.ConeGeometry(.62,1.1,12),K.main,0,.72,2.15,Math.PI/2);
    K.cyl(.75,.6,.7,12,K.dark,0,.8,-1.85,Math.PI/2);
    K.add(new THREE.CircleGeometry(.5,12),K.glow,0,.8,-2.21,0,Math.PI);
    K.mirror(s=>K.plan([[s*.5,.9],[s*1.75,-.6],[s*1.75,-1.0],[s*.5,-1.0]],.08,K.trim,0,1.0,0));
    K.side([[-1.9,1.1],[-1.2,1.1],[-1.65,2.0],[-1.95,2.0]],.1,K.trim,0,0,0);
    K.mirror(s=>K.box(.04,.08,2.4,K.glow,s*.66,.78,.1));
  },
  /* 스트리트 핀: 상어 실루엣, 등지느러미와 아가미 */
  shark(K){
    K.side([[-1.8,.34],[2.75,.34],[2.3,.78],[1.0,1.0],[-1.2,1.0],[-1.8,.82]],1.9,K.main,0,0,0);
    K.side([[-1.6,.3],[2.6,.3],[2.4,.5],[-1.5,.5]],2.0,K.trim,0,0,0);
    K.side([[-1.35,1.0],[-.55,1.0],[-1.05,2.35],[-1.4,2.4],[-1.3,1.6]],.16,K.main,0,0,0);
    K.side([[-1.8,.6],[-1.6,.6],[-2.4,1.55],[-2.55,1.5],[-2.1,.8],[-2.5,.35],[-2.35,.3]],.14,K.main,0,0,0);
    K.mirror(s=>{K.plan([[s*.9,.6],[s*1.75,-.35],[s*1.6,-.55],[s*.9,-.1]],.07,K.main,0,.5,0);
      [0,1,2].forEach(i=>K.box(.04,.32,.06,K.dark,s*.96,.72,1.55-i*.22,0,0,0));
      K.box(.06,.14,.14,K.dark,s*.96,.62,2.05);});
  },
  /* 블레이즈 X: 낮은 쐐기형, 뒤로 뻗은 불꽃 칼날 */
  blade(K){
    K.side([[-1.8,.3],[2.85,.3],[2.85,.42],[.2,.95],[-1.8,1.0]],1.9,K.main,0,0,0);
    K.mirror(s=>{K.plan([[s*.9,1.7],[s*1.6,.2],[s*1.9,-1.9],[s*1.3,-.9],[s*.9,-.4]],.1,K.trim,0,1.0,0);
      K.plan([[s*.95,.7],[s*1.4,-.3],[s*1.5,-1.6],[s*1.1,-.8]],.08,K.main,0,1.1,0);});
    [[-.45,.0],[0,.15],[.45,0]].forEach(([x,dy])=>K.add(new THREE.ConeGeometry(.16,.9+dy*2,4),K.trim,x,1.35+dy,-1.75,-.9));
    K.mirror(s=>K.box(.08,.06,1.6,K.glow,s*.97,.62,1.3,0,0,0));
    K.box(1.2,.08,.08,K.glow,0,.5,2.86);
  },
  /* 오로라 GT: 낮고 긴 GT, 투명 캐노피와 대형 윙 */
  gt(K){
    K.side([[-1.9,.3],[2.7,.3],[2.85,.46],[1.6,.72],[-.2,.82],[-1.9,.85]],2.2,K.main,0,0,0);
    K.mirror(s=>K.side([[-.55,.5],[.6,.5],[.7,.82],[-.4,.86]],.3,K.main,s*1.12,0,0));
    const glass=new THREE.MeshLambertMaterial({color:k_tint(K),transparent:true,opacity:.32});
    const cn=K.add(new THREE.SphereGeometry(1,14,10,0,Math.PI*2,0,Math.PI/2),glass,0,.82,-.2);cn.scale.set(.9,1.95,1.4);
    K.box(2.6,.1,.65,K.trim,0,1.55,-1.85);
    K.mirror(s=>{K.box(.08,.5,.8,K.trim,s*1.3,1.4,-1.85);K.box(.1,.65,.1,K.dark,s*.6,1.15,-1.8);
      K.box(.06,.08,2.6,K.glow,s*1.12,.42,.2);});
    K.box(1.6,.08,.06,K.glow,0,.62,2.8);K.box(1.4,.1,.06,K.glow,0,.78,-1.92);
  },
  /* 팬텀 R: 비스듬한 장갑판을 두른 중장갑 카트 */
  armor(K){
    K.box(1.8,.55,3.0,K.main,0,.6,-.1);
    K.side([[1.2,.88],[2.75,.4],[2.95,.4],[2.95,.62],[1.4,1.08]],1.8,K.main,0,0,0);
    K.side([[2.6,.25],[3.1,.25],[3.1,.5],[2.6,.55]],1.4,K.dark,0,0,0);
    K.mirror(s=>{K.box(.6,.12,3.3,K.main,s*1.18,1.06,-.05,0,0,s*-.25);
      K.box(.14,.3,3.3,K.dark,s*.92,.95,-.05);
      [-1.1,0,1.1].forEach(z=>K.cyl(.07,.07,.1,6,K.trim,s*1.2,1.12,z,0,0,s*-.25));});
    K.box(1.8,.09,.06,K.glow,0,.92,2.04,0,0,0).rotation.x=-.55;
    K.box(1.6,.5,.4,K.dark,0,1.05,-1.55);
    K.mirror(s=>[.25,.6].forEach(x=>K.cyl(.09,.09,.55,6,K.chrome,s*x,1.4,-1.62)));
    K.box(1.9,.08,.06,K.glow,0,.75,-1.62);
  },
  /* 솔라 플레어: 운전석 뒤 태양 고리와 빛살 */
  sun(K){
    K.side([[-1.8,.32],[2.6,.32],[2.75,.5],[1.3,.85],[-1.8,.95]],2.0,K.main,0,0,0);
    K.mirror(s=>K.side([[-1.6,.5],[2.2,.5],[1.6,.66],[-1.6,.72]],.06,K.trim,s*1.02,0,0));
    K.add(new THREE.TorusGeometry(1.0,.1,6,20),K.main,0,1.65,-1.45);
    for(let i=0;i<10;i++){const a=i/10*Math.PI*2,r=1.25;
      K.add(new THREE.ConeGeometry(.12,.4,4),i%2?K.trim:K.main,Math.cos(a)*r,1.65+Math.sin(a)*r,-1.45,0,0,a-Math.PI/2);}
    K.box(.16,.9,.16,K.dark,0,1.0,-1.45);
    K.mirror(s=>K.box(.06,.08,2.3,K.glow,s*1.02,.4,.3));
    K.box(1.5,.08,.06,K.glow,0,.6,2.76);
  }
};
function k_tint(K){return K.glow.color.getHex();}
function buildKartModel(k){
  const g=new THREE.Group(),body=new THREE.Group();g.add(body);
  const K=kitFor(body,k);
  (KART_STYLES[k.style]||KART_STYLES.buggy)(K);
  /* 운전자 */
  K.box(1.1,.85,.28,K.dark,0,1.15,-.78);
  K.cyl(.42,.5,.85,10,K.M(k.suit),0,1.3,-.35);
  K.add(new THREE.SphereGeometry(.56,16,12),new THREE.MeshLambertMaterial({color:k.helmet}),0,2.05,-.3);
  K.box(.78,.26,.22,new THREE.MeshLambertMaterial({color:0x1d2a44,emissive:0x0a1430}),0,2.07,.18);
  K.box(.9,.12,.12,K.dark,0,1.25,.55);
  /* 바퀴 */
  const wheel=new THREE.MeshLambertMaterial({color:0x15161b}),hub=K.trim;
  const wheels=[];
  [[-1.15,1.15],[1.15,1.15],[-1.2,-1.15],[1.2,-1.15]].forEach(([x,z],i)=>{
    const wg=new THREE.Group();wg.position.set(x,.48,z);
    const w=new THREE.Mesh(new THREE.CylinderGeometry(i<2?.42:.5,i<2?.42:.5,i<2?.38:.5,14),wheel);w.rotation.z=Math.PI/2;wg.add(w);
    const h=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.52,8),hub);h.rotation.z=Math.PI/2;wg.add(h);
    g.add(wg);wheels.push(wg);
  });
  const sh=new THREE.Mesh(new THREE.CircleGeometry(1.9,20).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.28,depthWrite:false}));sh.position.y=.09;sh.scale.set(.75,1,1);g.add(sh);
  g.scale.setScalar(KSCALE);
  return {g,body,wheels};
}
function makeKart(k){const m=buildKartModel(k);scene.add(m.g);return m;}
/* 차고·카트 선택용 미리보기 이미지 (한 번만 그려서 저장) */
const THUMBS={};let thumbR=null,thumbS=null,thumbC=null;
function kartThumb(k){
  if(k.id in THUMBS)return THUMBS[k.id];
  try{
    if(!thumbR){
      thumbR=new THREE.WebGLRenderer({canvas:document.createElement('canvas'),antialias:true,alpha:true,preserveDrawingBuffer:true});
      thumbR.setPixelRatio(1);thumbR.setSize(360,200,false);thumbR.setClearColor(0x000000,0);
      thumbS=new THREE.Scene();thumbS.add(new THREE.HemisphereLight(0xffffff,0x6a7a8a,.85));
      const d=new THREE.DirectionalLight(0xffffff,.8);d.position.set(5,9,7);thumbS.add(d);
      thumbC=new THREE.PerspectiveCamera(28,360/200,.1,100);thumbC.position.set(5.6,3.3,6.4);thumbC.lookAt(0,.95,-.1);
    }
    const m=buildKartModel(k);thumbS.add(m.g);thumbR.render(thumbS,thumbC);
    THUMBS[k.id]=thumbR.domElement.toDataURL('image/png');
    thumbS.remove(m.g);m.g.traverse(o=>{if(o.geometry)o.geometry.dispose();});
  }catch(e){THUMBS[k.id]=null;}
  return THUMBS[k.id];
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
const GRID_SIZE=8;
const AI_NAMES=['번개','소나기','회오리','불꽃','바람','파도','별똥','은하'];
const AI_KARTS=['red','blue','yellow','mint','fin','blaze','aurora','phantom'];
let racers=[],player=null,state='menu',raceT=0,countT=0,camH=0,lastT=0,msgTimer=0,resultShown=false,lastBeep=4;
let mode='solo';
let race={laps:2,diff:1};
let refProg=0,sendT=0,aiSendT=0;
const keys={};
const touch={l:false,r:false,drift:false,brake:false,boost:false};
let driftPress=false;
const isTouch=window.matchMedia&&window.matchMedia('(pointer: coarse)').matches;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};

function nearestIdx(x,z,hint){
  let best=-1,bd=1e18;
  if(hint==null){for(let i=0;i<N;i++){const d=(S[i].x-x)**2+(S[i].z-z)**2;if(d<bd){bd=d;best=i;}}return best;}
  for(let o=-30;o<=30;o++){const i=((hint+o)%N+N)%N;const d=(S[i].x-x)**2+(S[i].z-z)**2;if(d<bd){bd=d;best=i;}}
  return best;
}
function gridPos(slot){
  const row=Math.floor(slot/4),col=slot%4;
  const gi=(N-12-row*11+N)%N,s=S[gi],lat=[-1.5,-.5,.5,1.5][col]*LANE;
  return {x:s.x+s.nx*lat,z:s.z+s.nz*lat,h:ang(gi),idx:gi};
}
function makeNameTag(name){
  const tex=canvasTex(256,64,(c,w,h)=>{
    c.fillStyle='rgba(10,16,38,.78)';const r=26;c.beginPath();c.moveTo(r,4);c.lineTo(w-r,4);c.arc(w-r,h/2,r,-Math.PI/2,Math.PI/2);c.lineTo(r,h-4);c.arc(r,h/2,r,Math.PI/2,Math.PI*1.5);c.fill();
    c.fillStyle='#ffffff';c.font='bold 30px "Noto Sans KR", sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(name,w/2,h/2+1);
  });
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));
  sp.scale.set(7,1.75,1);sp.position.y=4.6;return sp;
}
function newRacer(o){
  const k=kartById(o.kart),m=makeKart(k);
  if(o.kind==='remote')m.g.add(makeNameTag(o.name));
  const g=gridPos(o.slot);
  const st=o.kind==='me'?k.st:{spd:1,acc:1,hnd:1,chg:1,ext:1};
  return {id:o.id,k,name:o.name,kind:o.kind,isPlayer:o.kind==='me',local:o.kind!=='remote',mesh:m,
    x:g.x,z:g.z,h:g.h,vx:0,vz:0,idx:g.idx,prog:g.idx-N,
    drifting:false,driftDir:1,driftT:0,gauge:0,boosts:0,boostT:0,lapStart:0,lapTimes:[],finished:false,finishT:0,
    maxMul:st.spd,acc:st.acc,hnd:st.hnd,chg:st.chg,ext:st.ext||1,exitT:0,exitMax:1,exitConv:0,
    base:DIFF[race.diff].m*(.95+Math.random()*.06),lane:(Math.random()-.5)*HALF*1.2,seed:Math.random()*100,
    aiBoostCD:2+Math.random()*3,spin:0,wrongT:0,lap:0,smokeT:0,tx:g.x,tz:g.z,th:g.h,recvT:performance.now(),fwd:0,offroad:false};
}
function clearRace(){racers.forEach(r=>scene.remove(r.mesh.g));racers=[];player=null;}
function myId(){return mode==='online'?net.me:'me';}
function isHost(){return mode==='solo'||net.host===net.me;}
function buildRace(grid,laps,diff){
  audioInit();if(AC&&AC.state==='suspended')AC.resume();
  clearRace();resultShown=false;race={laps,diff};
  racers=grid.map(g=>{
    const kind=g.id===myId()?'me':(g.ai?'ai':'remote');
    const r=newRacer({id:g.id,kart:g.id===myId()?save.sel:g.kart,name:g.id===myId()?'나':g.name,kind,slot:g.slot});
    if(kind==='ai')r.local=isHost();
    return r;
  });
  player=racers.find(r=>r.kind==='me');
  camH=player.h;raceT=0;countT=3.6;state='countdown';lastBeep=4;sendT=0;aiSendT=0;
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on'));
  $('hud').classList.add('on');$('touch').classList.toggle('on',isTouch);
  $('lap').innerHTML=`LAP 1<small>/ ${laps}</small>`;
  updateHud(0);
}
function startSolo(){
  mode='solo';
  const slots=shuffle([0,1,2,3,4,5,6,7]),names=shuffle(AI_NAMES),karts=shuffle(AI_KARTS);
  const grid=[{id:'me',kart:save.sel,name:'나',ai:false,slot:slots[0]}];
  for(let i=1;i<GRID_SIZE;i++)grid.push({id:'ai'+i,kart:karts[i-1],name:names[i-1],ai:true,slot:slots[i]});
  buildRace(grid,opt.laps,opt.diff);
}
function toMenu(){
  if(mode==='online'){send({t:'leave'});mode='solo';}
  state='menu';clearRace();
  $('hud').classList.remove('on');$('touch').classList.remove('on');
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on'));$('menu').classList.add('on');
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
    const a=racers[i],b=racers[j];if(!a.local&&!b.local)continue;
    const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),m=KR*2;
    if(d>0&&d<m){
      const nx=dx/d,nz=dz/d,p=m-d;
      if(a.local&&b.local){a.x-=nx*p/2;a.z-=nz*p/2;b.x+=nx*p/2;b.z+=nz*p/2;
        const va=a.vx*nx+a.vz*nz,vb=b.vx*nx+b.vz*nz,dv=(va-vb)*.8;if(dv>0){a.vx-=nx*dv;a.vz-=nz*dv;b.vx+=nx*dv;b.vz+=nz*dv;}}
      else{const L=a.local?a:b,sg=a.local?-1:1;L.x+=nx*p*sg;L.z+=nz*p*sg;const vn=(L.vx*nx+L.vz*nz)*-sg;if(vn>0){L.vx+=nx*vn*sg*1.6;L.vz+=nz*vn*sg*1.6;}}
    }
  }
}
function aiInput(r,dt){
  const look=Math.floor((24+Math.max(0,r.fwd||0)*.85)/SP);
  const ti=(r.idx+look)%N,t=S[ti];
  const lane=r.lane+Math.sin(raceT*.35+r.seed)*3.2;
  const tx=t.x+t.nx*lane,tz=t.z+t.nz*lane;
  const want=Math.atan2(tx-r.x,tz-r.z);let diff=want-r.h;while(diff>Math.PI)diff-=Math.PI*2;while(diff<-Math.PI)diff+=Math.PI*2;
  const steerRaw=Math.max(-1,Math.min(1,-diff*3));
  const a1=ang(r.idx),a2=ang(r.idx+Math.floor(100/SP)),cd=Math.abs(((a2-a1+Math.PI*3)%(Math.PI*2))-Math.PI);
  const curv=Math.min(1,cd/1.1);
  const gap=(refProg-r.prog)/(N*.18);
  r.maxMul=r.base*(1-.3*curv)*(1+Math.max(-.12,Math.min(.14,gap*.12)));
  r.aiBoostCD-=dt;
  if(r.aiBoostCD<=0){r.aiBoostCD=3+Math.random()*4;if(curv<.2&&Math.random()<.45)r.boostT=Math.max(r.boostT,1.0);}
  return {throttle:1,steer:Math.abs(steerRaw)<.08?0:steerRaw,driftPress:false};
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
  r.spin+=(r.fwd||0)*dt*2.2;r.mesh.wheels.forEach(w=>{w.children[0].rotation.x=r.spin;w.children[1].rotation.x=r.spin;});
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
  racers.forEach(r=>{if(r.isPlayer)return;const [x,y]=mp(r.x,r.z);const human=r.kind==='remote';
    mctx.fillStyle=hex(r.k.body);mctx.beginPath();mctx.arc(x,y,human?9:6.5,0,7);mctx.fill();mctx.strokeStyle=human?'#ffffff':'rgba(255,255,255,.6)';mctx.lineWidth=human?3:1.5;mctx.stroke();});
  if(player){const [x,y]=mp(player.x,player.z);mctx.save();mctx.translate(x,y);mctx.rotate(-player.h);mctx.fillStyle='#ffc531';mctx.strokeStyle='#111';mctx.lineWidth=2.5;mctx.beginPath();mctx.moveTo(0,-13);mctx.lineTo(10,10);mctx.lineTo(0,5);mctx.lineTo(-10,10);mctx.closePath();mctx.fill();mctx.stroke();mctx.restore();}
}
function fmt(t){const m=Math.floor(t/60),s=t-m*60;return String(m).padStart(2,'0')+':'+s.toFixed(2).padStart(5,'0');}
function standings(){
  return racers.slice().sort((a,b)=>{if(a.finished&&b.finished)return a.finishT-b.finishT;if(a.finished)return -1;if(b.finished)return 1;return b.prog-a.prog;});
}
let hudT=0;
function updateHud(dt){
  hudT-=dt;if(!player)return;
  const st=standings(),pos=st.indexOf(player)+1;
  $('rank').innerHTML=`<b>${pos}</b><span>/ ${racers.length}위</span>`;
  $('speed').querySelector('b').textContent=Math.round(Math.max(0,player.fwd||0)*3.6);
  $('gauge').firstElementChild.style.width=Math.min(100,player.gauge)+'%';
  $('s0').classList.toggle('full',player.boosts>=1);$('s1').classList.toggle('full',player.boosts>=2);
  $('flash').classList.toggle('on',player.boostT>0);
  if(hudT<=0){
    hudT=.1;
    $('time').textContent=fmt(raceT);
    $('board').innerHTML=st.map((r,i)=>`<div class="${r.isPlayer?'me':''}">${i+1}. ${esc(r.name)}${r.kind==='ai'?' <small>AI</small>':''}${r.finished?' 🏁':''}</div>`).join('');
    drawMini();
  }
}

/* ---------- loop ---------- */
function finishLocal(r){
  r.finished=true;r.finishT=raceT;
  if(r.isPlayer){showMsg('FINISH!',2);beep(990,.4,.1);state='finish';if(mode==='online')send({t:'finish',time:raceT});setTimeout(()=>showResult(false),2200);}
  else if(mode==='online'&&isHost())send({t:'aifin',id:r.id,time:raceT});
}
function stepRacer(r,dt,now){
  if(!r.local){
    const age=Math.min(.25,(now-r.recvT)/1000);
    const ax=r.tx+r.vx*age,az=r.tz+r.vz*age,k=Math.min(1,dt*12);
    r.x+=(ax-r.x)*k;r.z+=(az-r.z)*k;r.h=lerpAng(r.h,r.th,k);
    r.fwd=r.vx*Math.sin(r.h)+r.vz*Math.cos(r.h);
    r.idx=nearestIdx(r.x,r.z,r.idx);const s=S[r.idx];r.offroad=Math.abs((r.x-s.x)*s.nx+(r.z-s.z)*s.nz)>HALF+1.6;
    if(r.boostT>0)r.boostT-=dt;
    return;
  }
  let inp;
  if(r.finished){
    if(r.isPlayer)inp={throttle:0,steer:0,driftPress:false};
    else{inp=aiInput(r,dt);r.maxMul*=.6;}
  }else inp=r.isPlayer?playerInput():aiInput(r,dt);
  physics(r,dt,inp);constrain(r);
  const lap=Math.floor(r.prog/N);
  if(lap>r.lap&&lap>=1&&!r.finished){r.lapTimes.push(raceT-r.lapStart);r.lapStart=raceT;
    if(r.isPlayer&&lap<race.laps){showMsg(lap===race.laps-1?'마지막 바퀴!':`LAP ${lap+1}`,1.2);beep(660,.15,.07);$('lap').innerHTML=`LAP ${lap+1}<small>/ ${race.laps}</small>`;}}
  r.lap=Math.max(r.lap,lap);
  if(!r.finished&&r.prog>=race.laps*N)finishLocal(r);
  if(r.isPlayer){
    const tAng=ang(r.idx);const dd=Math.abs(((r.h-tAng+Math.PI*3)%(Math.PI*2))-Math.PI);
    if(dd>2.1&&Math.abs(r.fwd)>6){r.wrongT+=dt;if(r.wrongT>.8&&msgTimer<=0)showMsg('역주행!',.6);}else r.wrongT=0;
  }
}
const r2=v=>Math.round(v*100)/100;
function packState(r){return [r2(r.x),r2(r.z),r2(r.h),r2(r.vx),r2(r.vz),Math.round(r.prog),(r.boostT>0?1:0)|(r.drifting?2:0)|(r.driftDir<0?4:0)];}
function applyState(r,d){
  if(!r||r.local||!Array.isArray(d))return;
  r.tx=+d[0];r.tz=+d[1];r.th=+d[2];r.vx=+d[3];r.vz=+d[4];r.prog=+d[5];
  const f=d[6]|0;r.boostT=f&1?.15:0;r.drifting=!!(f&2);r.driftDir=f&4?-1:1;r.recvT=performance.now();
}
function netTick(dt){
  if(mode!=='online'||!player)return;
  sendT-=dt;aiSendT-=dt;
  if(sendT<=0){sendT=.05;send({t:'s',d:packState(player)});}
  if(isHost()&&aiSendT<=0){aiSendT=.08;const list=racers.filter(r=>r.kind==='ai'&&r.local).map(r=>[r.id].concat(packState(r)));if(list.length)send({t:'a',d:list});}
}
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(.05,(now-(lastT||now))/1000);lastT=now;
  if(state==='countdown'||state==='race'||state==='finish'){
    if(state==='countdown'){
      countT-=dt;const c=Math.ceil(countT-.6);
      if(c!==lastBeep&&c>=0){lastBeep=c;if(c>0){$('count').textContent=c;$('count').classList.remove('is-go');beep(440,.18,.08);}else{$('count').textContent='GO!';$('count').classList.add('is-go');beep(880,.35,.1);}}
      if(countT<=.6){state='race';raceT=0;racers.forEach(r=>r.lapStart=0);}
      racers.forEach(r=>{if(!r.local)stepRacer(r,dt,now);});
    }else{
      raceT+=dt;
      if(countT>-1){countT-=dt;if(countT<-.4){$('count').textContent='';$('count').classList.remove('is-go');}}
      const humans=racers.filter(r=>r.kind!=='ai');refProg=humans.reduce((a,r)=>a+r.prog,0)/Math.max(1,humans.length);
      racers.forEach(r=>stepRacer(r,dt,now));
      collide();
      netTick(dt);
    }
    racers.forEach(r=>syncMesh(r,dt));
    updateCamera(dt);updateHud(dt);
    if(msgTimer>0){msgTimer-=dt;if(msgTimer<=0)$('msg').classList.remove('on');}
    if(engGain&&player){const sp=Math.max(0,player.fwd||0);engGain.gain.value=muted?0:.035+Math.min(.03,sp/1500);eng.frequency.value=55+sp*2.6+(player.boostT>0?40:0);}
  }else{
    const t=now/1000*.06;const s=S[Math.floor(t*N)%N];
    camera.position.set(s.x+Math.cos(t*3)*70,46,s.z+Math.sin(t*3)*70);camera.lookAt(s.x,0,s.z);
  }
  updateParticles(dt);
  renderer.render(scene,camera);
}

/* ---------- result ---------- */
let lastEarn=0;
function renderResultTable(){
  if(!resultShown)return;
  const st=standings();
  $('resTable').innerHTML=st.map((r,i)=>`<tr class="${r.isPlayer?'me':''}"><td>${i+1}위</td><td>${esc(r.name)}${r.kind==='ai'?' <small class="ai">AI</small>':''}</td><td>${r.finished?fmt(r.finishT):'주행 중'}</td></tr>`).join('');
}
function showResult(dnf){
  if(resultShown||!player)return;resultShown=true;
  const st=standings(),pos=st.indexOf(player)+1;
  $('resRank').textContent=dnf?'미완주':pos+'위';
  $('resLabel').textContent=dnf?'레이스가 끝났어':pos===1?'우승이야!':pos<=3?'시상대 입성!':'다음엔 드리프트로 따라잡자';
  let base=RANK_P[pos-1]*race.laps*DIFF[race.diff].bonus;if(dnf)base*=.5;
  const earned=Math.round(base/5)*5;lastEarn=earned;
  save.points+=earned;saveGame();
  if(!dnf){
    const best=load('drift-rush-best')||{},key=race.laps+'';let rec='';
    if(!best[key]||player.finishT<best[key]){best[key]=player.finishT;store('drift-rush-best',best);rec=' · 새 최고 기록!';}
    const bestLap=player.lapTimes.length?Math.min(...player.lapTimes):player.finishT;
    $('resBest').textContent=`내 기록 ${fmt(player.finishT)} · 베스트 랩 ${fmt(bestLap)}${rec}`;
  }else $('resBest').textContent='제한 시간 안에 들어오지 못했어. 받은 포인트는 절반이야.';
  $('resEarn').innerHTML=`+${earned.toLocaleString()} P<small>보유 ${save.points.toLocaleString()} P</small>`;
  const online=mode==='online';
  $('again').textContent=online?'대기실로':'다시 달리기';
  $('toMenu').textContent=online?'방 나가기':'처음 화면';
  renderResultTable();
  $('result').classList.add('on');$('touch').classList.remove('on');
}
function renderBest(){
  const best=load('drift-rush-best')||{};
  const parts=Object.keys(best).sort().map(k=>`${k}바퀴 ${fmt(best[k])}`);
  $('best').textContent=parts.length?'최고 기록 · '+parts.join(' · '):'아직 기록이 없어. 첫 레이스를 달려봐!';
}

/* ---------- network ---------- */
const net={ws:null,me:null,room:null,host:null,players:[],roomState:'lobby',laps:2,diff:1,connected:false};
function wsUrl(){
  if(window.DRIFT_SERVER)return window.DRIFT_SERVER;
  return (location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws';
}
function onlinePossible(){return location.protocol==='http:'||location.protocol==='https:'||!!window.DRIFT_SERVER;}
function setStatus(t){$('netStatus').textContent=t||'';}
function connect(then){
  if(net.ws&&net.ws.readyState===1){then();return;}
  if(!onlinePossible()){setStatus('온라인 모드는 Render에 올린 서버 주소로 접속해야 쓸 수 있어.');return;}
  setStatus('서버에 연결하는 중이야. 서버가 잠들어 있었다면 1분쯤 걸릴 수 있어…');
  let ws;try{ws=new WebSocket(wsUrl());}catch(e){setStatus('서버에 연결하지 못했어.');return;}
  net.ws=ws;
  ws.onopen=()=>{net.connected=true;setStatus('');then();};
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch(x){return;}onNet(m);};
  ws.onerror=()=>{setStatus('서버에 연결하지 못했어. 잠시 뒤에 다시 해봐.');};
  ws.onclose=()=>{
    const was=net.connected;net.connected=false;net.ws=null;
    if(mode==='online'&&was){
      if(state==='menu'){mode='solo';toMenu();setStatus('서버 연결이 끊겼어.');}
      else{showMsg('서버 연결이 끊겼어',2);racers.forEach(r=>{if(r.kind!=='me'){r.local=true;r.kind='ai';}});mode='solo';}
    }
  };
}
function send(o){if(net.ws&&net.ws.readyState===1)net.ws.send(JSON.stringify(o));}
setInterval(()=>{if(net.connected)send({t:'ping'});},20000);
function nick(){const v=($('nick').value||'').trim().slice(0,10);if(v)store('drift-rush-nick',v);return v||'플레이어';}
function onNet(m){
  switch(m.t){
    case 'joined':net.me=m.id;net.room=m.room;mode='online';showLobby();break;
    case 'err':setStatus(m.msg);break;
    case 'lobby':
      net.room=m.room;net.host=m.host;net.players=m.players||[];net.roomState=m.state;net.laps=m.laps;net.diff=m.diff;
      if(state==='menu'&&mode==='online')renderLobby();
      break;
    case 'start':
      net.host=m.host;
      if(m.grid.some(g=>g.id===net.me))buildRace(m.grid,m.laps,m.diff);
      break;
    case 's':{const r=racers.find(x=>x.id===m.id);applyState(r,m.d);break;}
    case 'a':(m.d||[]).forEach(e=>{const r=racers.find(x=>x.id===e[0]);applyState(r,e.slice(1));});break;
    case 'fin':{const r=racers.find(x=>x.id===m.id);if(r&&!r.local){r.finished=true;r.finishT=+m.time;}renderResultTable();break;}
    case 'left':{
      const r=racers.find(x=>x.id===m.id);
      if(r&&m.toAI&&r.kind==='remote'){r.kind='ai';r.name=r.name+' (AI)';r.local=isHost();r.base=DIFF[race.diff].m;}
      break;}
    case 'host':
      net.host=m.id;
      if(net.host===net.me&&state!=='menu')racers.forEach(r=>{if(r.kind==='ai'&&!r.local){r.local=true;r.x=r.tx;r.z=r.tz;r.h=r.th;}});
      if(state==='menu')renderLobby();
      break;
    case 'raceEnd':
      if(state!=='menu'&&player&&!resultShown)showResult(!player.finished);
      $('again').disabled=false;
      break;
  }
}
function showLobby(){
  state='menu';clearRace();
  $('hud').classList.remove('on');$('touch').classList.remove('on');
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on'));$('lobby').classList.add('on');
  if(engGain)engGain.gain.value=0;renderLobby();
}
function renderLobby(){
  if(!$('lobby').classList.contains('on'))return;
  $('roomCode').textContent=net.room||'----';
  const host=net.host===net.me;
  const list=$('slots');list.innerHTML='';
  for(let i=0;i<GRID_SIZE;i++){
    const p=net.players[i];const d=document.createElement('div');d.className='slotrow'+(p?'':' empty')+(p&&p.id===net.me?' me':'');
    if(p){const k=kartById(p.kart);d.innerHTML=`<span class="dot" style="background:${hex(k.body)}"></span><b>${esc(p.name)}</b>${p.id===net.host?'<em>방장</em>':''}<small>${esc(k.name)}</small>`;}
    else d.innerHTML=`<span class="dot"></span><b>컴퓨터</b><small>빈자리는 AI가 달려</small>`;
    list.appendChild(d);
  }
  $('lobbyCount').textContent=`${net.players.length} / ${GRID_SIZE}명`;
  const kc=$('lobbyKarts');kc.innerHTML='';
  KARTS.filter(k=>save.owned.includes(k.id)).forEach(k=>{const b=document.createElement('button');b.type='button';b.className='kopt';b.setAttribute('aria-pressed',save.sel===k.id);
    b.innerHTML=swatch(k)+k.name;b.onclick=()=>{save.sel=k.id;saveGame();send({t:'kart',kart:k.id});renderLobby();};kc.appendChild(b);});
  const lc=$('lobbyLaps');lc.innerHTML='';
  [1,2,3].forEach(n=>{const b=document.createElement('button');b.type='button';b.className='seg';b.textContent=n+'바퀴';b.setAttribute('aria-pressed',net.laps===n);b.disabled=!host;b.onclick=()=>send({t:'settings',laps:n,diff:net.diff});lc.appendChild(b);});
  const dc=$('lobbyDiff');dc.innerHTML='';
  DIFF.forEach((dd,i)=>{const b=document.createElement('button');b.type='button';b.className='seg';b.textContent=dd.n;b.setAttribute('aria-pressed',net.diff===i);b.disabled=!host;b.onclick=()=>send({t:'settings',laps:net.laps,diff:i});dc.appendChild(b);});
  const racing=net.roomState==='racing';
  $('lobbyStart').hidden=!host;$('lobbyStart').disabled=racing;
  $('lobbyWait').textContent=racing?'지금 레이스가 진행 중이야. 끝나면 다음 판부터 같이 달릴 수 있어.':(host?'친구들이 다 모이면 시작을 눌러. 빈자리는 컴퓨터가 채워.':'방장이 시작하길 기다리는 중이야.');
}

/* ---------- menu UI ---------- */
function statBars(st){
  const rows=[['최고 속도',st.spd],['가속',st.acc],['핸들링',st.hnd],['드리프트 충전',st.chg],['드리프트 탈출',st.ext]];
  const ep=exitParams(st.ext);
  return rows.map(([n,v])=>`<div class="stat"><span>${n}</span><div class="bar"><i style="width:${Math.round(40+(v-1)/.3*60)}%"></i></div></div>`).join('')+`<div class="stat-note">탈출 ${ep.time.toFixed(2)}초 · 미끄럼 속도의 ${Math.round(ep.conv*100)}%를 가속으로 전환</div>`;
}
function swatch(k){const t=kartThumb(k);return `<div class="sw${t?' sw3d':''}" style="--kc:${hex(k.body)};--kt:${hex(k.trim)}">${t?`<img src="${t}" alt="">`:''}</div>`;}
function buildMenu(){
  $('wallet').innerHTML=`<small>보유 포인트</small>${save.points.toLocaleString()} P`;
  const kc=$('karts');kc.innerHTML='';
  KARTS.filter(k=>save.owned.includes(k.id)).forEach(k=>{const b=document.createElement('button');b.type='button';b.className='kopt';b.setAttribute('aria-pressed',save.sel===k.id);
    b.innerHTML=swatch(k)+k.name;b.onclick=()=>{save.sel=k.id;saveGame();buildMenu();};kc.appendChild(b);});
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
  $('nick').value=load('drift-rush-nick')||'';
  $('onlineNote').hidden=onlinePossible();
  renderBest();
}
function setTab(name){
  ['Race','Online','Garage'].forEach(n=>{$('tab'+n).hidden=n!==name;$('tab'+n+'Btn').setAttribute('aria-selected',n===name);});
}
$('tabRaceBtn').onclick=()=>setTab('Race');
$('tabOnlineBtn').onclick=()=>setTab('Online');
$('tabGarageBtn').onclick=()=>setTab('Garage');
$('start').onclick=startSolo;
$('create').onclick=()=>connect(()=>send({t:'create',name:nick(),kart:save.sel}));
$('join').onclick=()=>{const c=($('code').value||'').trim().toUpperCase();if(c.length!==4){setStatus('방 코드 4자리를 입력해줘.');return;}connect(()=>send({t:'join',room:c,name:nick(),kart:save.sel}));};
$('code').addEventListener('keydown',e=>{if(e.key==='Enter')$('join').click();});
$('lobbyStart').onclick=()=>send({t:'start'});
$('lobbyLeave').onclick=()=>toMenu();
$('copyCode').onclick=()=>{const t=location.origin+location.pathname+'?room='+(net.room||'');const done=()=>{$('copyCode').textContent='복사했어!';setTimeout(()=>$('copyCode').textContent='초대 링크 복사',1200);};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(done,()=>{});};
$('again').onclick=()=>{if(mode==='online')showLobby();else startSolo();};
$('toMenu').onclick=toMenu;
$('quit').onclick=toMenu;

/* ---------- input ---------- */
const GAME_KEYS=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyW','KeyA','KeyS','KeyD','ControlLeft','ControlRight'];
window.addEventListener('keydown',e=>{
  if(state==='menu'||$('result').classList.contains('on'))return;
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
{const q=new URLSearchParams(location.search).get('room');if(q){setTab('Online');$('code').value=q.toUpperCase().slice(0,4);}}
requestAnimationFrame(frame);
})();
