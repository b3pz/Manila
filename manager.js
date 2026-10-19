'use strict';
(async()=>{
 const $=id=>document.getElementById(id);
 const cfg=window.MANILA_SUPABASE||{};
 const notice=(msg,error=false)=>{$('notice').textContent=msg;$('notice').classList.toggle('error',error)};
 if(!cfg.url||!cfg.anonKey||!window.supabase){notice('Configurazione richiesta: inserisci Project URL e publishable/anon key in supabase-config.js. Poi esegui supabase/schema.sql nel SQL Editor.',true);return;}
 const client=window.supabase.createClient(cfg.url,cfg.anonKey);
 let rows=[],current=null,user=null,editingImages=[],editingVideo=null;
 const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const label=g=>({man:'Uomo',woman:'Donna',kids:'Kids'})[g]||g;
 const prefix=(category,kind)=>({man:'U',woman:'D',kids:'K'})[category]&&((kind==='hoodie'?'F':'T')+({man:'U',woman:'D',kids:'K'})[category]);
 const getSizes=()=>{const o={};for(const line of $('sizes').value.split('\n')){if(!line.trim())continue;const m=line.trim().match(/^([^:]+):\s*(\d+)$/);if(!m)throw Error('Formato taglie non valido: usa M:4, una per riga');o[m[1].trim()]=Number(m[2]);}return o;};
 const nextCode=(cat,kind)=>{const pre=prefix(cat,kind);const nums=rows.filter(r=>r.code.startsWith(pre)).map(r=>Number(r.code.slice(2))).filter(Number.isFinite);return pre+String(Math.max(-1,...nums)+1).padStart(2,'0');};
 const check=async()=>{const {data,error}=await client.from('manila_admins').select('user_id').eq('user_id',user.id).maybeSingle();if(error||!data)throw Error('Utente autenticato ma non autorizzato. Aggiungi il suo UUID in manila_admins dal SQL Editor.');};
 async function refresh(){const {data,error}=await client.from('manila_products').select('*').order('created_at',{ascending:true});if(error)throw error;rows=(data||[]).filter(r=>!r.archived);paint();refreshLabelOptions();populateReturnProducts();renderInventory();await renderMovements();await renderSales();await renderGifts();$('stats').textContent=rows.length+' prodotti · '+rows.filter(x=>x.published).length+' pubblicati';}

 const euro=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(n)||0);
 const reportModel=()=>rows.map(p=>{const sizes=Object.entries(p.sizes||{}).map(([size,qty])=>({size,qty:Math.max(0,Number(qty)||0)}));const total=sizes.reduce((a,s)=>a+s.qty,0),low=Number($('lowThreshold').value)||0,target=Math.max(1,Number($('targetStock').value)||5);const order=sizes.filter(s=>s.qty<=low).map(s=>({size:s.size,qty:Math.max(0,target-s.qty)})).filter(s=>s.qty>0);return {p,sizes,total,order,needed:order.reduce((a,s)=>a+s.qty,0),status:!sizes.length?'Da censire':total===0?'Esaurito':order.length?'Scorta bassa':'Disponibile'};});
 function renderInventory(){const all=reportModel();const total=all.reduce((a,x)=>a+x.total,0);$('inventoryStats').innerHTML=[['Prodotti',all.length],['Pezzi in magazzino',total],['Prodotti esauriti',all.filter(x=>x.status==='Esaurito').length],['Prodotti sotto scorta',all.filter(x=>x.status==='Scorta bassa').length],['Pezzi suggeriti da ordinare',all.reduce((a,x)=>a+x.needed,0)],['Da censire',all.filter(x=>x.status==='Da censire').length]].map(([name,n])=>'<div class="inventory-stat"><strong>'+n+'</strong><span>'+name+'</span></div>').join('');
 const filter=$('inventoryFilter').value,selected=all.filter(x=>filter==='all'||filter==='low'&&x.needed>0||filter==='zero'&&x.status==='Esaurito'||filter==='available'&&x.total>0||filter==='missing'&&x.status==='Da censire');
 $('inventoryRows').innerHTML=selected.map(x=>'<tr><td><button type="button" class="inventory-link" data-id="'+safe(x.p.id)+'">'+safe(x.p.code)+' — '+safe(x.p.name)+'</button></td><td>'+safe(x.sizes.map(s=>s.size+': '+s.qty).join(', ')||'—')+'</td><td>'+x.total+'</td><td>'+safe(x.status)+'</td><td>'+safe(x.order.map(s=>s.size+': '+s.qty).join(', ')||'—')+'</td></tr>').join('')||'<tr><td colspan="5">Nessun articolo</td></tr>';
 const selectedId=$('saleProduct').value;$('saleProduct').innerHTML='<option value="">Scegli prodotto</option>'+rows.map(p=>'<option value="'+safe(p.id)+'">'+safe(p.code)+' — '+safe(p.name)+'</option>').join('');$('saleProduct').value=selectedId; const chosen=$('giftProduct').value;$('giftProduct').innerHTML='<option value="">Scegli prodotto</option>'+rows.map(p=>'<option value="'+safe(p.id)+'">'+safe(p.code)+' — '+safe(p.name)+'</option>').join('');$('giftProduct').value=chosen;
 }
 const csv=(filename,headers,lines)=>{const content=[headers,...lines].map(line=>line.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';')).join('\r\n');const blob=new Blob(['\ufeff'+content],{type:'text/csv;charset=utf-8'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),2000);};
 $('inventoryCsv').onclick=()=>csv('darklab-magazzino.csv',['Codice','Nome','Categoria','Taglia','Disponibili','Da ordinare'],reportModel().flatMap(x=>x.sizes.length?x.sizes.map(s=>[x.p.code,x.p.name,label(x.p.category),s.size,s.qty,x.order.find(o=>o.size===s.size)?.qty||0]):[[x.p.code,x.p.name,label(x.p.category),'Da censire','','']]));
 for(const id of ['lowThreshold','targetStock','inventoryFilter'])$(id).addEventListener('change',renderInventory);
 $('inventoryRows').onclick=e=>{const button=e.target.closest('[data-id]');if(button)fill(rows.find(p=>p.id===button.dataset.id));};
 let sales=[];
 async function renderSales(){const {data,error}=await client.from('manila_sales').select('*').order('created_at',{ascending:false}).limit(1000);if(error){$('reportCaveat').textContent='Registro vendite da attivare: esegui il file SQL supabase/sales.sql. '+error.message;return;}sales=data||[];
 const units=sales.reduce((s,r)=>s+Number(r.quantity),0),earned=sales.reduce((s,r)=>s+Number(r.quantity)*Number(r.unit_price)+Number(r.shipping_charged),0),ship=sales.reduce((s,r)=>s+Number(r.shipping_cost),0),other=sales.reduce((s,r)=>s+Number(r.other_cost),0),known=sales.filter(r=>r.unit_cost!==null),allKnown=known.length===sales.length,productCost=known.reduce((s,r)=>s+Number(r.quantity)*Number(r.unit_cost),0);
 $('salesStats').innerHTML=[['Vendite registrate',sales.length],['Capi usciti per vendita',units],['Incassi (capi + spedizione)',euro(earned)],['Spedizioni pagate',euro(ship)],['Altri costi',euro(other)],['Margine '+(allKnown?'stimato':'parziale'),allKnown?euro(earned-ship-other-productCost):'Costi capi incompleti']].map(([name,val])=>'<div class="inventory-stat"><strong>'+safe(val)+'</strong><span>'+name+'</span></div>').join('');
 $('reportCaveat').textContent=allKnown?'Margine stimato prima di tasse, commissioni e costi non registrati.':'Attenzione: uno o più costi d’acquisto dei capi non sono stati inseriti. Il margine complessivo non è calcolabile correttamente.';
 $('salesRows').innerHTML=sales.map(r=>'<tr><td>'+safe(new Date(r.created_at).toLocaleDateString('it-IT'))+'</td><td>'+safe(r.product_code)+' / '+safe(r.size)+'</td><td>'+r.quantity+'</td><td>'+euro(Number(r.unit_price)*r.quantity+Number(r.shipping_charged))+'</td><td>'+euro(r.shipping_cost)+'</td><td>'+(r.unit_cost===null?'Costo ignoto':euro((Number(r.unit_price)-Number(r.unit_cost))*r.quantity+Number(r.shipping_charged)-Number(r.shipping_cost)-Number(r.other_cost)))+'</td></tr>').join('')||'<tr><td colspan="6">Nessuna vendita registrata</td></tr>';
 }
 $('salesCsv').onclick=()=>csv('darklab-vendite.csv',['Data','Codice','Taglia','Pezzi','Prezzo unitario','Spedizione incassata','Spedizione pagata','Costo unitario','Altri costi','Note'],sales.map(r=>[r.created_at,r.product_code,r.size,r.quantity,r.unit_price,r.shipping_charged,r.shipping_cost,r.unit_cost??'',r.other_cost,r.note]));
 $('saleProduct').onchange=()=>{const p=rows.find(x=>x.id===$('saleProduct').value);if(p)$('salePrice').value=p.price;updateSaleEstimate();};
 function updateSaleEstimate(){const quantity=Math.max(0,Number($('saleQty').value)||0),price=Math.max(0,Number($('salePrice').value)||0),charged=Math.max(0,Number($('saleShippingCharged').value)||0),shipping=Math.max(0,Number($('saleShippingCost').value)||0);const total=quantity*price+charged;$('saleEstimate').innerHTML='<span>Totale incassato</span><strong>'+euro(total)+'</strong><small>Spedizione pagata: '+euro(shipping)+' · I costi di acquisto si registrano nelle opzioni facoltative.</small>';}
 for(const id of ['saleQty','salePrice','saleShippingCharged','saleShippingCost'])$(id).addEventListener('input',updateSaleEstimate);
 $('saleForm').onsubmit=async e=>{e.preventDefault();try{const p=rows.find(x=>x.id===$('saleProduct').value);if(!p)throw Error('Seleziona un capo.');const v=id=>Number($(id).value);const payload={p_product_id:p.id,p_size:$('saleSize').value.trim(),p_quantity:v('saleQty'),p_unit_price:v('salePrice'),p_shipping_charged:v('saleShippingCharged'),p_shipping_cost:v('saleShippingCost'),p_unit_cost:$('saleUnitCost').value===''?null:v('saleUnitCost'),p_other_cost:v('saleOtherCost'),p_note:$('saleNote').value.trim()};const {error}=await client.rpc('manila_record_sale',payload);if(error)throw error;await refresh();await renderSales();$('saleForm').reset();$('saleQty').value=1;$('saleShippingCharged').value=0;$('saleShippingCost').value=0;$('saleOtherCost').value=0;updateSaleEstimate();notice('Vendita registrata: magazzino aggiornato.');}catch(err){notice(err.message,true);}};

