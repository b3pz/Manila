// Run: node tests/storefront.test.cjs
// These checks exercise the real storefront script with saved-cart inputs.
// Safari covers DOM interaction and visual rendering separately.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const catalogSource = fs.readFileSync(path.join(root, 'catalog.js'), 'utf8');
const shippingSource = fs.readFileSync(path.join(root, 'shipping.js'), 'utf8');
const source = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
function boot(saved, blocked = false, testFee = undefined) {
  const elements = new Map();
  const events = {};
  const opened = [];
  let stored;
  const missing = new Set(['productDetail', 'catalogProducts', 'featuredProducts', 'heroVideo']);
  function element(id) {
    if (missing.has(id)) return null;
    if (!elements.has(id)) elements.set(id, {
      innerHTML: '', textContent: '', hidden: false, value: '', handlers: {}, attrs: {},
      classList: { add() {}, remove() {} },
      addEventListener(type, fn) { this.handlers[type] = fn; },
      setAttribute(name, value) { this.attrs[name] = value; },
      querySelector() { return { focus() {} }; }
    });
    return elements.get(id);
  }
  const window = { addEventListener(type,fn) { events[type] = fn; }, open(...args) { opened.push(args); } };
  const context = vm.createContext({
    window, Intl, URLSearchParams, setTimeout() {}, clearTimeout() {},
    document: { body: { dataset: { page: 'home' } }, getElementById: element, querySelectorAll: () => [] },
    localStorage: { getItem(key) { if (blocked) throw new Error('storage denied'); return key === 'manila.cart.v10' ? saved : null; }, setItem(key,value) { if (blocked) throw new Error('storage denied'); stored = value; } }
  });
  vm.runInContext(catalogSource, context);
  vm.runInContext(shippingSource, context);
  if (testFee !== undefined) context.window.MANILA_SHIPPING.zones[0].feeCents = testFee;
  vm.runInContext(source, context);
  return { element, events, opened, stored: () => stored };
}
const valid = { id:'man-1', size:'M', quantity:2 };
let s = boot(JSON.stringify([valid]));
assert.equal(s.element('cartCount').textContent, 2);
assert.match(s.element('cartTotal').textContent, /79,80/);
assert.equal(s.element('cartCheckout').hidden, false);
s.element('paypalButton').handlers.click();
assert.equal(s.element('paypalStatus').hidden,false);
assert.equal(s.opened.length,0, 'PayPal preview must never launch a real payment');
s.element('customerName').value = 'Test & prova';
s.element('customerNotes').value = 'Taglia M? + dettagli';
s.element('orderForm').handlers.submit({ preventDefault() {} });
assert.equal(s.opened.length,1);
const url = new URL(s.opened[0][0]);
assert.equal(url.origin,'https://wa.me');
assert.match(url.searchParams.get('text'), /Test & prova/);
assert.match(url.searchParams.get('text'), /taglia M, quantità 2/);
assert.match(url.searchParams.get('text'), /Taglia M\? \+ dettagli/);
assert.equal(s.opened[0][2], 'noopener,noreferrer');
// Persisted prices and HTML must never be trusted.
s = boot(JSON.stringify([{ ...valid, price:0.01, name:'<img src=x onerror=alert(1)>' }]));
assert.match(s.element('cartTotal').textContent,/79,80/);
assert.ok(!s.element('cartItems').innerHTML.includes('onerror'));
// Stale products, invalid sizes, fractions and negative quantities are discarded.
s = boot(JSON.stringify([null,{}, { id:'gone',size:'M',quantity:1 }, { ...valid,size:'XXL' }, { ...valid,quantity:1.5 }, { ...valid,quantity:-1 }]));
assert.equal(s.element('cartCount').textContent,0);
assert.equal(s.element('cartCheckout').hidden,true);
s.element('orderForm').handlers.submit({ preventDefault() {} });
assert.equal(s.opened.length,0);
// Duplicate variants merge with the ten-item cap.
s = boot(JSON.stringify([{ ...valid,quantity:9 }, { ...valid,quantity:8 }]));
assert.equal(s.element('cartCount').textContent,10);
assert.match(s.element('cartTotal').textContent,/399,00/);
s.element('cartItems').handlers.click({ target: { closest() { return { dataset: { index:'0',action:'minus' } }; } } });
assert.equal(s.element('cartCount').textContent,9);
assert.equal(JSON.parse(s.stored())[0].quantity,9);
s.element('cartItems').handlers.click({ target: { closest() { return { dataset: { index:'0',action:'remove' } }; } } });
assert.equal(s.element('cartCount').textContent,0);
assert.equal(s.element('cartCheckout').hidden,true);
for (const corrupt of ['invalid JSON', '{}', 'null']) assert.equal(boot(corrupt).element('cartCount').textContent,0);
assert.equal(boot('',true).element('cartCount').textContent,0);
s = boot(JSON.stringify([valid]));
s.events.storage({ key:'manila.cart.v10', newValue:'[]' });
assert.equal(s.element('cartCount').textContent,0);
console.log('Storefront checks passed: cart integrity, totals, persistence, removal, unavailable storage, WhatsApp encoding, PayPal preview.');

