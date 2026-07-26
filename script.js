
const catalog={
 man:[
  {id:"man-1",name:"Celestial Oversize Hoodie",price:89,tag:"Black / Heavyweight",image:"man-hoodie-celestial.jpg"},
  {id:"man-2",name:"Atropa Skull Tee",price:45,tag:"Vintage Black / Oversize",image:"man-tee-skull.jpg"},
  {id:"man-3",name:"Good News Hoodie",price:95,tag:"Black / Back Print",image:"man-hoodie-cross.jpg"}
 ],
 woman:[
  {id:"woman-1",name:"Lunar Alignment Tee",price:42,tag:"White / Oversize",image:"woman-tee-white.jpg"},
  {id:"woman-2",name:"Moon Phases Tee",price:44,tag:"Black / Relaxed",image:"woman-tee-black.jpg"},
  {id:"woman-3",name:"The Magician Tee",price:46,tag:"Vintage Black / Tarot",image:"woman-tee-tarot.jpg"}
 ],
 kids:[
  {id:"kids-1",name:"Mini Lab Graphic Tee",price:27,tag:"Kids / Graphic",image:"ambient-lab.jpg"},
  {id:"kids-2",name:"Skate Experiment Hoodie",price:52,tag:"Kids / Soft Cotton",image:"ambient-skate.jpg"},
  {id:"kids-3",name:"Coffee Bones Crew",price:39,tag:"Kids / Play",image:"ambient-coffee.jpg"}
 ]
};
const euro=new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"}),cart=[];
const overlay=document.getElementById("overlay"),cartDrawer=document.getElementById("cartDrawer"),mobileMenu=document.getElementById("mobileMenu"),toast=document.getElementById("toast");
function productCard(p,g){return `<article class="product"><a href="product.html?id=${p.id}&group=${g}"><div class="product-image"><img src="${p.image}" alt="${p.name}"><span class="product-tag">${p.tag}</span></div></a><div class="product-info"><div class="product-line">${g} · Experiment 001</div><h3 class="product-title"><a href="product.html?id=${p.id}&group=${g}">${p.name}</a></h3><div class="product-bottom"><span class="price">${euro.format(p.price)}</span><button class="add" data-id="${p.id}" data-group="${g}">Aggiungi</button></div></div></article>`}
function render(g,id){const el=document.getElementById(id);if(el)el.innerHTML=catalog[g].map(p=>productCard(p,g)).join("")}
function findProduct(g,id){return (catalog[g]||[]).find(p=>p.id===id)}
function addToCart(g,id){const p=findProduct(g,id);if(!p)return;cart.push({...p,group:g});updateCart();showToast(p.name+" aggiunto")}
function updateCart(){const c=document.getElementById("cartCount");if(c)c.textContent=cart.length;const l=document.getElementById("cartItems");if(!l)return;if(!cart.length)l.innerHTML='<p class="empty">Il carrello è vuoto.</p>';else{l.innerHTML=cart.map((p,i)=>`<div class="cart-item"><div><strong>${p.name}</strong><span>${euro.format(p.price)}</span></div><button class="remove" data-index="${i}">×</button></div>`).join("");l.querySelectorAll(".remove").forEach(b=>b.onclick=()=>{cart.splice(+b.dataset.index,1);updateCart()})}document.getElementById("cartTotal").textContent=euro.format(cart.reduce((s,p)=>s+p.price,0))}
function openPanel(p){p?.classList.add("open");overlay?.classList.add("show");document.body.classList.add("locked")}function closePanels(){cartDrawer?.classList.remove("open");mobileMenu?.classList.remove("open");overlay?.classList.remove("show");document.body.classList.remove("locked")}
function showToast(m){if(!toast)return;toast.textContent=m;toast.classList.add("show");clearTimeout(window.tt);window.tt=setTimeout(()=>toast.classList.remove("show"),1800)}
document.addEventListener("click",e=>{const b=e.target.closest(".add");if(b)addToCart(b.dataset.group,b.dataset.id)});
document.getElementById("cartOpen")?.addEventListener("click",()=>openPanel(cartDrawer));document.getElementById("cartClose")?.addEventListener("click",closePanels);document.getElementById("menuOpen")?.addEventListener("click",()=>openPanel(mobileMenu));document.getElementById("menuClose")?.addEventListener("click",closePanels);overlay?.addEventListener("click",closePanels);document.querySelectorAll(".mobile-links a").forEach(a=>a.addEventListener("click",closePanels));
document.getElementById("checkoutButton")?.addEventListener("click",()=>{if(!cart.length){showToast("Il carrello è vuoto");return}const rows=cart.map(p=>`• ${p.name} — ${euro.format(p.price)}`).join("\n"),tot=cart.reduce((s,p)=>s+p.price,0),msg=encodeURIComponent(`Ciao Manila Dark Lab, vorrei ordinare:\n${rows}\n\nTotale: ${euro.format(tot)}`);window.open(`https://wa.me/393934927764?text=${msg}`,"_blank")});
render("man","manProducts");render("woman","womanProducts");render("kids","kidsProducts");updateCart();