let movementsAll=[];
 const movementFiltered=()=>movementsAll.filter(m=>{const filter=$('movementFilter').value,day=m.created_at.slice(0,10);return (filter==='all'||filter==='in'&&m.change>0||filter==='out'&&m.change<0)&&(!$('movementFrom').value||day>=$('movementFrom').value)&&(!$('movementTo').value||day<=$('movementTo').value);});
 async function renderMovements(){const {data,error}=await client.from('manila_stock_movements').select('*').order('created_at',{ascending:false}).limit(3000);if(error){$('movementRows').innerHTML='<tr><td colspan="6">Registro non disponibile: '+safe(error.message)+'</td></tr>';return;}movementsAll=data||[];paintMovements();}
 function paintMovements(){const shown=movementFiltered(),qtyIn=shown.reduce((n,m)=>n+Math.max(0,m.change),0),qtyOut=shown.reduce((n,m)=>n+Math.max(0,-m.change),0);
 $('movementSummary').innerHTML=[['Entrate (pezzi)',qtyIn],['Uscite (pezzi)',qtyOut],['Movimenti',shown.length]].map(([name,v])=>'<div class="inventory-stat"><strong>'+v+'</strong><span>'+name+'</span></div>').join('');
 $('movementRows').innerHTML=shown.map(m=>{const product=rows.find(p=>p.id===m.product_id);return '<tr><td>'+safe(new Date(m.created_at).toLocaleString('it-IT'))+'</td><td>'+safe(product?product.code+' — '+product.name:'Articolo non più disponibile')+'</td><td>'+safe(m.size)+'</td><td>'+(m.change>0?m.change:'—')+'</td><td>'+(m.change<0?-m.change:'—')+'</td><td>'+safe(m.note)+'</td></tr>';}).join('')||'<tr><td colspan="6">Nessun movimento registrato</td></tr>';
 }
 for(const field of ['movementFilter','movementFrom','movementTo'])$(field).addEventListener('change',paintMovements);
 $('movementCsv').onclick=()=>csv('darklab-movimenti.csv',['Data','Codice','Nome','Taglia','Entrata','Uscita','Causale'],movementFiltered().map(m=>{const p=rows.find(p=>p.id===m.product_id);return [m.created_at,p?.code||'',p?.name||'',m.size,Math.max(0,m.change),Math.max(0,-m.change),m.note];}));
 function printSection(id){document.body.dataset.print=id;window.print();}
 $('inventoryPrint').onclick=()=>printSection('overview');
 $('movementPrint').onclick=()=>printSection('movimenti-globali');
 $('salesPrint').onclick=()=>printSection('salesPanel');
 window.addEventListener('afterprint',()=>{delete document.body.dataset.print;});

 let gifts=[];
 async function renderGifts(){const {data,error}=await client.from('manila_gifts').select('*').order('created_at',{ascending:false}).limit(1000);if(error){$('giftRows').innerHTML='<tr><td colspan="6">Per attivare gli omaggi, esegui supabase/inventory.sql.</td></tr>';return;}gifts=data||[];const count=gifts.reduce((n,g)=>n+g.quantity,0),shipping=gifts.reduce((n,g)=>n+Number(g.shipping_cost),0),known=gifts.filter(g=>g.unit_cost!==null),cost=known.reduce((n,g)=>n+g.quantity*Number(g.unit_cost),0);
 $('giftStats').innerHTML=[['Omaggi consegnati',count],['Incassi omaggi',euro(0)],['Spedizioni pagate',euro(shipping)],['Costo dei capi '+(known.length===gifts.length?'':'parziale'),known.length===gifts.length?euro(cost):'Da completare']].map(([name,val])=>'<div class="inventory-stat"><strong>'+safe(val)+'</strong><span>'+name+'</span></div>').join('');
 $('giftRows').innerHTML=gifts.map(g=>'<tr><td>'+safe(new Date(g.created_at).toLocaleDateString('it-IT'))+'</td><td>'+safe(g.product_code)+' / '+safe(g.size)+'</td><td>'+g.quantity+'</td><td>€0</td><td>'+(g.unit_cost===null?'Non noto':euro(g.quantity*g.unit_cost+Number(g.shipping_cost)))+'</td><td>'+safe(g.recipient)+' '+safe(g.note)+'</td></tr>').join('')||'<tr><td colspan="6">Nessun omaggio registrato</td></tr>';
 }
 $('giftsCsv').onclick=()=>csv('darklab-omaggi.csv',['Data','Codice','Taglia','Quantità','Incasso','Costo unitario','Spedizione','Destinatario','Note'],gifts.map(g=>[g.created_at,g.product_code,g.size,g.quantity,0,g.unit_cost??'',g.shipping_cost,g.recipient,g.note]));
 $('giftsPrint').onclick=()=>printSection('giftsPanel');
 $('giftForm').onsubmit=async e=>{e.preventDefault();try{const p=rows.find(r=>r.id===$('giftProduct').value);if(!p)throw Error('Seleziona un prodotto.');const {error}=await client.rpc('manila_record_gift',{p_product_id:p.id,p_size:$('giftSize').value.trim(),p_quantity:Number($('giftQty').value),p_unit_cost:$('giftCost').value===''?null:Number($('giftCost').value),p_shipping_cost:Number($('giftShipping').value),p_recipient:$('giftRecipient').value.trim(),p_note:$('giftNote').value.trim()});if(error)throw error;await refresh();$('giftForm').reset();$('giftQty').value=1;$('giftShipping').value=0;notice('Omaggio registrato: €0 incassati, giacenza scaricata.');}catch(err){notice(err.message,true);}};

 const views=['home','products','stockhub','inventory','movements','saleshub','sales','gifts','shopsettings','promotions','themes','sections','homephotos','legal','texts','labels','weborders','returns'];
 const parentView={inventory:'stockhub',labels:'stockhub',movements:'stockhub',sales:'saleshub',gifts:'saleshub',weborders:'saleshub',returns:'saleshub',promotions:'shopsettings',themes:'shopsettings',sections:'shopsettings',homephotos:'shopsettings',legal:'shopsettings',texts:'shopsettings',products:'home',stockhub:'home',saleshub:'home',shopsettings:'home'};
 const viewTitle={home:'Home',products:'Articoli',stockhub:'Magazzino',inventory:'Disponibilità e riordini',labels:'Cartellini e scansione',movements:'Entrate e uscite',saleshub:'Vendite',sales:'Registra vendita',gifts:'Omaggi',weborders:'Ordini dal sito',returns:'Resi',shopsettings:'Negozio online',promotions:'Promozioni',themes:'Aspetto del sito',sections:'Sezioni visibili',homephotos:'Foto della Home',legal:'Privacy e Cookie',texts:'Testi del sito'};
 function showView(v){if(!views.includes(v))v='home';
  document.querySelectorAll('[data-panel]').forEach(el=>el.hidden=el.dataset.panel!==v);
  document.querySelectorAll('.manager-tabs [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===v||b.dataset.view===(parentView[v]||'')));
  document.body.dataset.managerView=v;
  $('managerPageTitle').textContent=v==='home'?'':viewTitle[v];
  $('managerBack').hidden=v==='home';
  location.hash=v;
  window.scrollTo({top:0,behavior:'instant'});
 }
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
 $('managerBack').onclick=()=>showView(parentView[document.body.dataset.managerView]||'home');
 window.addEventListener('hashchange',()=>{const v=location.hash.slice(1);if(views.includes(v)&&document.body.dataset.managerView!==v)showView(v);});
 async function loadPromo(){const r=await client.from('manila_promotions').select('*').eq('id',1).maybeSingle();if(r.error){$('promoPreview').textContent='Esegui prima supabase/promotions.sql';return;}const p=r.data||{};$('promoName').value=p.name||'';$('promoPercent').value=p.percent||0;$('promoActive').checked=!!p.active;$('promoKind').value=p.kind||'percent';$('promoScope').value=p.scope||'all';}
 $('promoForm').onsubmit=async e=>{e.preventDefault();const percent=Number($('promoPercent').value),name=$('promoName').value.trim(),active=$('promoActive').checked;if(!Number.isInteger(percent)||percent<0||percent>100||active&&!name){notice('Inserisci un nome e uno sconto da 0 a 100.',true);return;}const r=await client.from('manila_promotions').upsert({id:1,name,percent,active,kind:$('promoKind').value,scope:$('promoScope').value});notice(r.error?r.error.message:'Promozione salvata.',!!r.error);};
 const themePalettes={original:['#222625','#d6ed45'],christmas:['#16352c','#f2c36a'],halloween:['#271b30','#ff973b'],pride:['#22243c','#e975af'],special:['#142e38','#73e5ee']};
 async function loadTheme(){const {data,error}=await client.from('manila_theme_settings').select('*').eq('id',1).maybeSingle();if(error){$('themeStatus').textContent='Per utilizzare i temi esegui supabase/themes.sql su Supabase.';return;}const t=data||{};$('themeChoice').value=t.theme||'original';$('themeHeadline').value=t.headline||'';$('themeEnabled').checked=!!t.enabled;const local=v=>v?new Date(new Date(v).getTime()-new Date(v).getTimezoneOffset()*60000).toISOString().slice(0,16):'';$('themeStart').value=local(t.starts_at);$('themeEnd').value=local(t.ends_at);$('themeBackground').value=t.background_color||themePalettes[$('themeChoice').value][0];$('themeAccent').value=t.accent_color||themePalettes[$('themeChoice').value][1];previewTheme();}
 function previewTheme(){const colors=[$('themeBackground').value,$('themeAccent').value];$('themePreview').style.background=colors[0];$('themePreview').style.color=colors[1];$('themePreview').textContent=($('themeHeadline').value.trim()||'MANILA DARK LAB')+' — '+$('themeChoice').selectedOptions[0].text;}
 function resetThemeColors(){const colors=themePalettes[$('themeChoice').value];$('themeBackground').value=colors[0];$('themeAccent').value=colors[1];previewTheme();}
 $('themeChoice').addEventListener('change',resetThemeColors);$('themeResetColors').addEventListener('click',resetThemeColors);
 for(const id of ['themeHeadline','themeBackground','themeAccent'])$(id).addEventListener('input',previewTheme);
 $('themeForm').addEventListener('submit',async e=>{e.preventDefault();try{const start=$('themeStart').value,end=$('themeEnd').value;if(start&&end&&new Date(end)<=new Date(start))throw Error('La data di fine deve essere successiva a quella iniziale.');const {error}=await client.from('manila_theme_settings').upsert({id:1,theme:$('themeChoice').value,headline:$('themeHeadline').value.trim(),background_color:$('themeBackground').value,accent_color:$('themeAccent').value,enabled:$('themeEnabled').checked,starts_at:start?new Date(start).toISOString():null,ends_at:end?new Date(end).toISOString():null,updated_at:new Date().toISOString()});if(error)throw error;$('themeStatus').textContent='Tema salvato. Sarà visibile sul sito negli orari scelti.';}catch(err){$('themeStatus').textContent=err.message;}});
 async function loadSections(){const {data,error}=await client.from('manila_sections').select('*');if(error){$('sectionToggles').textContent='Esegui supabase/complete-manager.sql per abilitare questa funzione.';return;}const items=['man','woman','kids','outlet'];const labels={man:'Uomo',woman:'Donna',kids:'Bambini',outlet:'Outlet'};$('sectionToggles').innerHTML=items.map(id=>{const row=(data||[]).find(r=>r.section===id);return '<label class="section-toggle"><input type="checkbox" data-section="'+id+'" '+(row?.visible?'checked':'')+'> Mostra '+labels[id]+' nel sito</label>';}).join('');}
 $('saveSections').onclick=async()=>{try{for(const el of $('sectionToggles').querySelectorAll('[data-section]')){const {error}=await client.from('manila_sections').update({visible:el.checked}).eq('section',el.dataset.section);if(error)throw error;}notice('Sezioni del negozio aggiornate.');}catch(e){notice(e.message,true);}};
 const homeCards=[['man','Uomo','ambient-industrial.jpg'],['woman','Donna','woman-tee-tarot.jpg'],['kids','Kids','']];
 let homePhotosConfig={};
 const homeInputs={};
async function loadSiteTexts(){
 const save=$('saveSiteTexts');save.disabled=true;$('siteTextStatus').textContent='Caricamento testi…';
 try{
  const defs=window.MANILA_SITE_TEXT_FIELDS||{};
  let markup='';
  const titles={home:'Home',shop:'Shop',man:'Uomo',woman:'Donna',kids:'Kids',product:'Scheda prodotto'};
  for(const [page,fields] of Object.entries(defs)){
   const path=page==='home'?'index.html':page+'.html';
   const res=await fetch(path,{cache:'no-store'});if(!res.ok)throw Error('Non riesco a leggere '+path);
   const doc=new DOMParser().parseFromString(await res.text(),'text/html');
   markup+='<h3>'+titles[page]+'</h3>';
   for(const [key,selector,label] of fields){
    const el=doc.querySelector(selector);
    const fallback=(el?.textContent||'').replace(/\\s+/g,' ').trim().replace(/↗$/,'').trim();
    markup+='<label class="site-text-row"><span>'+safe(label)+'</span><textarea rows="2" data-text-key="'+safe(key)+'" placeholder="'+safe(fallback)+'"></textarea></label>';
   }
  }
  $('siteTextFields').innerHTML=markup;
  const {data,error}=await client.from('manila_site_texts').select('key,value');
  if(error)throw Error('Per attivare i testi esegui supabase/site-texts.sql su Supabase. '+error.message);
  for(const row of data||[]){const field=Array.from(document.querySelectorAll('[data-text-key]')).find(e=>e.dataset.textKey===row.key);if(field)field.value=row.value;}
  save.disabled=false;$('siteTextStatus').textContent='Modifica i campi che vuoi cambiare e premi Salva.';
 }catch(err){$('siteTextStatus').textContent=err.message;}
}
$('saveSiteTexts').onclick=async()=>{const btn=$('saveSiteTexts');btn.disabled=true;try{
 const entries=[...document.querySelectorAll('[data-text-key]')].filter(e=>e.value.trim()).map(e=>({key:e.dataset.textKey,value:e.value.trim(),updated_at:new Date().toISOString()}));
 if(!entries.length)throw Error('Inserisci almeno un testo da personalizzare.');
 const {error}=await client.from('manila_site_texts').upsert(entries);if(error)throw error;
 $('siteTextStatus').textContent='Testi salvati. Ricarica il negozio per vedere le modifiche.';
}catch(err){$('siteTextStatus').textContent=err.message;}finally{btn.disabled=false;}};
async function loadLegal(){
  const save=$('legalSave');save.disabled=true;$('legalStatus').textContent='Caricamento informative…';
  try{
   for(const [slug,id,file] of [['privacy','legalPrivacy','privacy.html'],['cookies','legalCookies','cookies.html']]){
    const res=await fetch(file,{cache:'no-store'});if(!res.ok)throw Error('Non riesco a caricare '+file);
    const html=await res.text();const doc=new DOMParser().parseFromString(html,'text/html');
    $(id).value=doc.getElementById('legalFallback')?.textContent?.trim()||'';
   }
   const {data,error}=await client.from('manila_legal_pages').select('slug,content');
   if(error)throw new Error('Esegui supabase/legal-pages.sql su Supabase. '+error.message);
   for(const item of data||[]){const id=item.slug==='privacy'?'legalPrivacy':item.slug==='cookies'?'legalCookies':null;if(id&&item.content)$(id).value=item.content;}
   save.disabled=false;$('legalStatus').textContent='Le informative sono pronte. Salva per pubblicare le modifiche.';
  }catch(err){$('legalStatus').textContent=err.message;}
 }
 $('legalSave').onclick=async()=>{
  $('legalSave').disabled=true;
  try{
   for(const [slug,id] of [['privacy','legalPrivacy'],['cookies','legalCookies']]){
    const content=$(id).value.trim();if(content.length<150)throw Error('Testo troppo breve per '+slug+'.');
    const {error}=await client.from('manila_legal_pages').upsert({slug,content,updated_at:new Date().toISOString()});if(error)throw error;
   }
   $('legalStatus').textContent='Informative aggiornate. Sono ora visibili sul sito.';
  }catch(err){$('legalStatus').textContent='Impossibile salvare: '+err.message;}
  finally{$('legalSave').disabled=false;}
 };
  async function loadHomePhotos(){
  $('saveHomePhotos').disabled=true;
  $('homePhotosStatus').textContent='Caricamento immagini in corso…';
  const {data,error}=await client.from('manila_home_photos').select('*');
  if(error){$('homePhotosStatus').textContent='Impossibile caricare le immagini. Verifica che supabase/home-photos.sql sia stato eseguito su Supabase. Dettaglio: '+error.message;return;}
  homePhotosConfig=Object.fromEntries((data||[]).map(item=>[item.section,item.image_url]));
  $('homePhotosGrid').innerHTML=homeCards.map(([key,name,fallback])=>'<div class="home-photo-card"><h3>'+name+'</h3><img id="homePreview_'+key+'" src="'+safe(homePhotosConfig[key]||fallback||'logo-manila-dark-lab.jpeg')+'" alt="Foto '+name+'"><label>Scegli una nuova foto<input type="file" accept="image/jpeg,image/png,image/webp" id="homeFile_'+key+'"></label><button type="button" class="secondary" data-restore-home="'+key+'">Ripristina foto originale</button></div>').join('');
  $('homePhotosStatus').textContent='Seleziona le foto da cambiare e premi Salva.';
  $('saveHomePhotos').disabled=false;
  for(const [key] of homeCards){const input=$('homeFile_'+key);input.onchange=()=>{const f=input.files[0];if(f){const img=$('homePreview_'+key);if(img.dataset.previewUrl)URL.revokeObjectURL(img.dataset.previewUrl);img.dataset.previewUrl=URL.createObjectURL(f);img.src=img.dataset.previewUrl;}};}
 }
 $('homePhotosGrid').onclick=e=>{const b=e.target.closest('[data-restore-home]');if(!b)return;const key=b.dataset.restoreHome;homePhotosConfig[key]=null;$('homeFile_'+key).value='';const img=$('homePreview_'+key);if(img.dataset.previewUrl)URL.revokeObjectURL(img.dataset.previewUrl);img.src=homeCards.find(c=>c[0]===key)[2]||'logo-manila-dark-lab.jpeg';};
 $('saveHomePhotos').onclick=async()=>{try{
  $('saveHomePhotos').disabled=true;
  for(const [key] of homeCards){
   const field=$('homeFile_'+key);if(!field)throw Error('La pagina non è ancora pronta. Ricaricala e riprova.');const file=field.files[0];
   if(file)homePhotosConfig[key]=await upload(file);
   const {error}=await client.from('manila_home_photos').upsert({section:key,image_url:homePhotosConfig[key]||null,updated_at:new Date().toISOString()});
   if(error)throw error;
  }
  $('homePhotosStatus').textContent='Foto della Home salvate. Aggiorna il negozio per vedere le modifiche.';
  await loadHomePhotos();
 }catch(err){$('homePhotosStatus').textContent='Impossibile salvare: '+err.message;}finally{$('saveHomePhotos').disabled=false;}};

 const code39Patterns={
  '0':'nnnwwnwnn','1':'wnnwnnnnw','2':'nnwwnnnnw','3':'wnwwnnnnn','4':'nnnwwnnnw','5':'wnnwwnnnn','6':'nnwwwnnnn','7':'nnnwnnwnw','8':'wnnwnnwnn','9':'nnwwnnwnn',
  'A':'wnnnnwnnw','B':'nnwnnwnnw','C':'wnwnnwnnn','D':'nnnnwwnnw','E':'wnnnwwnnn','F':'nnwnwwnnn','G':'nnnnnwwnw','H':'wnnnnwwnn','I':'nnwnnwwnn','J':'nnnnwwwnn',
  'K':'wnnnnnnww','L':'nnwnnnnww','M':'wnwnnnnwn','N':'nnnnwnnww','O':'wnnnwnnwn','P':'nnwnwnnwn','Q':'nnnnnnwww','R':'wnnnnnwwn','S':'nnwnnnwwn','T':'nnnnwnwwn',
  'U':'wwnnnnnnw','V':'nwwnnnnnw','W':'wwwnnnnnn','X':'nwnnwnnnw','Y':'wwnnwnnnn','Z':'nwwnwnnnn','-':'nwnnnnwnw','*':'nwnnwnwnn'
 };
 function barcode39(value){
  let x=8,rects='';
  for(const character of '*'+value+'*'){
   const pattern=code39Patterns[character];
   if(!pattern)throw Error('Codice non supportato: '+character);
   for(let i=0;i<9;i++){const w=pattern[i]==='w'?5:2;if(i%2===0)rects+='<rect x="'+x+'" y="0" width="'+w+'" height="70"/>';x+=w;}x+=3;
  }
  return '<svg viewBox="0 0 '+(x+8)+' 70" xmlns="http://www.w3.org/2000/svg">'+rects+'</svg>';
 }
 function refreshLabelSizes(){
  const p=rows.find(r=>r.id===$('labelProduct').value),sizes=Object.keys(p?.sizes||{});
  $('labelSize').innerHTML=(sizes.length?sizes:['UNICA']).map(size=>'<option value="'+safe(size)+'">'+safe(size)+'</option>').join('');
 }
 function refreshLabelOptions(){
  const el=$('labelProduct'),previous=el.value;
  el.innerHTML=rows.map(p=>'<option value="'+safe(p.id)+'">'+safe(p.code+' — '+p.name)+'</option>').join('');
  if(rows.some(p=>p.id===previous))el.value=previous;
  refreshLabelSizes();
 }
 $('labelProduct').addEventListener('change',refreshLabelSizes);
 $('labelPrint').onclick=()=>{
  try{
   const p=rows.find(r=>r.id===$('labelProduct').value);if(!p)throw Error('Seleziona un articolo.');
   const size=$('labelSize').value||'UNICA',count=Math.max(1,Math.min(100,parseInt($('labelCopies').value,10)||1));
   const normalizedSize=size.toUpperCase().replace(/[^A-Z0-9-]/g,'');
   const sku=p.code+'-'+normalizedSize;
   const bars=barcode39(sku);
   const logo=new URL('logo-manila-dark-lab.jpeg',location.href).href;
   const cards=Array.from({length:count},()=>'<article class="ticket"><img class="logo" src="'+safe(logo)+'" alt="Logo Manila Dark Lab"><strong class="name">'+safe(p.name)+'</strong><span>Taglia '+safe(size)+(p.color?' · '+safe(p.color):'')+'</span>'+bars+'<strong class="code">'+safe(sku)+'</strong><strong class="price">'+euro(p.price)+'</strong></article>').join('');
   const css='@page{size:A4;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111}.sheet{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm}.ticket{border:1px dashed #aaa;height:79mm;padding:5mm;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;break-inside:avoid}.logo{max-width:75%;height:20mm;object-fit:contain}.name{font-size:13px}.ticket span,.code{font-size:11px}.ticket svg{width:100%;height:17mm}.price{font-size:18px}';
   const w=window.open('','_blank');if(!w)throw Error('Abilita i popup per stampare.');
   w.document.write('<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Cartellini Manila</title><style>'+css+'</style></head><body><div class="sheet">'+cards+'</div></body></html>');
   w.document.close();
   w.addEventListener('load',()=>{setTimeout(()=>w.print(),400)},{once:true});
   $('labelResult').textContent='Cartellini generati. Scegli la stampante nella nuova finestra.';
  }catch(err){$('labelResult').textContent=err.message;}
 };
 function findLabel(){
  const scanned=$('labelLookup').value.trim().toUpperCase();
  const p=rows.find(r=>scanned===r.code||scanned.startsWith(r.code+'-'));
  if(!p){$('labelResult').textContent='Nessun articolo trovato: controlla il codice.';return;}
  const size=scanned.startsWith(p.code+'-')?scanned.slice(p.code.length+1):'';
  $('labelResult').innerHTML='<strong>'+safe(p.name)+'</strong> · '+safe(p.code)+' · '+safe(size||'Tutte le taglie')+' · '+euro(p.price)+'<p><button type="button" id="labelOpenProduct">Apri articolo</button></p>';
  $('labelOpenProduct').onclick=()=>{showView('products');openArticle(p);};
 }
 $('labelFind').onclick=findLabel;
 $('labelLookup').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();findLabel();}});

 function populateReturnProducts(){const el=$('returnProduct'),previous=el.value;el.innerHTML=rows.map(p=>'<option value="'+safe(p.id)+'">'+safe(p.code+' — '+p.name)+'</option>').join('');if(rows.some(p=>p.id===previous))el.value=previous;}
 const scanInput=$('globalScan'),scanResults=$('globalScanResult');
 function lookupScan(){
  const q=scanInput.value.trim().toUpperCase();
  if(!q){scanResults.textContent='';return;}
  const found=rows.filter(p=>p.code.toUpperCase()===q||q.startsWith(p.code.toUpperCase()+'-')||p.name.toUpperCase().includes(q)).slice(0,7);
  scanResults.innerHTML=found.length?found.map(p=>'<button type="button" class="scan-result" data-scan-id="'+safe(p.id)+'">'+safe(p.code+' · '+p.name)+'</button>').join(''):'Nessun articolo trovato';
  if(found.length===1&&(q===found[0].code.toUpperCase()||q.startsWith(found[0].code.toUpperCase()+'-')))selectScanned(found[0],q);
 }
 function selectScanned(p,q){
  let size=q.startsWith(p.code.toUpperCase()+'-')?q.slice(p.code.length+1):'';
  for(const [select,sizeInput] of [['saleProduct','saleSize'],['giftProduct','giftSize'],['returnProduct','returnSize']]){$(select).value=p.id;if(size&&$(sizeInput))$(sizeInput).value=size;}
  $('labelProduct').value=p.id;refreshLabelSizes();
  if(size&&Array.from($('labelSize').options).some(o=>o.value.toUpperCase()===size))$('labelSize').value=Array.from($('labelSize').options).find(o=>o.value.toUpperCase()===size).value;
  $('search').value=p.code;paint();$('categoryFilter').value='';
  scanResults.innerHTML='<strong>'+safe(p.code+' — '+p.name)+'</strong> · '+safe(size||'Tutte le taglie')+'<p><button type="button" id="scanOpen">Apri articolo</button> <button type="button" id="scanSale">Vendita</button> <button type="button" id="scanReturn">Reso</button> <button type="button" id="scanGift">Omaggio</button> <button type="button" id="scanMovement">Carico / scarico</button></p>';
  $('scanOpen').onclick=()=>{showView('products');openArticle(p);};
  $('scanSale').onclick=()=>showView('sales');$('scanReturn').onclick=()=>showView('returns');$('scanGift').onclick=()=>showView('gifts');$('scanMovement').onclick=()=>{showView('products');openArticle(p);if(size)$('movementSize').value=size;$('movementForm').scrollIntoView({behavior:'smooth',block:'center'});};
 }
 scanInput.addEventListener('input',lookupScan);
 scanInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lookupScan();}});
 scanResults.addEventListener('click',e=>{const b=e.target.closest('[data-scan-id]');if(!b)return;const p=rows.find(r=>r.id===b.dataset.scanId);if(p)selectScanned(p,scanInput.value.trim().toUpperCase());});
 async function loadReturns(){const {data,error}=await client.from('manila_returns').select('*').order('created_at',{ascending:false}).limit(100);$('returnHistory').innerHTML=error?'<p>Attiva supabase/returns.sql: '+safe(error.message)+'</p>':(data||[]).map(r=>'<p>'+safe(new Date(r.created_at).toLocaleString('it-IT'))+' · '+safe(r.product_code)+' · '+safe(r.size)+' × '+r.quantity+' · '+(r.condition==='restock'?'Rimesso in magazzino':'Non rivendibile')+' · '+safe(r.reason)+'</p>').join('')||'<p>Nessun reso registrato.</p>';}
 $('returnForm').addEventListener('submit',async e=>{e.preventDefault();const b=e.submitter;if(b)b.disabled=true;try{
  const params={p_product_id:$('returnProduct').value,p_size:$('returnSize').value.trim(),p_quantity:Number($('returnQty').value),p_condition:$('returnCondition').value,p_reference:$('returnReference').value.trim(),p_reason:$('returnReason').value.trim(),p_refund:Number($('returnRefund').value)};
  const {error}=await client.rpc('manila_record_return',params);if(error)throw error;
  $('returnStatus').textContent='Reso registrato. '+(params.p_condition==='restock'?'Magazzino aggiornato.':'Nessuna variazione delle scorte.')+' Il rimborso non viene eseguito automaticamente.';
  await refresh();await loadReturns();
 }catch(err){$('returnStatus').textContent=err.message;}finally{if(b)b.disabled=false;}});
 const orderEsc=safe;
 async function loadWebOrders(){
  $('webOrdersStatus').textContent='Caricamento…';
  const {data,error}=await client.from('manila_web_orders').select('*').order('created_at',{ascending:false}).limit(100);
  if(error){$('webOrdersStatus').textContent='Attiva supabase/web-orders.sql. '+error.message;return;}
  $('webOrdersStatus').textContent=(data||[]).length+' richieste dal sito';
  $('webOrdersList').innerHTML=(data||[]).map(o=>'<article class="web-order" data-order="'+safe(o.id)+'"><h3>'+orderEsc(o.customer_name)+' · '+orderEsc(o.id.slice(0,8).toUpperCase())+'</h3><p>'+orderEsc(new Date(o.created_at).toLocaleString('it-IT'))+' · '+orderEsc(o.customer_email)+' · '+orderEsc(o.customer_phone)+'</p><p>'+orderEsc(o.address_line+' '+(o.address_extra||'')+', '+o.postal_code+' '+o.city+' '+(o.province||'')+' — '+o.country)+'</p><p>Pagamento preferito: '+orderEsc(o.payment_preference)+' · Totale indicativo: '+euro(o.requested_total)+'</p><p>'+((o.items||[]).map(i=>orderEsc(i.name+' '+i.size+' × '+i.quantity)).join(' · '))+'</p><label>Stato <select class="order-status">'+['da_verificare','contattato','confermato','spedito','annullato'].map(s=>'<option value="'+s+'" '+(s===o.status?'selected':'')+'>'+s.replaceAll('_',' ')+'</option>').join('')+'</select></label><label>Pagamento <select class="order-payment">'+['non_pagato','in_attesa','verificato'].map(s=>'<option value="'+s+'" '+(s===o.payment_status?'selected':'')+'>'+s.replaceAll('_',' ')+'</option>').join('')+'</select></label><label>Tracciamento <input class="order-tracking" value="'+orderEsc(o.tracking_code||'')+'" maxlength="100"></label><button type="button" class="order-save">Salva stato</button><button type="button" class="order-label">Stampa indirizzo</button><p class="order-feedback"></p></article>').join('')||'<p>Nessuna richiesta.</p>';
  $('webOrdersList').querySelectorAll('.web-order').forEach((node,index)=>{const o=data[index];node.querySelector('.order-save').onclick=async()=>{const patch={status:node.querySelector('.order-status').value,payment_status:node.querySelector('.order-payment').value,tracking_code:node.querySelector('.order-tracking').value.trim()};const {error}=await client.from('manila_web_orders').update(patch).eq('id',o.id);node.querySelector('.order-feedback').textContent=error?error.message:'Stato salvato. Ricorda di registrare la vendita e lo scarico magazzino separatamente.';};node.querySelector('.order-label').onclick=()=>{const w=window.open('','_blank');if(!w){node.querySelector('.order-feedback').textContent='Permetti le finestre popup';return;}w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Etichetta indirizzo</title><style>body{font:18px Arial;padding:35px;max-width:650px}.label{border:2px solid black;padding:24px}h2{margin:0 0 15px}</style></head><body><div class="label"><h2>MANILA DARK LAB · DESTINATARIO</h2><strong>'+orderEsc(o.customer_name)+'</strong><p>'+orderEsc(o.address_line)+' '+orderEsc(o.address_extra||'')+'</p><p>'+orderEsc(o.postal_code)+' '+orderEsc(o.city)+' '+orderEsc(o.province||'')+'</p><p>'+orderEsc(o.country)+'</p><p>Tel: '+orderEsc(o.customer_phone)+'</p><small>Richiesta '+orderEsc(o.id.slice(0,8).toUpperCase())+' · Non è un etichetta del corriere</small></div></body></html>');w.document.close();w.focus();w.print();};});
 }
 $('webOrdersReload').onclick=loadWebOrders;
 function paint(){const q=$('search').value.trim().toLowerCase(),cat=$('categoryFilter').value;
  const filtered=rows.filter(r=>(!cat||r.category===cat)&&(!q||(r.name+' '+r.code).toLowerCase().includes(q)));
  $('list').innerHTML=filtered.map(r=>'<article class="product-tile"><img src="'+safe(r.image_url||'logo-manila-dark-lab.jpeg')+'" alt="Foto di '+safe(r.name)+'"><div class="tile-details"><strong>'+safe(r.name)+'</strong><span>'+safe(label(r.category))+' · '+euro(r.price)+'</span><span>'+Object.values(r.sizes||{}).reduce((a,n)=>a+Number(n||0),0)+' capi in magazzino</span><span class="tile-status">'+(r.published?'Visibile nel negozio':'Nascosto ai clienti')+'</span><div class="tile-actions"><button type="button" data-id="'+safe(r.id)+'" class="edit-item">✎ Modifica</button><button type="button" data-delete-id="'+safe(r.id)+'" class="tile-delete">Elimina</button></div></div></article>').join('')||'<p>Nessun articolo trovato. Prova a cambiare filtro.</p>';
 }
 function openArticle(p){fill(p);$('editor').hidden=false;document.querySelector('[data-panel="products"] > section:first-child').hidden=true;window.scrollTo({top:0,behavior:'smooth'});}
 function closeArticle(){$('editor').hidden=true;document.querySelector('[data-panel="products"] > section:first-child').hidden=false;current=null;window.scrollTo({top:0,behavior:'smooth'});}
 $('backToProducts').onclick=closeArticle;
 function updatePhotoGallery(){
 $('photoGallery').innerHTML=editingImages.map((src,i)=>'<div class="gallery-photo"><img src="'+safe(src)+'" alt="Foto '+(i+1)+'"><button type="button" data-cover="'+i+'">'+(i===0?'✓ Questa è la foto principale':'Imposta come foto principale')+'</button><button type="button" data-remove="'+i+'" class="secondary">Rimuovi foto</button></div>').join('')||'<p>Nessuna foto caricata.</p>';
 }
 $('photoGallery').onclick=e=>{const cover=e.target.closest('[data-cover]'),remove=e.target.closest('[data-remove]');if(cover){const i=Number(cover.dataset.cover);editingImages.unshift(editingImages.splice(i,1)[0]);updatePhotoGallery();}if(remove){editingImages.splice(Number(remove.dataset.remove),1);updatePhotoGallery();}};
 function showVideo(){const preview=$('videoPreview');preview.innerHTML='';if(editingVideo){const video=document.createElement('video');video.src=editingVideo;video.controls=true;video.playsInline=true;video.preload='metadata';preview.appendChild(video);}$('removeVideo').hidden=!editingVideo;}
 $('removeVideo').onclick=()=>{editingVideo=null;$('productVideo').value='';showVideo();};
 function fill(p){current=p?.id||null;editingVideo=p?.video_url||null;$('productVideo').value='';showVideo();editingImages=Array.isArray(p?.images)&&p.images.length?p.images.slice(0,3):(p?.image_url?[p.image_url]:[]);updatePhotoGallery();$('editorTitle').textContent=p?'Modifica '+p.code:'Nuovo prodotto';$('category').value=p?.category||'man';$('kind').value=p?.kind||'tee';$('code').value=p?.code||'';$('name').value=p?.name||'';$('price').value=p?.price??19.90;$('description').value=p?.description||'';$('productColor').value=p?.color||'';$('productMaterial').value=p?.material||'';$('productFit').value=p?.fit||'';$('image_url').value=p?.image_url||'';$('sizes').value=Object.entries(p?.sizes||{}).map(([s,n])=>s+':'+n).join('\n');$('published').checked=!!p?.published;$('featured').checked=!!p?.featured;$('outlet').checked=!!p?.outlet;$('deleteProduct').hidden=!p;$('movements').textContent='';if(p)history(p.id);}
 async function history(id){const {data}=await client.from('manila_stock_movements').select('*').eq('product_id',id).order('created_at',{ascending:false}).limit(15);$('movements').innerHTML=(data||[]).map(m=>'<div>'+safe(new Date(m.created_at).toLocaleString('it-IT'))+' · '+safe(m.size)+' · '+safe(m.change>0?'+':'')+safe(m.change)+' · '+safe(m.note)+'</div>').join('');}
 async function upload(file){if(!file)return null;if(file.size>10485760||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Foto non valida (max 10 MB, JPG/PNG/WebP).');const ext=file.name.split('.').pop().toLowerCase();const path='products/'+crypto.randomUUID()+'.'+ext;const {error}=await client.storage.from('manila-products').upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;return client.storage.from('manila-products').getPublicUrl(path).data.publicUrl;}
 $('loginForm').addEventListener('submit',async e=>{e.preventDefault();notice('Accesso in corso...');const {data,error}=await client.auth.signInWithPassword({email:$('email').value,password:$('password').value});if(error){notice(error.message,true);return;}user=data.user;try{await check();$('loginBox').hidden=true;$('app').hidden=false;$('identity').textContent=user.email;await refresh();closeArticle();await loadPromo();await loadTheme();await loadSections();await loadHomePhotos();await loadLegal();await loadSiteTexts();await loadReturns();await loadWebOrders();showView(location.hash.slice(1));notice('Accesso effettuato.');}catch(err){await client.auth.signOut();notice(err.message,true);}});
 $('logout').onclick=async()=>{await client.auth.signOut();location.reload();};
 $('newProduct').onclick=()=>openArticle(null);
 $('search').oninput=paint;$('categoryFilter').onchange=paint;
 async function deleteArticle(id){const p=rows.find(r=>r.id===id);if(!p)return;if(!confirm('Vuoi eliminare definitivamente '+p.name+'? Questa azione non può essere annullata.'))return;const {error}=await client.from('manila_products').update({archived:true,published:false,updated_at:new Date().toISOString()}).eq('id',p.id);if(error){notice('Impossibile eliminare: '+error.message,true);return;}await refresh();closeArticle();notice('Articolo archiviato: non è più visibile nel negozio e lo storico rimane conservato.');}
 $('list').onclick=e=>{const del=e.target.closest('[data-delete-id]');if(del){deleteArticle(del.dataset.deleteId);return;}const b=e.target.closest('[data-id]');if(b)openArticle(rows.find(r=>r.id===b.dataset.id));};
 $('productForm').addEventListener('submit',async e=>{e.preventDefault();try{if(!user)throw Error('Accedi prima.');let p=rows.find(r=>r.id===current);const sizes=getSizes();const selected=Array.from($('photo').files);if(editingImages.length+selected.length>3)throw Error('Massimo 3 foto per articolo. Rimuovi una foto prima di aggiungerne altre.');const uploaded=[];for(const file of selected)uploaded.push(await upload(file));const images=[...editingImages,...uploaded];const videoFile=$('productVideo').files[0];if(videoFile){if(videoFile.type!=='video/mp4'||videoFile.size>20*1024*1024)throw Error('Il video deve essere MP4 e non superare 20 MB.');const path='products/'+crypto.randomUUID()+'.mp4';const {error:videoError}=await client.storage.from('manila-products').upload(path,videoFile,{contentType:'video/mp4',upsert:false});if(videoError)throw videoError;editingVideo=client.storage.from('manila-products').getPublicUrl(path).data.publicUrl;}const next={name:$('name').value.trim(),category:$('category').value,kind:$('kind').value,price:Number($('price').value),description:$('description').value.trim(),color:$('productColor').value.trim(),material:$('productMaterial').value.trim(),fit:$('productFit').value.trim(),sizes,image_url:images[0]||$('image_url').value.trim()||null,images,video_url:editingVideo,published:$('published').checked,featured:$('featured').checked,outlet:$('outlet').checked,updated_at:new Date().toISOString()};if(!next.name)throw Error('Inserisci il nome.');if(p&&(p.category!==next.category||p.kind!==next.kind))throw Error('Categoria e tipo non modificabili su un articolo esistente: crea un nuovo codice.');let result;if(p){result=await client.from('manila_products').update(next).eq('id',p.id).select().single();}else{const pre=prefix(next.category,next.kind);
 const {data:allCodes,error:codeError}=await client.from('manila_products').select('code');
 if(codeError)throw codeError;
 const used=new Set((allCodes||[]).map(item=>item.code));
 let suffix=0;while(used.has(pre+String(suffix).padStart(2,'0')))suffix++;
 let candidate=pre+String(suffix).padStart(2,'0');
 result=await client.from('manila_products').insert({...next,code:candidate}).select().single();
 if(result.error&&result.error.code==='23505'){
   const retry=await client.from('manila_products').select('code');
   if(retry.error)throw retry.error;
   const all=new Set((retry.data||[]).map(item=>item.code));
   while(all.has(candidate)){suffix++;candidate=pre+String(suffix).padStart(2,'0');}
   result=await client.from('manila_products').insert({...next,code:candidate}).select().single();
 }}if(result.error)throw result.error;await refresh();closeArticle();notice('Prodotto salvato: '+result.data.code+'. Modifiche visibili nello shop.');}catch(err){notice(err.message,true);}});
 $('deleteProduct').onclick=async()=>{if(current)await deleteArticle(current);};
 $('movementForm').addEventListener('submit',async e=>{e.preventDefault();try{
 const p=rows.find(x=>x.id===current);if(!p)throw Error('Prima seleziona un articolo.');
 const size=$('movementSize').value.trim(),delta=Number($('movementDelta').value),note=$('movementNote').value.trim();
 if(!size||!Number.isInteger(delta)||delta===0)throw Error('Inserisci taglia e quantità: positiva per entrata, negativa per uscita.');
 if(!note)throw Error('Inserisci una causale (es. arrivo merce, campione, reso, perdita).');
 const {error}=await client.rpc('manila_apply_stock_movement',{p_product_id:p.id,p_size:size,p_change:delta,p_note:note});
 if(error)throw error;await refresh();fill(rows.find(x=>x.id===p.id));$('movementForm').reset();notice('Movimento registrato e giacenza aggiornata.');
 }catch(err){notice(err.message,true);}});
 const {data:{session}}=await client.auth.getSession();if(session?.user){user=session.user;try{await check();$('loginBox').hidden=true;$('app').hidden=false;$('identity').textContent=user.email;await refresh();fill(null);await loadPromo();await loadTheme();await loadSections();await loadHomePhotos();await loadLegal();await loadSiteTexts();await loadReturns();await loadWebOrders();showView(location.hash.slice(1));}catch(err){notice(err.message,true);}}
})();
