import { channels } from './content.js';

const $=s=>document.querySelector(s);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const detail=$('#detail');let room=null,zoomed=false,lampOn=true,reading=false,soundOn=false,audioContext=null,audioGain=null,lastFocus=null,canRender=true;
function element(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el;}
function link(item){const a=element('a','detail-link');a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';const text=element('div');text.append(element('strong','',item.label),element('small','',item.description));a.append(text,element('span','','↗'));a.setAttribute('aria-label',`${item.label} (opens in a new tab)`);return a;}
function renderContent(c,target,headingTag='h2'){target.replaceChildren();target.append(element('span','eyebrow',`TAPE ${c.number} / ${c.label.toUpperCase()}`));const title=element(headingTag,'',c.title);if(target.id==='detail-body')title.id='detail-title';target.append(title,element('p','intro',c.intro),element('p','body',c.body));c.items.forEach(item=>target.append(link(item)));target.append(element('p','note',c.note));}
function announce(text){$('#announcement').textContent=text;}
function selectChannel(id,open=true){
  room?.setChannel(id);const c=channels.find(c=>c.id===id);document.querySelectorAll('[data-channel]').forEach(b=>b.classList.toggle('active',b.dataset.channel===id));
  $('#status-text').textContent=c?`NOW PLAYING / ${c.number}`:'STUDIO / AFTER HOURS';
  if(!c){if(detail.open)detail.close();return;}
  if(reading){document.getElementById(`read-${id}`).scrollIntoView({behavior:reducedMotion?'instant':'smooth',block:'start'});return;}
  if(open){lastFocus=document.activeElement;renderContent(c,$('#detail-body'));$('#detail-index').textContent=`▶ PLAY / ${c.number}`;if(!detail.open)detail.showModal();$('#close-detail').focus();}announce(`Selected ${c.label}`);
}
for(const channel of channels){const section=element('section','reading-section');section.id=`read-${channel.id}`;section.append(element('h2','',`${channel.number} / ${channel.label}`));const body=element('div');renderContent(channel,body,'h3');section.append(body);$('#reading-content').append(section);}
document.querySelectorAll('[data-channel]').forEach(button=>button.addEventListener('click',()=>selectChannel(button.dataset.channel)));
$('.wordmark').addEventListener('click',e=>{e.preventDefault();selectChannel('home');if(reading)window.scrollTo({top:0,behavior:reducedMotion?'instant':'smooth'});else{zoomed=false;applyZoom();}});
function closeDetail(){detail.close();}
$('#close-detail').addEventListener('click',closeDetail);
detail.addEventListener('click',e=>{if(e.target===detail){const r=detail.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDetail();}});
detail.addEventListener('close',()=>{lastFocus?.focus?.();});
function applyZoom(){room?.setZoom(zoomed);document.body.classList.toggle('zoomed',zoomed);$('#zoom').setAttribute('aria-pressed',String(zoomed));$('#zoom span').textContent=zoomed?'Zoom out':'Zoom';}
function toggleZoom(){if(reading)return;zoomed=!zoomed;applyZoom();}
function toggleLamp(){lampOn=!lampOn;room?.setLamp(lampOn);$('#lamp').setAttribute('aria-pressed',String(lampOn));announce(lampOn?'Desk lamp on':'Desk lamp off');}
async function toggleSound(){
  try{
    if(!audioContext){
      audioContext=new (window.AudioContext||window.webkitAudioContext)();
      const buffer=audioContext.createBuffer(1,audioContext.sampleRate*6,audioContext.sampleRate),data=buffer.getChannelData(0);let prev=0;
      for(let i=0;i<data.length;i++){const white=Math.random()*2-1;prev=(prev+.022*white)/1.022;data[i]=prev*3.5;}
      const noise=audioContext.createBufferSource();noise.buffer=buffer;noise.loop=true;const filter=audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=2200;
      audioGain=audioContext.createGain();audioGain.gain.value=0;noise.connect(filter).connect(audioGain).connect(audioContext.destination);noise.start();
    }
    await audioContext.resume();soundOn=!soundOn;audioGain.gain.setTargetAtTime(soundOn?.3:0,audioContext.currentTime,.25);
    $('#sound').setAttribute('aria-pressed',String(soundOn));$('#sound span').textContent=soundOn?'Rain on':'Sound off';announce(soundOn?'Rain ambience on':'Sound off');
  }catch{announce('Audio is unavailable in this browser.');$('#sound span').textContent='Audio unavailable';}
}
function setMode(value){reading=value;document.body.classList.toggle('reading',reading);$('#reading').hidden=!reading;$('#room-ui').hidden=reading;$('#mode').setAttribute('aria-pressed',String(reading));$('#mode span').textContent=reading?'Back to studio':'Reading mode';if(reading&&soundOn){soundOn=false;audioGain?.gain.setTargetAtTime(0,audioContext.currentTime,.1);$('#sound').setAttribute('aria-pressed','false');$('#sound span').textContent='Sound off';}if(reading){window.scrollTo(0,0);}announce(reading?'Reading mode':'Interactive studio');}
$('#zoom').addEventListener('click',toggleZoom);$('#lamp').addEventListener('click',toggleLamp);$('#sound').addEventListener('click',toggleSound);$('#mode').addEventListener('click',()=>{if(!canRender){announce('The 3D studio is not available on this device. Reading mode remains available.');return;}setMode(!reading);});
$('.skip-link').addEventListener('click',e=>{e.preventDefault();setMode(true);$('#reading').focus();});
$('#credits').addEventListener('click',()=>{lastFocus=document.activeElement;$('#detail-index').textContent='STUDIO NOTES';const target=$('#detail-body');target.replaceChildren();const title=element('h2','','A room of one’s own.');title.id='detail-title';target.append(element('span','eyebrow','BUILT WITH CURIOSITY'),title,element('p','intro','A quiet, interactive corner of the internet.'),element('p','body','Inspired by Felix Rieseberg’s wonderful personal website. This room, its objects, textures, and rain ambience are independently made with code. The 3D scene is rendered with Three.js.'),link({label:'The inspiration',description:'Felix Rieseberg’s personal website',url:'https://felixrieseberg.com/'}),link({label:'Three.js',description:'3D rendering library · MIT license',url:'https://threejs.org/'}),element('p','note','Use 1–4 to explore, Z to zoom, L for the lamp, and Esc to close a panel. Sound is off until you choose to enable it.'));detail.showModal();});
document.addEventListener('keydown',e=>{if(e.altKey||e.metaKey||e.ctrlKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||detail.open)return;const num=Number(e.key);if(num>=1&&num<=4){selectChannel(channels[num-1].id);return;}if(e.key.toLowerCase()==='z')toggleZoom();if(e.key.toLowerCase()==='l')toggleLamp();if(e.key==='Escape'&&zoomed){zoomed=false;applyZoom();}});
const updateClock=()=>{$('#clock').textContent=new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});};updateClock();setInterval(updateClock,30000);
document.addEventListener('visibilitychange',()=>{if(audioContext&&audioGain){audioGain.gain.setTargetAtTime(document.hidden?0:(soundOn?.3:0),audioContext.currentTime,.2);}});
function onHover(item){const el=$('#hover-label');if(!item||detail.open){el.style.opacity=0;return;}el.textContent=item.text;el.style.left=`${Math.min(innerWidth-230,Math.max(10,item.x+16))}px`;el.style.top=`${Math.min(innerHeight-70,item.y+19)}px`;el.style.opacity=1;}
try{const {createRoom}=await import('./room.js');room=createRoom($('#scene'),{onChannel:selectChannel,onHover,onLamp:toggleLamp,onSound:toggleSound,onZoom:toggleZoom,reducedMotion});$('#loading').classList.add('ready');setTimeout(()=>$('#loading').hidden=true,650);}catch(error){console.error('The 3D studio could not start:',error);canRender=false;$('#loading').hidden=true;setMode(true);$('#mode').disabled=true;$('#mode span').textContent='Reading mode';announce('The 3D studio is unavailable on this device. Showing the readable version.');}