// Shipping is charged per order, with the commercial EU bands supplied by the seller.
s = boot(JSON.stringify([valid]));
assert.equal(s.element('orderTotal').textContent, 'Da confermare');
for (const [zone, cost, total] of [['italy','4,90','84,70'],['eu','10,00','89,80'],['non-eu','15,00','94,80']]) {
  s.element('shippingDestination').value = zone;
  s.element('shippingDestination').handlers.change();
  assert.ok(s.element('shippingCost').textContent.includes(cost));
  assert.ok(s.element('orderTotal').textContent.includes(total));
}
s.element('orderForm').handlers.submit({ preventDefault() {} });
let message = new URL(s.opened[0][0]).searchParams.get('text');
assert.match(message,/Destinazione: Extra UE/);
assert.match(message,/Spedizione: 15,00/);
assert.match(message,/Totale: 94,80/);
s.element('cartItems').handlers.click({ target: { closest() { return { dataset: { index:'0',action:'plus' } }; } } });
assert.match(s.element('orderTotal').textContent,/134,70/); // 3 x 39.90 + 15, shipping once.
s.events.storage({key:'manila.shipping.v1',newValue:'italy'});
assert.match(s.element('orderTotal').textContent,/124,60/);
s.element('shippingDestination').value = 'unknown';
s.element('shippingDestination').handlers.change();
assert.equal(s.element('orderTotal').textContent,'Da confermare');
for (const invalidFee of [null,-100,NaN,1.5]) {
  s = boot(JSON.stringify([valid]),false,invalidFee);
  s.element('shippingDestination').value='italy';
  s.element('shippingDestination').handlers.change();
  assert.equal(s.element('shippingCost').textContent,'Da confermare');
  assert.equal(s.element('orderTotal').textContent,'Da confermare');
}
s = boot(JSON.stringify([valid]),false,0);
s.element('shippingDestination').value='italy';s.element('shippingDestination').handlers.change();
assert.equal(s.element('shippingCost').textContent,'Gratuita');
assert.match(s.element('orderTotal').textContent,/79,80/);
console.log('Shipping checks passed: Italy 4.90, EU 10, non-EU 15, totals, WhatsApp, storage sync, unknown/missing rates.');

// One tee and one hoodie, including the confirmed Italian shipping fee.
s = boot(JSON.stringify([{id:'woman-1',size:'M',quantity:1},{id:'man-1',size:'M',quantity:1}]));
assert.match(s.element('cartTotal').textContent,/59,80/);
s.element('shippingDestination').value='italy';s.element('shippingDestination').handlers.change();
assert.match(s.element('orderTotal').textContent,/64,70/);
