'use strict';
(async () => {
  // Live products load only after Supabase is configured; otherwise the existing catalog remains intact.
  const cfg=window.MANILA_SUPABASE||{};
  if(cfg.url&&cfg.anonKey){
    try {
      const response=await fetch(cfg.url.replace(/\/$/,'')+'/rest/v1/manila_products?select=*&published=eq.true&order=created_at.asc',{headers:{apikey:cfg.anonKey}});
      if(!response.ok)throw Error('Catalogo live non disponibile');
      const live=await response.json();
      // Keep the existing storefront intact until products have been published in Supabase.
      if(!Array.isArray(live))throw Error('Catalogo live non valido');
      window.MANILA_CATALOG={man:[],woman:[],kids:[]};
      for(const item of live){
        if(!window.MANILA_CATALOG[item.category])continue;
        if(item.archived)continue;const sizes=Object.keys(item.sizes||{}).filter(k=>Number(item.sizes[k])>0);
        window.MANILA_CATALOG[item.category].push({
          id:item.code,name:item.name,price:Number(item.price),image:item.image_url||'logo-manila-dark-lab.jpeg',gallery:Array.isArray(item.images)&&item.images.length?item.images:[item.image_url].filter(Boolean),outlet:!!item.outlet,
          sizes,fit:'Da confermare',material:'Da confermare',color:'',sku:item.code,
          description:item.description||'',type:item.kind,availability:sizes.length?'Disponibile':'Su richiesta'
        });
      }
    } catch(err){console.warn('Manila: catalogo statico di riserva',err);}
  }
  let promotion=null;
  if(cfg.url&&cfg.anonKey){try{const r=await fetch(cfg.url.replace(/\/$/,'')+'/rest/v1/manila_promotions?select=name,percent,scope,kind&active=eq.true&id=eq.1',{headers:{apikey:cfg.anonKey}});if(r.ok){const found=await r.json();if(found.length)promotion=found[0];}}catch(e){console.warn('Promozione non disponibile',e);}}
  let sectionVisibility={man:true,woman:true,kids:true,outlet:false};
  if(cfg.url&&cfg.anonKey){try{const res=await fetch(cfg.url.replace(/\/$/,'')+'/rest/v1/manila_sections?select=section,visible',{headers:{apikey:cfg.anonKey}});if(res.ok){for(const r of await res.json())sectionVisibility[r.section]=r.visible;}}catch(e){console.warn('Sezioni non disponibili',e);}}
  const isOutlet=new URLSearchParams(location.search).get('outlet')==='1';
  const catalog=window.MANILA_CATALOG||{};
  const products=Object.entries(catalog).flatMap(([group,items])=>items.map(p=>({...p,group,type:p.type||(/hoodie/i.test(p.name)?'hoodie':'tee'),originalPrice:Number(p.price),price:promotion&&promotion.kind!=='3x2'&&(promotion.scope==='all'||promotion.scope===group||promotion.scope==='outlet'&&p.outlet)?Math.round(Number(p.price)*(100-promotion.percent))/100:Number(p.price)})));

  const $ = id => document.getElementById(id);
  document.querySelectorAll('a[href="man.html"],a[href="woman.html"],a[href="kids.html"]').forEach(a=>{const k=a.getAttribute('href').replace('.html','');if(!sectionVisibility[k])a.hidden=true;});
  document.querySelectorAll('.desktop-nav, .mobile-menu, .mobile-menu nav, footer nav').forEach(nav=>{if(sectionVisibility.outlet&&!nav.querySelector('a[href="shop.html?outlet=1"]')){const a=document.createElement('a');a.href='shop.html?outlet=1';a.textContent='Outlet';nav.appendChild(a);}});
  if(isOutlet){document.title='Outlet — Manila Dark Lab';}

  const money = value => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const productURL = p => `product.html?id=${encodeURIComponent(p.id)}&group=${encodeURIComponent(p.group)}`;
  const heroVideo = $('heroVideo');
  if (heroVideo) {
    const toggle = $('videoToggle');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let wantsPlayback = !reducedMotion.matches;
    const updateVideoButton = () => {
      toggle.textContent = heroVideo.paused ? 'Riproduci video ▷' : 'Pausa video Ⅱ';
      toggle.setAttribute('aria-label', heroVideo.paused ? 'Riproduci il video iniziale' : 'Metti in pausa il video iniziale');
    };
    const playVideo = () => heroVideo.play().catch(() => { wantsPlayback = false; updateVideoButton(); });
    heroVideo.muted = true;
    toggle.hidden = false;
    heroVideo.addEventListener('play', updateVideoButton);
    heroVideo.addEventListener('pause', updateVideoButton);
    heroVideo.addEventListener('error', () => { toggle.hidden = true; });
    toggle.addEventListener('click', () => {
      wantsPlayback = heroVideo.paused;
      if (wantsPlayback) playVideo(); else heroVideo.pause();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) heroVideo.pause(); else if (wantsPlayback) playVideo();
    });
    reducedMotion.addEventListener('change', event => {
      wantsPlayback = !event.matches;
      if (wantsPlayback && !document.hidden) playVideo(); else heroVideo.pause();
    });
    updateVideoButton();
    if (wantsPlayback) playVideo();
  }
  const CART_KEY = 'manila.cart.v10';
  const MAX_QTY = 10;
  const SHIPPING_KEY = 'manila.shipping.v1';
  const shippingZones = window.MANILA_SHIPPING?.zones || [];
  let shippingDestination = '';
  try {
    const storedDestination = localStorage.getItem(SHIPPING_KEY);
    if (shippingZones.some(zone => zone.id === storedDestination)) shippingDestination = storedDestination;
  } catch { /* A destination can still be selected without browser storage. */ }
  $('shippingDestination').innerHTML = '<option value="">Scegli la destinazione</option>' + shippingZones.map(zone => `<option value="${escape(zone.id)}">${escape(zone.label)}</option>`).join('');
  $('shippingDestination').value = shippingDestination;
  function shippingQuote() {
    const zone = shippingZones.find(zone => zone.id === shippingDestination);
    const feeCents = zone && Number.isInteger(zone.feeCents) && zone.feeCents >= 0 ? zone.feeCents : null;
    return { zone, feeCents, totalCents: feeCents === null ? null : Math.round(getTotal() * 100) + feeCents };
  }
  function renderShipping() {
    const quote = shippingQuote();
    $('shippingCost').textContent = !quote.zone ? 'Scegli la destinazione' : quote.feeCents === null ? 'Da confermare' : quote.feeCents === 0 ? 'Gratuita' : money(quote.feeCents / 100);
    $('orderTotal').textContent = quote.totalCents === null ? 'Da confermare' : money(quote.totalCents / 100);
    $('shippingNote').textContent = !quote.zone ? 'Scegli la destinazione per conoscere le spese di spedizione.' : quote.feeCents === null ? `La tariffa per ${quote.zone.label} non è ancora disponibile. Ti confermeremo spedizione e totale prima dell’ordine.` : 'Il totale include i capi e la spedizione per la destinazione scelta. Disponibilità da confermare.';
  }
  $('shippingDestination').addEventListener('change', () => {
    const value = $('shippingDestination').value;
    shippingDestination = shippingZones.some(zone => zone.id === value) ? value : '';
    try { localStorage.setItem(SHIPPING_KEY, shippingDestination); } catch { /* Keep the current selection in memory. */ }
    renderShipping();
  });
  let cart = [];
  let storageNoticeShown = false;
  function normalizeCart(value) {
    if (!Array.isArray(value)) return [];
    const cleaned = [];
    value.forEach(item => {
      if (!item || typeof item !== 'object') return;
      const product = products.find(p => p.id === item.id);
      if (!product || !(product.sizes.length ? product.sizes.includes(item.size) : item.size === 'Da confermare') || !Number.isInteger(item.quantity) || item.quantity < 1) return;
      const existing = cleaned.find(p => p.id === item.id && p.size === item.size);
      if (existing) existing.quantity = Math.min(MAX_QTY, existing.quantity + item.quantity);
      else cleaned.push({ id: product.id, size: item.size, quantity: Math.min(MAX_QTY, item.quantity) });
    });
    return cleaned;
  }
  try { cart = normalizeCart(JSON.parse(localStorage.getItem(CART_KEY) || '[]')); } catch { cart = []; }
  function notify(message) {
    $('toast').textContent = message;
    $('toast').classList.add('show');
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => $('toast').classList.remove('show'), 3500);
  }
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }
    catch { if (!storageNoticeShown) { notify('Il carrello resta disponibile su questa pagina. Il browser non consente di salvarlo.'); storageNoticeShown = true; } }
  }
  function openDialog(id) { const dialog = $(id); if (dialog && !dialog.open) dialog.showModal(); }
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
  });
  $('cartOpen').addEventListener('click', () => openDialog('cartDrawer'));
  $('menuOpen').addEventListener('click', () => openDialog('mobileMenu'));
  document.querySelectorAll('#mobileMenu a').forEach(a => a.addEventListener('click', () => $('mobileMenu').close()));
  document.querySelectorAll('[data-nav]').forEach(a => { if (a.dataset.nav === document.body.dataset.page) a.setAttribute('aria-current', 'page'); });

  function card(p, index) {
    return `<article class="product-card"><a href="${productURL(p)}"><div class="product-image demo-crop"><img src="${escape(p.image)}" alt="${escape(p.name)} — ${escape(p.color)}" loading="lazy" width="738" height="1600"><span class="product-index">${p.type === 'hoodie' ? 'FELPA' : 'T-SHIRT'} / ${String(index + 1).padStart(2,'0')}</span><span class="product-view" aria-hidden="true">↗</span></div><div class="product-info"><p class="product-type">${escape(p.sizes.length ? `${p.color} · ${p.fit}` : 'Taglie da confermare')}</p><h3>${escape(p.name)}</h3><div class="product-bottom"><span>${money(p.price)}</span><span>Scopri il capo ↗</span></div></div></a></article>`;
  }
  if ($('featuredProducts')) $('featuredProducts').innerHTML = [products[0],products[4],products[3],products[6]].filter(Boolean).map(card).join('');
  const grid = $('catalogProducts');
  if (grid) {
    let filter = 'all';
    function renderCatalog() {
      let shown = products.filter(p => (isOutlet?sectionVisibility.outlet&&p.outlet:(grid.dataset.group === 'shop'?sectionVisibility[p.group]:sectionVisibility[p.group]&&p.group===grid.dataset.group)) && (filter === 'all' || p.type === filter));
      const sort = $('sortProducts').value;
      if (sort === 'price-asc') shown.sort((a,b) => a.price - b.price);
      if (sort === 'price-desc') shown.sort((a,b) => b.price - a.price);
      if (sort === 'name') shown.sort((a,b) => a.name.localeCompare(b.name, 'it'));
      grid.innerHTML = shown.map(card).join('');
      $('resultCount').textContent = `${shown.length} ${shown.length === 1 ? 'capo' : 'capi'}`;
      $('noResults').hidden = shown.length > 0;
      document.querySelectorAll('[data-filter]').forEach(b => { const active = b.dataset.filter === filter; b.classList.toggle('active',active); b.setAttribute('aria-pressed', String(active)); });
    }
    document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; renderCatalog(); }));
    $('sortProducts').addEventListener('change', renderCatalog);
    $('resetFilters').addEventListener('click', () => { filter = 'all'; renderCatalog(); });
    renderCatalog();
  }
  function getTotal() {
    const units=cart.flatMap(item=>{const p=products.find(p=>p.id===item.id);return p?Array.from({length:item.quantity},()=>p):[];});
    const cents=units.reduce((sum,p)=>sum+Math.round(p.price*100),0);
    if(!promotion||promotion.kind!=='3x2')return cents/100;
    const eligible=units.filter(p=>promotion.scope==='all'||promotion.scope===p.group||promotion.scope==='outlet'&&p.outlet).map(p=>Math.round(p.price*100)).sort((a,b)=>a-b);
    const freeCount=Math.floor(eligible.length/3);
    return (cents-eligible.slice(0,freeCount).reduce((sum,v)=>sum+v,0))/100;
  }
  function renderCart() {
    const count = cart.reduce((sum,p) => sum + p.quantity,0);
    $('cartCount').textContent = count;
    $('cartOpen').setAttribute('aria-label', `Apri carrello, ${count} ${count === 1 ? 'articolo' : 'articoli'}`);
    $('cartCheckout').hidden = !cart.length;
    $('paypalStatus').hidden = true;
    $('cartTotal').textContent = money(getTotal());
    renderShipping();
    if (!cart.length) {
      $('cartItems').innerHTML = '<div class="cart-empty"><div class="empty-symbol" aria-hidden="true">↗</div><h3>Ancora tutto da scegliere.</h3><p>Il tuo prossimo capo ti aspetta nello shop.</p><a class="button dark" href="shop.html">Fai un giro nello shop <span>↗</span></a></div>';
      return;
    }
    $('cartItems').innerHTML = cart.map((item,index) => {
      const p = products.find(p => p.id === item.id);
      return `<article class="cart-item"><a class="cart-thumb demo-crop" href="${productURL(p)}" aria-label="Vedi ${escape(p.name)}"><img src="${escape(p.image)}" alt=""></a><div><h3><a href="${productURL(p)}">${escape(p.name)}</a></h3><p>${escape(p.sizes.length ? `${p.color} · Taglia ${item.size}` : 'Taglia da confermare')}</p><div class="cart-item-bottom"><div class="quantity-selector cart-quantity"><button data-action="minus" data-index="${index}" aria-label="Riduci quantità di ${escape(p.name)}, taglia ${escape(item.size)}" ${item.quantity <= 1 ? 'disabled' : ''}>−</button><output aria-label="Quantità">${item.quantity}</output><button data-action="plus" data-index="${index}" aria-label="Aumenta quantità di ${escape(p.name)}, taglia ${escape(item.size)}" ${item.quantity >= MAX_QTY ? 'disabled' : ''}>+</button></div><strong>${money(p.price * item.quantity)}</strong></div><button class="remove-item" data-action="remove" data-index="${index}" aria-label="Rimuovi ${escape(p.name)}, taglia ${escape(item.size)}">Rimuovi</button></div></article>`;
    }).join('');
  }
  $('cartItems').addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const index = Number(button.dataset.index), action = button.dataset.action;
    if (!cart[index]) return;
    if (action === 'remove') cart.splice(index,1);
    else cart[index].quantity = Math.max(1,Math.min(MAX_QTY,cart[index].quantity + (action === 'plus' ? 1 : -1)));
    saveCart(); renderCart();
    const same = $('cartItems').querySelector(`[data-index="${index}"][data-action="${action}"]:not(:disabled)`);
    const fallback = $('cartItems').querySelector('button:not(:disabled), a');
    (same || fallback || $('cartDrawer').querySelector('[data-close]')).focus();
  });
  $('paypalButton').addEventListener('click', () => {
    if (!cart.length) return;
    $('paypalStatus').hidden = false;
    $('paypalStatus').textContent = 'PayPal sarà disponibile all’apertura dello shop. Nessun addebito: puoi chiedere informazioni sui capi qui sotto, via WhatsApp.';
  });
  $('orderForm').addEventListener('submit', event => {
    event.preventDefault();
    if (!cart.length) return;
    const name = $('customerName').value.trim(), notes = $('customerNotes').value.trim();
    const rows = cart.map(item => { const p = products.find(p => p.id === item.id); return `• ${p.name} (${p.sku}) — taglia ${item.size}, quantità ${item.quantity} — ${money(p.price * item.quantity)}`; }).join('\n');
    const quote = shippingQuote();
    const shippingSummary = `Destinazione: ${quote.zone?.label || 'Da indicare'}\nSpedizione: ${quote.feeCents === null ? 'Da confermare' : money(quote.feeCents / 100)}\nTotale: ${quote.totalCents === null ? 'Da confermare, spedizione ancora da definire' : money(quote.totalCents / 100)}`;
    const message = `Ciao Manila!${name ? ` Sono ${name}.` : ''} Mi interessano questi capi:\n\n${rows}\n\nSubtotale capi dopo promozioni: ${money(getTotal())}\n${shippingSummary}\nHo visto l’anteprima del sito: potete confermarmi disponibilità, prezzi e spedizione?${notes ? `\n\n${notes}` : ''}`;
    window.open(`https://wa.me/393934927764?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  });
  if ($('productDetail')) {
    const params = new URLSearchParams(location.search);
    const p = products.find(p => p.id === params.get('id') && (!params.has('group') || p.group === params.get('group')));
    if (!p) {
      document.title = 'Capo non trovato — Manila Dark Lab';
      $('productDetail').innerHTML = '<div class="not-found"><p class="eyebrow">QUESTO CAPO NON È QUI</p><h1>Facciamo un altro giro?</h1><p>Il link potrebbe essere cambiato. Tutti i capi sono nello shop.</p><a class="button dark" href="shop.html">Torna allo shop ↗</a></div>';
      $('relatedSection').hidden = true;
    } else {
      let size = p.sizes.length ? '' : 'Da confermare', quantity = 1;
      document.title = `${p.name} — Manila Dark Lab`;
      $('detailImage').src = p.image; $('detailImage').alt = `${p.name} — ${p.color}`;const images=[...new Set([p.image,...(p.gallery||[])])].filter(Boolean);const thumbs=$('detailThumbnails');if(thumbs&&images.length>1){thumbs.innerHTML=images.map((src,i)=>'<button type="button" data-photo="'+i+'"><img src="'+escape(src)+'" alt="Foto '+(i+1)+'"></button>').join('');thumbs.onclick=e=>{const b=e.target.closest('[data-photo]');if(b)$('detailImage').src=images[Number(b.dataset.photo)];};}
      $('backLink').href = `${p.group}.html`; $('backLink').textContent = `← ${p.group === 'man' ? 'Uomo' : 'Donna'} / Tutti i capi`;
      const fields = { detailName:p.name, detailTag:p.sizes.length ? `${p.color} · ${p.fit}` : 'Taglie e disponibilità da confermare', detailPrice:money(p.price), detailDescription:p.description, detailFit:p.fit, detailMaterial:p.material, detailColor:p.color, detailSku:p.sku, detailCategory:`MANILA DARK LAB / ${p.type === 'hoodie' ? 'FELPE' : 'T-SHIRT'}` };
      Object.entries(fields).forEach(([id,value]) => $(id).textContent = value);
      $('sizeOptions').innerHTML = p.sizes.map(size => `<button type="button" class="size-chip" aria-pressed="false" data-size="${escape(size)}">${escape(size)}</button>`).join('');
      $('sizeOptions').addEventListener('click', event => {
        const button = event.target.closest('[data-size]'); if (!button) return;
        size = button.dataset.size; $('chosenSize').textContent = ` / ${size}`; $('sizeError').textContent = '';
        $('sizeOptions').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      });
      const updateQty = delta => { quantity = Math.max(1,Math.min(MAX_QTY,quantity + delta)); $('qtyValue').textContent = quantity; $('qtyMinus').disabled = quantity <= 1; $('qtyPlus').disabled = quantity >= MAX_QTY; };
      $('qtyMinus').addEventListener('click', () => updateQty(-1)); $('qtyPlus').addEventListener('click', () => updateQty(1));
      $('detailAdd').addEventListener('click', () => {
        if (p.sizes.length && !size) { $('sizeError').textContent = 'Prima scegli la taglia che vuoi provare.'; $('sizeOptions').querySelector('button').focus(); return; }
        const existing = cart.find(item => item.id === p.id && item.size === size);
        if (existing && existing.quantity + quantity > MAX_QTY) { $('sizeError').textContent = `Puoi aggiungere al massimo ${MAX_QTY} capi per taglia. Nel carrello ce ne sono già ${existing.quantity}.`; return; }
        if (existing) existing.quantity += quantity; else cart.push({ id:p.id, size, quantity });
        saveCart(); renderCart(); openDialog('cartDrawer');
      });
      $('sizeGuideOpen').addEventListener('click', () => openDialog('sizeGuide'));
      $('sizeHelpLink').href = `https://wa.me/393934927764?text=${encodeURIComponent(`Ciao Manila! Mi date una mano con la taglia per ${p.name}?`)}`;
      $('relatedProducts').innerHTML = products.filter(item => item.id !== p.id).slice(0,4).map(card).join('');
    }
  }
  window.addEventListener('storage', event => {
    if (event.key === SHIPPING_KEY || event.key === null) {
      shippingDestination = shippingZones.some(zone => zone.id === event.newValue) ? event.newValue : '';
      $('shippingDestination').value = shippingDestination;
      renderShipping();
      if (event.key !== null) return;
    }
    if (event.key !== CART_KEY && event.key !== null) return;
    try { cart = normalizeCart(JSON.parse(event.newValue || '[]')); } catch { cart = []; }
    renderCart();
  });
  renderCart();
})();
