import { channels } from './content.js';
import { papers } from './papers.js';

const $=s=>document.querySelector(s);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const detail=$('#detail');let room=null,zoomed=false,lampOn=true,reading=false,soundOn=false,audioContext=null,audioGain=null,lastFocus=null,canRender=true;
function element(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el;}
function link(item){const a=element('a','detail-link');a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';const text=element('div');text.append(element('strong','',item.label),element('small','',item.description));a.append(text,element('span','','↗'));a.setAttribute('aria-label',`${item.label} (opens in a new tab)`);return a;}
function renderContent(c,target,headingTag='h2'){target.replaceChildren();target.append(element('span','eyebrow',`TAPE ${c.number} / ${c.label.toUpperCase()}`));const title=element(headingTag,'',c.title);if(target.id==='detail-body')title.id='detail-title';target.append(title,element('p','intro',c.intro),element('p','body',c.body));c.items.forEach(item=>target.append(link(item)));target.append(element('p','note',c.note));}
function announce(text){$('#announcement').textContent=text;}
function selectChannel(id,open=true){
  if(id==='research'&&!reading){openResearch();return;}
  closeResearch();room?.setChannel(id);const c=channels.find(c=>c.id===id);document.querySelectorAll('[data-channel]').forEach(b=>b.classList.toggle('active',b.dataset.channel===id));
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
      const noise=audioContext.createBufferSource();noise.buffer=buffer;noise.loop=true;const filter=audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=550;
      audioGain=audioContext.createGain();audioGain.gain.value=0;noise.connect(filter).connect(audioGain).connect(audioContext.destination);noise.start();
    }
    await audioContext.resume();soundOn=!soundOn;audioGain.gain.setTargetAtTime(soundOn?.12:0,audioContext.currentTime,.25);
    $('#sound').setAttribute('aria-pressed',String(soundOn));$('#sound span').textContent=soundOn?'Ambience on':'Sound off';announce(soundOn?'Winter ambience on':'Sound off');
  }catch{announce('Audio is unavailable in this browser.');$('#sound span').textContent='Audio unavailable';}
}
function setMode(value){closeResearch();reading=value;document.body.classList.toggle('reading',reading);$('#reading').hidden=!reading;$('#room-ui').hidden=reading;$('#mode').setAttribute('aria-pressed',String(reading));$('#mode span').textContent=reading?'Back to studio':'Reading mode';if(reading&&soundOn){soundOn=false;audioGain?.gain.setTargetAtTime(0,audioContext.currentTime,.1);$('#sound').setAttribute('aria-pressed','false');$('#sound span').textContent='Sound off';}if(reading){window.scrollTo(0,0);}announce(reading?'Reading mode':'Interactive studio');}
$('#reset-view').addEventListener('click',()=>{room?.resetView();announce('View reset');});
$('#zoom').addEventListener('click',toggleZoom);$('#lamp').addEventListener('click',toggleLamp);$('#sound').addEventListener('click',toggleSound);$('#mode').addEventListener('click',()=>{if(!canRender){announce('The 3D studio is not available on this device. Reading mode remains available.');return;}setMode(!reading);});
$('.skip-link').addEventListener('click',e=>{e.preventDefault();setMode(true);$('#reading').focus();});
$('#credits').addEventListener('click',()=>{lastFocus=document.activeElement;$('#detail-index').textContent='STUDIO NOTES';const target=$('#detail-body');target.replaceChildren();const title=element('h2','','A room of one’s own.');title.id='detail-title';target.append(element('span','eyebrow','BUILT WITH CURIOSITY'),title,element('p','intro','A quiet, interactive corner of the internet.'),element('p','body','Inspired by Felix Rieseberg’s wonderful personal website. The room and its objects are built with Three.js. The Manhattan winter skyline is an original AI-generated image created with OpenAI image generation; it is an imagined city view, not a documentary photograph. Snowfall and the quiet winter ambience are generated with code.'),link({label:'The inspiration',description:'Felix Rieseberg’s personal website',url:'https://felixrieseberg.com/'}),link({label:'Three.js',description:'3D rendering library · MIT license',url:'https://threejs.org/'}),element('p','note','Use 1–4 to explore, Z to zoom, L for the lamp, and Esc to close a panel. Sound is off until you choose to enable it.'));detail.showModal();});
document.addEventListener('keydown',e=>{if(e.altKey||e.metaKey||e.ctrlKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||detail.open)return;const num=Number(e.key);if(num>=1&&num<=4){selectChannel(channels[num-1].id);return;}if(e.key.toLowerCase()==='r'){room?.resetView();announce('View reset');}if(e.key.toLowerCase()==='z')toggleZoom();if(e.key.toLowerCase()==='l')toggleLamp();if(e.key==='Escape'&&zoomed){zoomed=false;applyZoom();}});
const updateClock=()=>{$('#clock').textContent=new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});};updateClock();setInterval(updateClock,30000);
document.addEventListener('visibilitychange',()=>{if(audioContext&&audioGain){audioGain.gain.setTargetAtTime(document.hidden?0:(soundOn?.12:0),audioContext.currentTime,.2);}});
function onHover(item){const el=$('#hover-label');if(!item||detail.open){el.style.opacity=0;return;}el.textContent=item.text;el.style.left=`${Math.min(innerWidth-230,Math.max(10,item.x+16))}px`;el.style.top=`${Math.min(innerHeight-70,item.y+19)}px`;el.style.opacity=1;}

