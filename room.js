import * as THREE from './three.module.js';
import { channels } from './content.js';
import { papers } from './papers.js';

const clamp=THREE.MathUtils.clamp;
let seed=24571;
function random(){seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;}
function texture(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function roundedGeometry(w,h,d,r=.08){const s=new THREE.Shape();const x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelThickness:r*.3,bevelSize:r*.3,bevelSegments:2,steps:1,curveSegments:6});g.translate(0,0,-d/2);return g;}

export async function createRoom(container,{onChannel,onHover,onLamp,onSound,onZoom,onPaper,reducedMotion=false}){
  const skyline=await new THREE.TextureLoader().loadAsync(new URL('./manhattan-snow.jpg',import.meta.url).href).catch(error=>{console.warn('Snowy skyline unavailable; using procedural skyline.',error);return null;});
  if(skyline){skyline.colorSpace=THREE.SRGBColorSpace;skyline.anisotropy=4;}
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;container.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#242923');scene.fog=new THREE.FogExp2('#30372f',.018);
  const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,70);
  const root=new THREE.Group();scene.add(root);
  const targets=[];const tapes=[];let activeChannel=null,zoomed=false,lampOn=true,disposed=false,frame=0;
  const pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster();let hover=null;
  const mat=(color,roughness=.75,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const charcoal=mat('#252823'),black=mat('#141814'),rubber=mat('#0d1210'),brass=mat('#a78b52',.37,.68),cream=mat('#cdc6aa'),paper=mat('#d9cda9'),walnut=mat('#59412e');
  const woodMap=texture(1024,512,(ctx,w,h)=>{ctx.fillStyle='#65472d';ctx.fillRect(0,0,w,h);for(let i=0;i<3000;i++){const y=random()*h;ctx.strokeStyle=`rgba(${random()>.5?'215,165,93':'23,16,9'},${random()*.18})`;ctx.lineWidth=random()*2;ctx.beginPath();ctx.moveTo(0,y);for(let x=0;x<=w;x+=40)ctx.lineTo(x,y+Math.sin(x*.007+i)*random()*4);ctx.stroke();}for(let i=1;i<6;i++){ctx.fillStyle='#21180d50';ctx.fillRect(0,i*h/6,w,2);}});
  woodMap.wrapS=woodMap.wrapT=THREE.RepeatWrapping;
  const wood=new THREE.MeshStandardMaterial({map:woodMap,roughness:.48,color:'#c1a477'});
  function addMesh(g,m,x=0,y=0,z=0,parent=root,shadow=false){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=shadow;o.receiveShadow=true;parent.add(o);return o;}
  function box(w,h,d,m,x,y,z,parent=root,shadow=false){return addMesh(new THREE.BoxGeometry(w,h,d),m,x,y,z,parent,shadow);}
  function rounded(w,h,d,m,x,y,z,parent=root,r=.07,shadow=true){return addMesh(roundedGeometry(w,h,d,r),m,x,y,z,parent,shadow);}
  function cyl(rt,rb,h,m,x,y,z,parent=root,segments=32){return addMesh(new THREE.CylinderGeometry(rt,rb,h,segments),m,x,y,z,parent,true);}
  function sphere(r,m,x,y,z,parent=root){return addMesh(new THREE.SphereGeometry(r,20,12),m,x,y,z,parent);}
  function rod(a,b,r,m,parent=root){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),o=cyl(r,r,av.distanceTo(bv),m,...av.clone().add(bv).multiplyScalar(.5).toArray(),parent,12);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());return o;}
  function plane(w,h,m,x,y,z,parent=root){return addMesh(new THREE.PlaneGeometry(w,h),m,x,y,z,parent);}
  function textPlane(text,w,h,x,y,z,{color='#d2c3a0',background=null,size=42,font='monospace',parent=root}={}){const t=texture(512,Math.max(64,Math.round(512*h/w)),(ctx,cw,ch)=>{if(background){ctx.fillStyle=background;ctx.fillRect(0,0,cw,ch);}ctx.fillStyle=color;ctx.font=`bold ${size}px ${font}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,cw/2,ch/2,cw-24);});return plane(w,h,new THREE.MeshBasicMaterial({map:t,transparent:!background,depthWrite:false}),x,y,z,parent);}
  function hotspot(mesh,label,action){mesh.userData={label,action};targets.push(mesh);return mesh;}
  const shadowTexture=texture(128,128,(ctx,w,h)=>{const gr=ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);gr.addColorStop(0,'#000b');gr.addColorStop(.45,'#0006');gr.addColorStop(1,'#0000');ctx.fillStyle=gr;ctx.fillRect(0,0,w,h);});
  function contactShadow(x,z,w,d){const p=plane(w,d,new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}),x,1.197,z);p.rotation.x=-Math.PI/2;}

  // The window and the city are separate layers, so the room retains real depth.
  box(32,18,.25,mat('#706d57'),0,8,-3.1);
  box(.3,18,20,mat('#696754'),-16,8,6.8);
  const cityTexture=texture(2048,1024,(ctx,w,h)=>{
    const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#15232a');sky.addColorStop(.55,'#374947');sky.addColorStop(1,'#72725d');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
    for(let layer=0;layer<3;layer++){for(let x=0;x<w;){const bw=30+random()*100,bh=80+random()*(210+layer*110),y=h-bh-70+layer*25;ctx.fillStyle=['#35413f','#293332','#1c292b'][layer];ctx.fillRect(x,y,bw,bh+100);if(random()>.5){ctx.fillRect(x+bw*.4,y-20,3,25);}for(let wy=y+12;wy<h-90;wy+=18)for(let wx=x+8;wx<x+bw-8;wx+=12){if(random()>.49){ctx.fillStyle=random()>.2?'#a39560':'#768d82';ctx.globalAlpha=.15+random()*.6;ctx.fillRect(wx,wy,4+random()*3,7);ctx.globalAlpha=1;}}x+=bw+random()*13;}}
    for(let i=0;i<65;i++){const x=random()*w,y=h*.65+random()*h*.32,r=10+random()*24;const glow=ctx.createRadialGradient(x,y,0,x,y,r);glow.addColorStop(0,random()>.3?'#ffdf9e99':'#b1e0d899');glow.addColorStop(1,'#0000');ctx.fillStyle=glow;ctx.fillRect(x-r,y-r,r*2,r*2);}
    ctx.fillStyle='#ded9a6';ctx.font='24px monospace';ctx.fillText('OPEN LATE',1530,745);ctx.fillStyle='#d4a174';ctx.fillRect(1320,900,130,2);
  });
  plane(11,5.8,new THREE.MeshBasicMaterial({map:skyline||cityTexture,color:skyline?'#d7e2f1':'#9dada1',toneMapped:false}),0,3.7,-2.93);
  const windowWood=mat('#62533a',.52);
  box(11.4,.15,.45,windowWood,0,6.65,-2.7);
  box(11.5,.22,.62,wood,0,1.52,-2.64);
  for(const x of[-5.5,-1.9,1.9,5.5]){box(.16,5.25,.35,windowWood,x,4.03,-2.68);box(.03,5.1,.03,brass,x+.06,4.03,-2.47);}
  box(11.3,.12,.3,windowWood,0,4.8,-2.65);
  for(const x of[-3.7,0,3.7]){const p=plane(.58,4.9,new THREE.MeshBasicMaterial({color:'#a9b5a1',transparent:true,opacity:.035,depthWrite:false}),x,4,-2.42);p.rotation.z=-.06;}
  for(const x of[-1.68,2.12]){box(.04,.28,.06,brass,x,2.9,-2.42);rod([x,2.9,-2.39],[x+.12,2.9,-2.35],.025,brass);}
  // Curtain folds catch the amber light.
  const curtainMat=mat('#7a7862',.98);
  for(let i=0;i<17;i++){const o=cyl(.13,.15,6.4,curtainMat,5.22+i*.15,3.95,-2.22+Math.sin(i*2)*.12,root,12);o.scale.z=.65;}
  rod([4.95,7.25,-2.2],[8,7.25,-2.2],.045,brass);
  // Snow falls outside the glass, with slow lateral drift and soft round flakes.
  const snowCount=420,snowPositions=new Float32Array(snowCount*3),snowVel=[],snowPhase=[];
  for(let i=0;i<snowCount;i++){snowPositions.set([random()*10.6-5.3,random()*4.9+1.6,-2.6+random()*.13],i*3);snowVel.push(.11+random()*.2);snowPhase.push(random()*Math.PI*2);}
  const snowSprite=texture(32,32,(ctx,w,h)=>{const gradient=ctx.createRadialGradient(16,16,1,16,16,15);gradient.addColorStop(0,'#ffffff');gradient.addColorStop(.35,'#ffffffc0');gradient.addColorStop(1,'#ffffff00');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);});
  const snowGeometry=new THREE.BufferGeometry();snowGeometry.setAttribute('position',new THREE.BufferAttribute(snowPositions,3));
  const snow=new THREE.Points(snowGeometry,new THREE.PointsMaterial({color:'#e4eeff',map:snowSprite,size:.045,transparent:true,opacity:.7,depthWrite:false,alphaTest:.015}));root.add(snow);


  // Complete the room volume for constrained camera orbits.
  box(.3,18,20,mat('#696754'),16,8,6.8);
  box(32,.18,20,wood,0,-.3,6.8);
  box(32,.18,20,mat('#797765'),0,17,6.8);
  box(31.8,.22,.12,walnut,0,-.12,-2.91);
  for(const x of[-15.8,15.8])box(.12,.22,20,walnut,x,-.12,6.8);
  const radiator=mat('#989783');
  for(let i=0;i<23;i++)rounded(.12,1.05,.22,radiator,-2.2+i*.2,.4,-2.72,root,.035,false);
  rod([-2.35,.86,-2.72],[2.4,.86,-2.72],.055,radiator);
  rod([-2.35,-.04,-2.72],[2.4,-.04,-2.72],.055,radiator);
  // Desk, its bevelled edge, and a soft leather writing mat.
  rounded(11.4,.2,4.55,wood,0,1.08,.25,root,.06);
  box(11.2,.13,.08,walnut,0,.94,2.46);
  box(.22,1.2,3.8,walnut,-4.8,.35,.1);box(.22,1.2,3.8,walnut,4.8,.35,.1);
  const deskMat=rounded(4.8,.025,1.6,mat('#383d31'),-.2,1.205,1.15,root,.09,false);
  for(let i=0;i<3;i++)contactShadow(-.2,0,4.7,2.7);

  // CRT production monitor. The display is a live canvas texture.
  const tv=new THREE.Group();tv.position.set(-.25,0,-.05);root.add(tv);
  rounded(3.02,2.42,1.65,charcoal,0,2.77,0,tv,.13);
  rounded(2.67,1.94,.12,black,-.02,2.98,.88,tv,.14);
  rounded(2.41,1.71,.06,mat('#090e0b'),-.02,2.99,.96,tv,.16);
  const screenCanvas=document.createElement('canvas');screenCanvas.width=1024;screenCanvas.height=720;const screenCtx=screenCanvas.getContext('2d');
  const screenTexture=new THREE.CanvasTexture(screenCanvas);screenTexture.colorSpace=THREE.SRGBColorSpace;screenTexture.anisotropy=8;
  const screenMaterial=new THREE.MeshBasicMaterial({map:screenTexture});
  const screenGeometry=roundedGeometry(2.3,1.61,.008,.12);
  const screenUV=screenGeometry.attributes.uv,screenPos=screenGeometry.attributes.position;
  for(let i=0;i<screenUV.count;i++)screenUV.setXY(i,screenPos.getX(i)/2.3+.5,screenPos.getY(i)/1.61+.5);
  const screen=addMesh(screenGeometry,screenMaterial,-.02,2.99,1.005,tv,false);
  hotspot(screen,'Zoom into the monitor',()=>onZoom());
  const glare=texture(256,256,(ctx,w,h)=>{const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#ffffff1e');g.addColorStop(.35,'#ffffff05');g.addColorStop(.6,'#ffffff00');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);});
  addMesh(roundedGeometry(2.3,1.61,.001,.12),new THREE.MeshBasicMaterial({map:glare,transparent:true,depthWrite:false}),-.02,2.99,1.014,tv);
  textPlane('D I N G',.55,.08,-1.02,3.89,.844,{parent:tv,size:45,color:'#d2c6a0'});
  textPlane('STUDIO MONITOR / 01',1.05,.055,.71,3.89,.844,{parent:tv,size:26,color:'#848c79'});
  for(let i=0;i<4;i++){const x=-1.01+i*.31;const bt=rounded(.18,.12,.08,mat('#535849'),x,1.94,.88,tv,.02);hotspot(bt,`Play ${channels[i].label}`,()=>onChannel(channels[i].id));textPlane(String(i+1),.12,.07,x,1.77,.845,{parent:tv,size:40,color:'#a6ad96'});}
  const ledMat=new THREE.MeshBasicMaterial({color:'#b7e38d'});sphere(.025,ledMat,-1.24,2.15,.854,tv);
  textPlane('POWER',.28,.045,-1.24,2.02,.85,{parent:tv,size:28,color:'#8c967f'});
  for(let i=0;i<2;i++){const knob=cyl(.087,.087,.075,black,.62+i*.34,1.96,.91,tv);knob.rotation.x=Math.PI/2;box(.013,.05,.005,cream,.62+i*.34,1.98,.95,tv);}
  for(let i=0;i<10;i++)box(.28,.013,.02,black,1.2,1.83+i*.037,.843,tv);
  // Rear ventilation and feet stay visible as the camera moves.
  for(let i=0;i<12;i++)box(.012,.9,.045,black,1.53,2.9,-.55+i*.09,tv);
  for(const x of[-1.04,1.04])box(.3,.11,1.1,rubber,x,1.5,-.1,tv);

  // VCR: tape slot, clock and eject button.
  rounded(3.32,.4,1.94,black,-.25,1.4,.01,root,.055);
  rounded(1.48,.12,.025,rubber,-.93,1.43,1.003,root,.015);
  textPlane('VHS  ·  PERSONAL ARCHIVE',1.19,.042,-.93,1.55,1.022,{size:24,color:'#949e85'});
  const vcrDisplay=texture(512,128,(ctx,w,h)=>{ctx.fillStyle='#10221c';ctx.fillRect(0,0,w,h);ctx.shadowColor='#9ccab2';ctx.shadowBlur=16;ctx.fillStyle='#b4dbc0';ctx.font='52px monospace';ctx.textAlign='center';ctx.fillText('▶  00:01',w/2,86);});
  plane(.66,.15,new THREE.MeshBasicMaterial({map:vcrDisplay}),.66,1.43,1.003);
  const eject=rounded(.13,.08,.04,mat('#9b5c3b'),1.18,1.39,1.027,root,.01);hotspot(eject,'Return to the home screen',()=>onChannel('home'));

  // A stack of four individually labelled, clickable tapes.
  const tapeMats=channels.map(c=>mat(c.color));
  channels.forEach((channel,i)=>{
    const g=new THREE.Group();g.position.set(2.2+(i%2)*.075,1.32+i*.205,.28);g.rotation.y=-.15+(i%2)*.08;root.add(g);
    const shell=rounded(1.8,.17,1.06,black,0,0,0,g,.022);hotspot(shell,`Play ${channel.label}`,()=>onChannel(channel.id));
    const labelTexture=texture(768,96,(ctx,w,h)=>{ctx.fillStyle=channel.color;ctx.fillRect(0,0,w,h);ctx.fillStyle='#2c3027';ctx.fillRect(16,12,54,h-24);ctx.fillStyle=channel.color;ctx.font='bold 32px monospace';ctx.fillText(channel.number,23,60);ctx.fillStyle='#2c3027';ctx.font='bold 30px monospace';ctx.fillText(channel.label.toUpperCase(),91,62);ctx.fillRect(w-105,12,2,72);ctx.font='18px monospace';ctx.fillText('YD',w-76,43);ctx.fillText('VHS',w-80,71);});
    const label=plane(1.63,.13,new THREE.MeshBasicMaterial({map:labelTexture}),0,0,.539,g);hotspot(label,`Play ${channel.label}`,()=>onChannel(channel.id));
    box(1.28,.012,.6,tapeMats[i],0,.091,0,g);for(const x of[-.35,.35]){const reel=cyl(.2,.2,.018,charcoal,x,.106,0,g,24);cyl(.065,.065,.02,cream,x,.12,0,g,16);}
    tapes.push({group:g,base:g.position.clone(),id:channel.id});
  });

  const researchTapes=[];let researchMode=false,loadedPaper=null,swap=null;
  papers.forEach((p,i)=>{const g=new THREE.Group();const col=Math.floor(i/5),row=i%5;g.position.set(1.85+col*.66,1.29+row*.18,-.22+col*.52);g.rotation.y=-.12;g.scale.setScalar(.78);g.visible=false;root.add(g);
    const shell=rounded(1.8,.16,1.06,black,0,0,0,g,.02);hotspot(shell,'Play '+p.label,()=>onPaper(p.id));
    const label=textPlane(p.number+' / '+p.label.toUpperCase(),1.65,.12,0,0,.54,{background:p.color,color:'#252b24',size:24,parent:g});hotspot(label,'Play '+p.label,()=>onPaper(p.id));
    box(1.25,.012,.62,mat(p.color),0,.086,0,g);for(const x of[-.35,.35]){cyl(.2,.2,.018,charcoal,x,.1,0,g);cyl(.066,.066,.02,cream,x,.115,0,g);}researchTapes.push({group:g,base:g.position.clone(),paper:p});
  });

  const slot=new THREE.Vector3(-.93,1.43,.40),front=new THREE.Vector3(-.93,1.43,1.66);
  const homeRotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,-.12,0));
  const alignedRotation=new THREE.Quaternion();
  const flightRotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(-.14,.32,-.09));
  const smooth=x=>{x=clamp(x,0,1);return x*x*x*(x*(x*6-15)+10);};
  let queuedSwap=null;
  function resetTape(t){t.group.position.copy(t.base);t.group.quaternion.copy(homeRotation);t.group.visible=researchMode;}
  function cancelSwap(){
    if(swap)swap.resolve(false);if(queuedSwap)queuedSwap.resolve(false);
    swap=null;queuedSwap=null;researchTapes.forEach(resetTape);loadedPaper=null;
  }
  function setResearch(value){researchMode=value;if(!value)cancelSwap();tapes.forEach(t=>t.group.visible=!value);researchTapes.forEach(t=>t.group.visible=value&&t!==loadedPaper);}
  function travelPath(tape,returning=false){
    const b=tape.base;
    // Pull clear of the stack before rising; cross the desk along a continuous curve.
    const points=[b.clone(),new THREE.Vector3(b.x,b.y,b.z+1.12),
      new THREE.Vector3(b.x-.1,b.y+.86,b.z+1.32),
      new THREE.Vector3(.35,2.55,1.95),new THREE.Vector3(-.93,1.85,1.85),front.clone()];
    return new THREE.CatmullRomCurve3(returning?points.reverse():points,false,'centripetal');
  }
  function startSwap(next,resolve){
    if(loadedPaper===next){resolve(true);return;}
    const old=loadedPaper;
    swap={next,old,t:0,resolve,inPath:travelPath(next),outPath:old?travelPath(old,true):null,phase:'LOAD'};
    if(old){old.group.visible=true;old.group.position.copy(slot);old.group.quaternion.copy(alignedRotation);}
  }
  function playPaper(id){
    const next=researchTapes.find(t=>t.paper.id===id);if(!next)return Promise.resolve(false);
    return new Promise(resolve=>{
      // Finish the tape already in motion, then honor only the most recent request.
      if(swap){if(queuedSwap)queuedSwap.resolve(false);queuedSwap={next,resolve};}
      else startSwap(next,resolve);
    });
  }
  function fly(tape,path,progress,returning){
    const u=smooth(progress);tape.group.position.copy(path.getPointAt(u));
    const a=returning?alignedRotation:homeRotation,b=returning?homeRotation:alignedRotation;
    if(u<.5)tape.group.quaternion.slerpQuaternions(a,flightRotation,smooth(u*2));
    else tape.group.quaternion.slerpQuaternions(flightRotation,b,smooth((u-.5)*2));
  }
  function updateSwap(dt){
    if(!swap)return;const s=swap;s.t+=dt;const t=s.t,n=s.next;
    const incomingStart=s.old?1.45:.12;
    if(s.old){
      if(t<.64){s.phase='EJECT';s.old.group.position.lerpVectors(slot,front,smooth(t/.64));}
      else if(t<2.34){s.phase='RETURN';fly(s.old,s.outPath,(t-.64)/1.7,true);}
      else resetTape(s.old);
    }
    const u=t-incomingStart;
    if(u>=0){
      n.group.visible=true;
      if(u<1.95){s.phase='LOAD';fly(n,s.inPath,u/1.95,false);}
      else if(u<2.15){s.phase='ALIGN';n.group.position.copy(front);n.group.quaternion.copy(alignedRotation);}
      else if(u<2.87){s.phase='INSERT';n.group.position.lerpVectors(front,slot,smooth((u-2.15)/.72));}
      else if(u<3.12){s.phase='TRACKING';n.group.visible=false;}
      else{
        n.group.visible=false;loadedPaper=n;activeChannel=n.paper;swap=null;s.resolve(true);paintScreen(0);
        if(queuedSwap){const q=queuedSwap;queuedSwap=null;startSwap(q.next,q.resolve);}
      }
    }
  }

  contactShadow(2.25,.3,2.8,1.6);
  // One loose cassette in the foreground.
  const cassette=new THREE.Group();cassette.position.set(2.75,1.24,1.72);cassette.rotation.y=-.35;root.add(cassette);
  rounded(.92,.1,.6,mat('#ad9c76'),0,0,0,cassette,.035);box(.66,.015,.23,black,0,.055,0,cassette);for(const x of[-.2,.2])cyl(.09,.09,.02,cream,x,.07,0,cassette,20);

  // Brass task lamp with a warm pool of real, shadow-casting light.
  const lampGroup=new THREE.Group();lampGroup.position.set(-3.42,1.19,-.32);root.add(lampGroup);
  cyl(.39,.46,.085,brass,0,.045,0,lampGroup);cyl(.31,.39,.04,mat('#695739',.4,.4),0,.1,0,lampGroup);
  rod([0,.09,0],[0,1.35,0],.035,brass,lampGroup);sphere(.09,brass,0,1.35,0,lampGroup);
  rod([0,1.35,0],[.54,2.03,-.03],.035,brass,lampGroup);
  const shade=new THREE.Group();shade.position.set(.55,2.04,-.03);shade.rotation.z=-.34;lampGroup.add(shade);
  const copper=mat('#a66f42',.35,.65);const lampShade=addMesh(new THREE.ConeGeometry(.43,.57,40,1,true),copper,0,-.1,0,shade,true);
  hotspot(lampShade,'Switch the desk lamp',()=>onLamp());
  const innerShade=addMesh(new THREE.ConeGeometry(.405,.54,32,1,true),new THREE.MeshStandardMaterial({color:'#e6d8aa',side:THREE.BackSide,emissive:'#dcb068',emissiveIntensity:.5}),0,-.11,0,shade);
  const bulb=sphere(.095,new THREE.MeshBasicMaterial({color:'#ffe2a3'}),0,-.2,0,shade);
  const lampLight=new THREE.PointLight('#ffd49b',35,9,2);lampLight.position.set(-2.86,3.04,-.25);lampLight.castShadow=true;lampLight.shadow.mapSize.set(1024,1024);lampLight.shadow.bias=-.001;lampLight.shadow.normalBias=.03;lampLight.shadow.radius=5;scene.add(lampLight);
  const lampSpot=new THREE.SpotLight('#ffd29a',60,9,.85,.8,1.8);lampSpot.position.copy(lampLight.position);lampSpot.target.position.set(-2.45,1.1,.4);scene.add(lampSpot,lampSpot.target);
  contactShadow(-3.4,-.25,1.1,1.1);

  // Mug, open notebook, pencil, and a compact keyboard.
  const mug=new THREE.Group();mug.position.set(-2.25,1.22,1.55);root.add(mug);
  const mugMat=mat('#b9ad8c',.33);cyl(.22,.18,.43,mugMat,0,.23,0,mug);cyl(.199,.199,.008,mat('#30281d',.23),0,.448,0,mug);const lip=addMesh(new THREE.TorusGeometry(.209,.018,8,32),mugMat,0,.454,0,mug);lip.rotation.x=Math.PI/2;const handle=addMesh(new THREE.TorusGeometry(.13,.038,10,24),mugMat,-.23,.26,0,mug);handle.rotation.y=Math.PI/2;contactShadow(-2.25,1.55,.8,.8);
  const notebook=new THREE.Group();notebook.position.set(-3.65,1.24,1.45);notebook.rotation.y=.18;root.add(notebook);
  rounded(1.25,.07,1.05,mat('#4e6554'),0,0,0,notebook,.025);box(1.19,.04,1,paper,0,.053,0,notebook);
  const pageMap=texture(512,512,(ctx,w,h)=>{ctx.fillStyle='#d9cfae';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#9caa9680';for(let i=60;i<h;i+=32){ctx.beginPath();ctx.moveTo(40,i);ctx.lineTo(w-32,i);ctx.stroke();}ctx.fillStyle='#5c6450';ctx.font='italic 24px Georgia';ctx.fillText('Notes to self',40,49);ctx.font='italic 19px Georgia';ctx.fillText('keep following',48,118);ctx.fillText('your curiosity.',53,150);});
  const page=plane(1.17,.97,new THREE.MeshStandardMaterial({map:pageMap,roughness:1}),0,.08,0,notebook);page.rotation.x=-Math.PI/2;
  rod([-.31,.12,.36],[.4,.12,-.35],.023,mat('#b28d40'),notebook);
  const keyboard=new THREE.Group();keyboard.position.set(-.15,1.27,1.79);keyboard.rotation.x=.04;root.add(keyboard);
  rounded(2.1,.1,.63,cream,0,0,0,keyboard,.045);const keyGeo=new THREE.BoxGeometry(.115,.045,.1);const keys=new THREE.InstancedMesh(keyGeo,mat('#dfd7bd'),52);let keyIdx=0;const keyDummy=new THREE.Object3D();for(let row=0;row<4;row++)for(let col=0;col<13;col++){keyDummy.position.set(-.84+col*.14,.069,-.21+row*.13);keyDummy.updateMatrix();keys.setMatrixAt(keyIdx++,keyDummy.matrix);}keyboard.add(keys);box(.59,.046,.08,mat('#9b9d83'),0,.071,.23,keyboard);
  contactShadow(-.15,1.78,2.8,.85);

  // Plant and a small analog clock in the corner.
  const potMat=mat('#976144',.9);cyl(.3,.22,.52,potMat,3.85,1.45,-1.17);cyl(.27,.27,.02,mat('#282b20'),3.85,1.72,-1.17);
  const leafMat=mat('#52664a',.8);const leafGeo=new THREE.SphereGeometry(1,12,8);
  for(let i=0;i<19;i++){const angle=i*2.4,length=.35+random()*.65,end=[3.85+Math.sin(angle)*length,1.85+random()*.75,-1.17+Math.cos(angle)*length*.6];rod([3.85,1.68,-1.17],end,.012,mat('#4e5740'));const leaf=addMesh(leafGeo,leafMat,...end);leaf.scale.set(.12,.34,.045);leaf.rotation.set(.3,angle,-Math.sin(angle)*.7);}
  contactShadow(3.85,-1.17,1.4,1.1);
  const clockGroup=new THREE.Group();clockGroup.position.set(3.7,1.56,-.05);clockGroup.rotation.y=-.2;root.add(clockGroup);const clockBody=cyl(.3,.3,.14,brass,0,0,0,clockGroup,48);clockBody.rotation.x=Math.PI/2;
  const clockFace=texture(256,256,(ctx,w,h)=>{ctx.fillStyle='#d1c7a4';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#535640';ctx.lineWidth=4;for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.beginPath();ctx.moveTo(128+Math.sin(a)*98,128-Math.cos(a)*98);ctx.lineTo(128+Math.sin(a)*110,128-Math.cos(a)*110);ctx.stroke();}ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(128,128);ctx.lineTo(90,94);ctx.moveTo(128,128);ctx.lineTo(163,58);ctx.stroke();});
  const face=addMesh(new THREE.CircleGeometry(.265,48),new THREE.MeshStandardMaterial({map:clockFace}),0,0,.077,clockGroup);for(const x of[-.19,.19])rod([x,-.16,0],[x*1.25,-.36,.06],.025,brass,clockGroup);
  // A small radio gives the sound control a physical home.
  const radio=new THREE.Group();radio.position.set(-4.45,1.53,-1.05);radio.rotation.y=.22;root.add(radio);rounded(.9,.62,.42,mat('#615942'),0,0,0,radio,.06);const grille=box(.46,.43,.025,charcoal,-.13,0,.23,radio);hotspot(grille,'Toggle the winter ambience',()=>onSound());for(let i=0;i<12;i++)box(.42,.009,.03,mat('#817d60'),-.13,-.19+i*.034,.25,radio);for(let i=0;i<2;i++){const k=cyl(.065,.065,.04,black,.3,.13-i*.25,.25,radio,20);k.rotation.x=Math.PI/2;hotspot(k,'Toggle the winter ambience',()=>onSound());}rod([-.25,.31,-.1],[-.43,1.3,-.1],.012,brass,radio);

  const ambient=new THREE.HemisphereLight('#c0d3cf','#5b4230',1.6);scene.add(ambient);
  const moon=new THREE.DirectionalLight('#a5c9d0',1.8);moon.position.set(-3,6,-3);scene.add(moon);
  const fill=new THREE.DirectionalLight('#e0c39a',1.3);fill.position.set(2,6,5);scene.add(fill);
  const tvGlow=new THREE.PointLight('#b6d29a',5.5,5,2);tvGlow.position.set(-.25,2.9,1.25);scene.add(tvGlow);
  const bounce=new THREE.PointLight('#c39156',8,10,2);bounce.position.set(-3,2.3,2.2);scene.add(bounce);

  function paintScreen(time){
    const ctx=screenCtx,w=1024,h=720;ctx.fillStyle='#13231c';ctx.fillRect(0,0,w,h);
    const gr=ctx.createRadialGradient(w*.45,h*.5,20,w*.5,h*.5,w*.65);gr.addColorStop(0,'#314535');gr.addColorStop(1,'#101e19');ctx.fillStyle=gr;ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#b9d69b';ctx.shadowColor='#b5d88b';ctx.shadowBlur=4;ctx.font='22px monospace';ctx.fillText('▶ PLAY',55,62);ctx.textAlign='right';ctx.fillText('CH '+(activeChannel?.number||'00'),968,62);ctx.textAlign='left';ctx.shadowBlur=0;
    ctx.strokeStyle='#a9c78d55';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(53,91);ctx.lineTo(971,91);ctx.stroke();
    if(swap){ctx.fillStyle='#b5c89e';ctx.font='38px monospace';ctx.fillText('LOADING TAPE '+swap.next.paper.number,75,320);ctx.font='23px monospace';ctx.fillText(swap.phase+'  /  PLEASE WAIT',75,382);for(let i=0;i<45;i++){ctx.fillStyle='rgba(185,210,167,'+(random()*.25)+')';ctx.fillRect(0,random()*h,w,random()*6);}}
    else if(activeChannel?.id?.startsWith('paper-')){ctx.fillStyle='#91ac83';ctx.font='23px monospace';ctx.fillText('RESEARCH / '+(activeChannel.year||'ARCHIVE'),75,165);ctx.fillStyle='#c9dda7';ctx.font='bold 53px Georgia';const words=activeChannel.label.split(' ');let line='',y=270;for(const word of words){if(ctx.measureText(line+word).width>820){ctx.fillText(line,75,y);y+=66;line='';}line+=word+' ';}ctx.fillText(line,75,y);ctx.font='22px monospace';ctx.fillStyle='#adc297';ctx.fillText('TAPE '+activeChannel.number+' / NOW PLAYING',75,520);ctx.fillText('Publication details in the research index.',75,567);}
    else if(!activeChannel){
      ctx.fillStyle='#c9dda7';ctx.shadowColor='#9ebc79';ctx.shadowBlur=9;ctx.font='bold 112px Georgia';ctx.fillText('YUANYI',75,295);ctx.fillText('DING',75,414);ctx.shadowBlur=0;
      ctx.font='26px monospace';ctx.fillStyle='#b0c59b';ctx.fillText('CURRENTLY AT ADOBE',79,488);
      ctx.font='22px monospace';ctx.fillStyle='#8fa585';ctx.fillText('A personal archive, always in progress.',79,543);
      ctx.strokeStyle='#9bb67e';ctx.lineWidth=3;const cx=849,cy=345;ctx.beginPath();ctx.ellipse(cx,cy,61,91,0,0,Math.PI*2);ctx.ellipse(cx,cy,20,91,0,0,Math.PI*2);ctx.ellipse(cx,cy,61,30,0,0,Math.PI*2);ctx.moveTo(cx-61,cy);ctx.lineTo(cx+61,cy);ctx.stroke();
    }else{
      ctx.font='20px monospace';ctx.fillStyle='#92ac83';ctx.fillText('PERSONAL ARCHIVE / '+activeChannel.number,75,181);
      ctx.fillStyle='#c9dda7';ctx.font='bold 65px Georgia';const title=activeChannel.label.toUpperCase();ctx.fillText(title,75,310,880);
      ctx.font='25px monospace';ctx.fillStyle='#aac599';ctx.fillText('NOW PLAYING',79,387);ctx.fillStyle='#8da780';ctx.font='22px monospace';ctx.fillText('Open the archive to read more.',79,454);
    }
    ctx.fillStyle='#b3cd96';ctx.font='20px monospace';ctx.fillText('EST. 2026',58,665);ctx.textAlign='right';ctx.fillText('SELECT A TAPE  ↗',968,665);ctx.textAlign='left';
    ctx.fillStyle='#00000027';for(let y=0;y<h;y+=4)ctx.fillRect(0,y,w,1);
    if(!reducedMotion){ctx.fillStyle='#c4ddb706';ctx.fillRect(0,(time*28)%h,w,35);}
    screenTexture.needsUpdate=true;
  }
  function setChannel(id){activeChannel=channels.find(c=>c.id===id)||null;paintScreen(0);}
  function setZoom(value){zoomed=value;hover=null;onHover(null);}
  function setLamp(value){lampOn=value;lampLight.intensity=value?35:0;lampSpot.intensity=value?60:0;bounce.intensity=value?8:0;bulb.visible=value;innerShade.material.emissiveIntensity=value?.5:0;}
  const orbit={yaw:0,pitch:null},drag={id:null,x:0,y:0,yaw:0,pitch:0,moved:false};
  let suppressClick=false;
  const viewLimits={yaw:88*Math.PI/180,minPitch:-10*Math.PI/180,maxPitch:60*Math.PI/180};
  let defaultPitch=0;
  function resetView(){orbit.yaw=0;orbit.pitch=null;pointer.set(0,0);}
  renderer.domElement.tabIndex=0;
  renderer.domElement.setAttribute('role','region');
  renderer.domElement.setAttribute('aria-label','3D studio. Drag to look around. Arrow keys change the view; R resets it.');
  const targetPos=new THREE.Vector3(),targetLook=new THREE.Vector3(),look=new THREE.Vector3(0,2.4,0);
  function cameraTarget(){const aspect=container.clientWidth/container.clientHeight;const narrow=aspect<.9;if(zoomed){targetPos.set(-.27,3.04,4.9+(narrow?1.5:0));targetLook.set(-.27,2.92,.2);}else{targetPos.set(.18,3.7,narrow?11.7:(researchMode?10.6:8.9));targetLook.set(0,narrow?2.7:2.48,-.2);}const offset=targetPos.clone().sub(targetLook);const radius=offset.length(),basePitch=Math.asin(offset.y/radius);defaultPitch=basePitch;const yaw=orbit.yaw,pitch=clamp(orbit.pitch??basePitch,viewLimits.minPitch,viewLimits.maxPitch);targetPos.set(targetLook.x+radius*Math.sin(yaw)*Math.cos(pitch),targetLook.y+radius*Math.sin(pitch),targetLook.z+radius*Math.cos(yaw)*Math.cos(pitch));}
  cameraTarget();camera.position.copy(targetPos);look.copy(targetLook);camera.lookAt(look);paintScreen(0);
  const resize=()=>{renderer.setSize(container.clientWidth,container.clientHeight);camera.aspect=container.clientWidth/container.clientHeight;camera.updateProjectionMatrix();cameraTarget();};window.addEventListener('resize',resize);
  function pick(e){
    const rect=renderer.domElement.getBoundingClientRect();
    pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hits=raycaster.intersectObjects(targets.filter(o=>{let p=o;while(p){if(!p.visible)return false;p=p.parent;}return true;}),false);
    hover=hits[0]?.object||null;renderer.domElement.style.cursor=hover?'pointer':'grab';
    onHover(hover?{text:hover.userData.label,x:e.clientX,y:e.clientY}:null);
  }
  const pointerDown=e=>{
    if(e.button!==0||drag.id!==null)return;
    drag.id=e.pointerId;drag.x=e.clientX;drag.y=e.clientY;drag.yaw=orbit.yaw;drag.pitch=orbit.pitch??defaultPitch;drag.moved=false;
    renderer.domElement.setPointerCapture(e.pointerId);
  };
  const pointerMove=e=>{
    if(drag.id===e.pointerId){
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(Math.hypot(dx,dy)>6)drag.moved=true;
      if(drag.moved){orbit.yaw=clamp(drag.yaw-dx/container.clientWidth*2.8,-viewLimits.yaw,viewLimits.yaw);orbit.pitch=clamp(drag.pitch+dy/container.clientHeight*1.4,viewLimits.minPitch,viewLimits.maxPitch);hover=null;onHover(null);renderer.domElement.style.cursor='grabbing';return;}
    }
    pick(e);
  };
  const pointerUp=e=>{
    if(drag.id!==e.pointerId)return;
    suppressClick=drag.moved||e.type==='pointercancel';drag.id=null;
    if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);
    renderer.domElement.style.cursor='grab';
  };
  const leave=()=>{if(drag.id!==null)return;pointer.set(0,0);hover=null;onHover(null);};
  const click=e=>{if(suppressClick){suppressClick=false;return;}pick(e);hover?.userData.action();};
  const viewKeys=e=>{
    const step=.035;
    if(e.key==='ArrowLeft')orbit.yaw=clamp(orbit.yaw-step,-viewLimits.yaw,viewLimits.yaw);
    else if(e.key==='ArrowRight')orbit.yaw=clamp(orbit.yaw+step,-viewLimits.yaw,viewLimits.yaw);
    else if(e.key==='ArrowUp')orbit.pitch=clamp((orbit.pitch??defaultPitch)+step,viewLimits.minPitch,viewLimits.maxPitch);
    else if(e.key==='ArrowDown')orbit.pitch=clamp((orbit.pitch??defaultPitch)-step,viewLimits.minPitch,viewLimits.maxPitch);
    else if(e.key.toLowerCase()==='r')resetView();else return;e.preventDefault();
  };
  renderer.domElement.addEventListener('pointerdown',pointerDown);
  renderer.domElement.addEventListener('pointermove',pointerMove);
  renderer.domElement.addEventListener('pointerup',pointerUp);
  renderer.domElement.addEventListener('pointercancel',pointerUp);
  renderer.domElement.addEventListener('lostpointercapture',()=>{drag.id=null;});
  renderer.domElement.addEventListener('pointerleave',leave);
  renderer.domElement.addEventListener('keydown',viewKeys);
  renderer.domElement.addEventListener('click',click);
  const clock=new THREE.Clock();let screenTick=0;
  function animate(){if(disposed)return;frame=requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05),time=clock.elapsedTime;if(document.hidden||document.body.classList.contains('reading'))return;
    updateSwap(dt);cameraTarget();if(!reducedMotion&&!zoomed){targetPos.x+=pointer.x*.13;targetPos.y+=pointer.y*.055;}camera.position.lerp(targetPos,reducedMotion?1:1-Math.exp(-dt*3.8));look.lerp(targetLook,reducedMotion?1:1-Math.exp(-dt*4.5));camera.lookAt(look);
    for(const tape of tapes){const chosen=tape.id===activeChannel?.id;const lift=chosen?.24:0;tape.group.position.y=THREE.MathUtils.lerp(tape.group.position.y,tape.base.y+lift,reducedMotion?1:dt*5);tape.group.position.x=THREE.MathUtils.lerp(tape.group.position.x,tape.base.x+(chosen?.12:0),reducedMotion?1:dt*5);}
    for(let i=0;i<snowCount;i++){const j=i*3;snowPositions[j+1]-=dt*snowVel[i];snowPositions[j]+=dt*(.035+Math.sin(time*.45+snowPhase[i])*.045);if(snowPositions[j+1]<1.6)snowPositions[j+1]=6.5;if(snowPositions[j]>5.3)snowPositions[j]=-5.3;if(snowPositions[j]<-5.3)snowPositions[j]=5.3;}snowGeometry.attributes.position.needsUpdate=true;
    screenTick+=dt;if(screenTick>.12){paintScreen(time);screenTick=0;}renderer.render(scene,camera);
  }animate();
  return{setChannel,setZoom,setLamp,setResearch,playPaper,resetView,dispose(){disposed=true;cancelAnimationFrame(frame);window.removeEventListener('resize',resize);renderer.dispose();renderer.domElement.remove();}};
}
