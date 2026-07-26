
const catalog={
 man:[
  {id:"man-1",name:"Celestial Oversize Hoodie",price:89,tag:"Black / Heavyweight",image:"man-hoodie-celestial.jpg"},
  {id:"man-2",name:"Atropa Skull Tee",price:45,tag:"Vintage Black / Oversize",image:"man-tee-skull.jpg"},
  {id:"man-3",name:"Good News Hoodie",price:95,tag:"Black / Back Print",image:"man-hoodie-cross.jpg"},
  {id:"man-4",name:"Coffee Bones Tee",price:42,tag:"Forest Green / Back Print",image:"man-tee-coffee-green.jpg"}
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

const euro=new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"});
const cart=[];
const overlay=document.getElementById("overlay");
const cartDrawer=document.getElementById("cartDrawer");
const mobileMenu=document.getElementById("mobileMenu");
const toast=document.getElementById("toast");

function productCard(p,g){
  return `
  <article class="product">
    <a href="product.html?id=${encodeURIComponent(p.id)}&group=${encodeURIComponent(g)}">
      <div class="product-image">
        <img src="${p.image}" alt="${p.name}">
        <span class="product-tag">${p.tag}</span>
      </div>
    </a>
    <div class="product-info">
      <div class="product-line">${g} · Experiment 001</div>
      <h3 class="product-title">
        <a href="product.html?id=${encodeURIComponent(p.id)}&group=${encodeURIComponent(g)}">${p.name}</a>
      </h3>
      <div class="product-bottom">
        <span class="price">${euro.format(p.price)}</span>
        <button class="add" data-id="${p.id}" data-group="${g}">Aggiungi</button>
      </div>
    </div>
  </article>`;
}

function render(group,targetId){
  const target=document.getElementById(targetId);
  if(target) target.innerHTML=catalog[group].map(p=>productCard(p,group)).join("");
}

function findProduct(group,id){
  return (catalog[group]||[]).find(p=>p.id===id);
}

function addToCart(group,id){
  const product=findProduct(group,id);
  if(!product) return;
  cart.push({...product,group});
  updateCart();
  showToast(product.name+" aggiunto");
}

function updateCart(){
  const count=document.getElementById("cartCount");
  if(count) count.textContent=cart.length;

  const list=document.getElementById("cartItems");
  if(!list) return;

  if(!cart.length){
    list.innerHTML='<p class="empty">Il carrello è vuoto.</p>';
  } else {
    list.innerHTML=cart.map((p,i)=>`
      <div class="cart-item">
        <div>
          <strong>${p.name}</strong>
          <span>${euro.format(p.price)}</span>
        </div>
        <button class="remove" data-index="${i}" aria-label="Rimuovi ${p.name}">×</button>
      </div>`).join("");

    list.querySelectorAll(".remove").forEach(button=>{
      button.addEventListener("click",()=>{
        cart.splice(Number(button.dataset.index),1);
        updateCart();
      });
    });
  }

  const total=document.getElementById("cartTotal");
  if(total) total.textContent=euro.format(cart.reduce((sum,p)=>sum+p.price,0));
}

function openPanel(panel){
  if(!panel) return;
  panel.classList.add("open");
  overlay?.classList.add("show");
  document.body.classList.add("locked");
}

function closePanels(){
  cartDrawer?.classList.remove("open");
  mobileMenu?.classList.remove("open");
  overlay?.classList.remove("show");
  document.body.classList.remove("locked");
}

function showToast(message){
  if(!toast) return;
  toast.textContent=message;
  toast.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer=setTimeout(()=>toast.classList.remove("show"),1800);
}

document.addEventListener("click",event=>{
  const addButton=event.target.closest(".add");
  if(addButton) addToCart(addButton.dataset.group,addButton.dataset.id);
});

document.getElementById("cartOpen")?.addEventListener("click",()=>openPanel(cartDrawer));
document.getElementById("cartClose")?.addEventListener("click",closePanels);
document.getElementById("menuOpen")?.addEventListener("click",()=>openPanel(mobileMenu));
document.getElementById("menuClose")?.addEventListener("click",closePanels);
overlay?.addEventListener("click",closePanels);
document.querySelectorAll(".mobile-links a").forEach(link=>link.addEventListener("click",closePanels));

document.getElementById("checkoutButton")?.addEventListener("click",()=>{
  if(!cart.length){
    showToast("Il carrello è vuoto");
    return;
  }

  const rows=cart.map((p,index)=>`${index+1}. ${p.name} — ${euro.format(p.price)}`).join("\n");
  const total=cart.reduce((sum,p)=>sum+p.price,0);
  const message=encodeURIComponent(
`Ciao Manila Dark Lab, vorrei ordinare:

${rows}

Totale: ${euro.format(total)}

Potete indicarmi disponibilità, taglie e spedizione?`
  );

  window.open(`https://wa.me/393934927764?text=${message}`,"_blank");
});

render("man","manProducts");
render("woman","womanProducts");
render("kids","kidsProducts");
updateCart();