let researchOpen=false,selectionVersion=0,selectedPaper=null;
const archive=element('aside','research-archive');archive.hidden=true;archive.setAttribute('aria-label','Research archive');
const archiveTop=element('div','archive-top');const archiveClose=element('button','','Close ×');archiveClose.setAttribute('aria-label','Close research');archiveClose.addEventListener('click',closeResearch);
archiveTop.append(element('span','eyebrow','RESEARCH / THE TAPE LIBRARY'),archiveClose);
const archiveTitle=element('h2','','Research notes.');const playback=element('p','playback','Select a paper to load its tape.');playback.setAttribute('role','status');
const paperDetail=element('div','paper-detail');const paperList=element('div','paper-list');
archive.append(archiveTop,archiveTitle,playback,paperDetail,element('h3','list-heading','PUBLICATIONS / '+papers.length+' RECORDS'),paperList);document.body.append(archive);
for(const p of papers){const b=element('button','paper-choice');b.dataset.paper=p.id;b.append(element('span','paper-number',p.number),element('span','paper-name',p.label),element('span','paper-year',p.year||'—'));b.setAttribute('aria-label',p.title);b.addEventListener('click',()=>selectPaper(p.id));paperList.append(b);}
function openResearch(){if(detail.open)detail.close();researchOpen=true;archive.hidden=false;document.body.classList.add('research-open');zoomed=false;applyZoom();room?.setResearch(true);room?.setChannel('research');window.dispatchEvent(new Event('resize'));document.querySelectorAll('[data-channel]').forEach(b=>b.classList.toggle('active',b.dataset.channel==='research'));$('#status-text').textContent='RESEARCH / SELECT A TAPE';}
function closeResearch(){if(!researchOpen)return;selectionVersion++;researchOpen=false;archive.hidden=true;document.body.classList.remove('research-open');room?.setResearch(false);window.dispatchEvent(new Event('resize'));}
async function selectPaper(id){const p=papers.find(p=>p.id===id);if(!p)return;if(!researchOpen)openResearch();const version=++selectionVersion;selectedPaper=p;paperList.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.paper===id)));paperDetail.replaceChildren(element('span','eyebrow','TAPE '+p.number+' / '+(p.year||'UNDATED')),element('h3','',p.title),element('p','paper-authors',p.authors),element('p','paper-venue',p.venue||'Publication details not supplied in Scholar.'));if(p.note)paperDetail.append(element('p','paper-note',p.note));paperDetail.append(link({label:'View publication ↗',description:'Open this paper’s Google Scholar record',url:p.url}));archive.scrollTop=0;playback.textContent='EJECT → REWIND → LOAD / TAPE '+p.number;$('#status-text').textContent='LOADING / TAPE '+p.number;announce('Loading '+p.label);await room?.playPaper(id);if(version!==selectionVersion)return;playback.textContent='▶ NOW PLAYING / '+p.label;$('#status-text').textContent='NOW PLAYING / RESEARCH '+p.number;announce('Now playing '+p.title);}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&researchOpen){closeResearch();document.querySelector('[data-channel="research"]').focus();}});
const readResearch=$('#read-research > div');readResearch.replaceChildren(element('span','eyebrow','RESEARCH / PUBLICATIONS'));for(const p of papers){const article=element('article','reading-paper');article.append(element('h3','',p.title),element('p','',p.authors),element('p','',p.venue||'Undated Scholar record'));if(p.note)article.append(element('p','note',p.note));article.append(link({label:'View publication',description:p.year||'Google Scholar',url:p.url}));readResearch.append(article);}

try{const {createRoom}=await import('./room.js?v=room-orbit-full-3');room=await createRoom($('#scene'),{onChannel:selectChannel,onHover,onLamp:toggleLamp,onSound:toggleSound,onZoom:toggleZoom,onPaper:selectPaper,reducedMotion});if(researchOpen){room.setResearch(true);room.setChannel('research');window.dispatchEvent(new Event('resize'));if(selectedPaper)selectPaper(selectedPaper.id);}$('#loading').classList.add('ready');setTimeout(()=>$('#loading').hidden=true,650);}catch(error){console.error('The 3D studio could not start:',error);canRender=false;$('#loading').hidden=true;setMode(true);$('#mode').disabled=true;$('#mode span').textContent='Reading mode';announce('The 3D studio is unavailable on this device. Showing the readable version.');}
