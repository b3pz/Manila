
const catalog = {
  man: [
    {id:"man-1",name:"Crystal Crown Tee",price:39,tag:"Black / Oversize",crop:"crop-left"},
    {id:"man-2",name:"Experiment Hoodie",price:79,tag:"Washed / Heavyweight",crop:"crop-center"},
    {id:"man-3",name:"Lab Crewneck",price:65,tag:"Olive / Relaxed",crop:"crop-right"}
  ],
  woman: [
    {id:"woman-1",name:"Dark Lab Tee",price:38,tag:"Brown / Boxy",crop:"crop-center"},
    {id:"woman-2",name:"Crystal Hoodie",price:76,tag:"Deep Purple / Soft",crop:"crop-left"},
    {id:"woman-3",name:"Stone Oversize Tee",price:42,tag:"Stone / Oversize",crop:"crop-right"}
  ],
  kids: [
    {id:"kids-1",name:"Mini Crown Tee",price:25,tag:"Cream / Kids",crop:"crop-left"},
    {id:"kids-2",name:"MDL Kids Hoodie",price:49,tag:"Olive / Soft Cotton",crop:"crop-center"},
    {id:"kids-3",name:"Urban Play Crew",price:42,tag:"Brown / Play",crop:"crop-right"}
  ]
};
const euro = new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"});
const cart = [];
const overlay = document.getElementById("overlay");
const cartDrawer = document.getElementById("cartDrawer");
const mobileMenu = document.getElementById("mobileMenu");
const toast = document.getElementById("toast");

function productCard(p,group){
  return `
    <article class="product">
      <a href="product.html?id=${encodeURIComponent(p.id)}&group=${group}" aria-label="Apri ${p.name}">
        <div class="product-image">
          <img class="${p.crop}" src="Skatemani.PNG" alt="${p.name}">
          <span class="product-tag">${p.tag}</span>
        </div>
      </a>
      <div class="product-info">
        <div class="product-line">${group} · Experiment 001</div>
        <h3 class="product-title"><a href="product.html?id=${encodeURIComponent(p.id)}&group=${group}">${p.name}</a></h3>
        <div class="product-bottom">
          <span class="price">${euro.format(p.price)}</span>
          <button class="add" data-id="${p.id}" data-group="${group}">Aggiungi</button>
        </div>
      </div>
    </article>`;
}
function renderGroup(group,targetId){
  const target=document.getElementById(targetId);
  if(!target)return;
  target.innerHTML=catalog[group].map(p=>productCard(p,group)).join("");
}
function findProduct(group,id){return (catalog[group]||[]).find(p=>p.id===id)}
function addToCart(group,id){
  const p=findProduct(group,id);if(!p)return;
  cart.push({...p,group});updateCart();showToast(p.name+" aggiunto");
}
function updateCart(){
  const count=document.getElementById("cartCount");if(count)count.textContent=cart.length;
  const list=document.getElementById("cartItems");if(!list)return;
  if(!cart.length){list.innerHTML='<p class="empty">Il carrello è vuoto.</p>'}
  else{
    list.innerHTML=cart.map((p,i)=>`<div class="cart-item"><div><strong>${p.name}</strong><span>${euro.format(p.price)}</span></div><button class="remove" data-index="${i}">×</button></div>`).join("");
    list.querySelectorAll(".remove").forEach(b=>b.addEventListener("click",()=>{cart.splice(Number(b.dataset.index),1);updateCart()}));
  }
  const total=document.getElementById("cartTotal");if(total)total.textContent=euro.format(cart.reduce((s,p)=>s+p.price,0));
}
function openPanel(panel){if(!panel)return;panel.classList.add("open");overlay?.classList.add("show");document.body.classList.add("locked")}
function closePanels(){cartDrawer?.classList.remove("open");mobileMenu?.classList.remove("open");overlay?.classList.remove("show");document.body.classList.remove("locked")}
function showToast(message){if(!toast)return;toast.textContent=message;toast.classList.add("show");clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>toast.classList.remove("show"),1800)}
document.addEventListener("click",e=>{
  const add=e.target.closest(".add");
  if(add){addToCart(add.dataset.group,add.dataset.id)}
});
document.getElementById("cartOpen")?.addEventListener("click",()=>openPanel(cartDrawer));
document.getElementById("cartClose")?.addEventListener("click",closePanels);
document.getElementById("menuOpen")?.addEventListener("click",()=>openPanel(mobileMenu));
document.getElementById("menuClose")?.addEventListener("click",closePanels);
overlay?.addEventListener("click",closePanels);
document.querySelectorAll(".mobile-links a").forEach(a=>a.addEventListener("click",closePanels));
document.getElementById("checkoutButton")?.addEventListener("click",()=>{
  if(!cart.length){showToast("Il carrello è vuoto");return}
  const rows=cart.map(p=>`• ${p.name} — ${euro.format(p.price)}`).join("\n");
  const total=cart.reduce((s,p)=>s+p.price,0);
  const msg=encodeURIComponent(`Ciao Manila Dark Lab, vorrei ordinare:\n${rows}\n\nTotale: ${euro.format(total)}`);
  window.open(`https://wa.me/393383449189?text=${msg}`,"_blank");
});
renderGroup("man","manProducts");
renderGroup("woman","womanProducts");
renderGroup("kids","kidsProducts");
updateCart();
