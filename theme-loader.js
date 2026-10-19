'use strict';
(async()=>{
const cfg=window.MANILA_SUPABASE||{};
if(!cfg.url||!cfg.anonKey)return;
try{
 const r=await fetch(cfg.url.replace(/\/$/,'')+'/rest/v1/manila_theme_settings?select=*&id=eq.1',{headers:{apikey:cfg.anonKey}});
 if(!r.ok)return;
 const [t]=await r.json();if(!t||!t.enabled||t.theme==='original')return;
 const now=Date.now();
 if(t.starts_at&&now<Date.parse(t.starts_at))return;
 if(t.ends_at&&now>=Date.parse(t.ends_at))return;
 document.documentElement.dataset.manilaTheme=t.theme;
 if(t.headline){const banner=document.querySelector('.announcement span');if(banner){const span=document.createElement('span');span.className='theme-message';span.textContent=' · '+t.headline;banner.appendChild(span);}}
}catch(e){console.warn('Tema originale mantenuto',e);}
})();
