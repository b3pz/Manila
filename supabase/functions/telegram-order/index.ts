// Supabase Edge Function: telegram-order. Disable JWT verification in function settings.
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method!=="POST")return reply({error:"method not allowed"},405);
 const secret=Deno.env.get("MANILA_WEBHOOK_SECRET");
 if(!secret||req.headers.get("x-manila-webhook-secret")!==secret)return reply({error:"unauthorized"},401);
 const token=Deno.env.get("TELEGRAM_BOT_TOKEN"),chat=Deno.env.get("TELEGRAM_CHAT_ID");
 if(!token||!chat)return reply({error:"missing Telegram settings"},503);
 let payload;
 try{payload=await req.json()}catch{return reply({error:"invalid JSON"},400)}
 if(payload.type!=="INSERT"||payload.table!=="manila_web_orders"||payload.schema!=="public")return reply({ignored:true});
 const o=payload.record||{};
 if(typeof o.id!=="string"||typeof o.customer_name!=="string"||!Array.isArray(o.items))return reply({error:"invalid record"},400);
 const esc=(s:unknown)=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
 const list=o.items.slice(0,20).map((item:{name?:string,code?:string,size?:string,quantity?:number})=>"• "+esc(item.name)+" — "+esc(item.code)+" · Taglia "+esc(item.size)+" × "+esc(item.quantity)).join("\n");
 const msg="🛍 <b>Nuova richiesta d'ordine</b>\n📦 <b>Ordine:</b> "+esc(o.id.slice(0,8).toUpperCase())+"\n👤 <b>Cliente:</b> "+esc(o.customer_name)+"\n👕 <b>Articoli:</b>\n"+list+"\n💳 <b>Preferenza:</b> "+esc(o.payment_preference)+"\n\n⏳ Da verificare · Pagamento non confermato\n🔗 <a href=\"https://b3pz.github.io/Manila/manager.html#weborders\">Apri ordini nel Manager</a>";
 const resp=await fetch("https://api.telegram.org/bot"+token+"/sendMessage",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:chat,text:msg,parse_mode:"HTML",disable_web_page_preview:true})});
 if(!resp.ok)return reply({error:"telegram delivery failed",status:resp.status},502);
 return reply({sent:true});
});