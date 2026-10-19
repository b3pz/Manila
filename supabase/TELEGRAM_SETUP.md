# Notifiche Telegram di Manila Dark Lab

Notifiche **nuove richieste d'ordine** alla creazione di una riga in `public.manila_web_orders`. Il messaggio mostra numero ordine, cliente, articoli e metodo di pagamento preferito. Non invia indirizzo, email o telefono al gruppo.

1. Crea un bot con **@BotFather** tramite `/newbot`. Conserva il token **solo in Supabase**, mai su GitHub o nel frontend.
2. Crea un gruppo Telegram privato con te e Manila, aggiungi il bot e manda un messaggio nel gruppo. Ricava l'ID numerico del gruppo con l'API `getUpdates`, usando il token privatamente. Verifica che il bot possa inviare messaggi.
3. In Supabase > Edge Functions crea/deploy `telegram-order` usando `supabase/functions/telegram-order/index.ts`. Disattiva **Verify JWT** solo per questa funzione, che autorizza gli invii mediante un header segreto.
4. In Supabase > Edge Functions > Secrets configura:
   - `TELEGRAM_BOT_TOKEN`: token privato di BotFather.
   - `TELEGRAM_CHAT_ID`: ID del gruppo privato (spesso inizia con `-100`).
   - `MANILA_WEBHOOK_SECRET`: stringa casuale robusta di almeno 32 caratteri.
5. In Supabase > Database > Webhooks crea un webhook:
   - Tabella: `public.manila_web_orders`
   - Evento: **INSERT** (non UPDATE, per non generare notifiche ai cambi di stato)
   - URL: `https://gvrjdoozwcozrsoltkyy.supabase.co/functions/v1/telegram-order`
   - Metodo POST; body standard Database Webhook Supabase.
   - Header personalizzato `x-manila-webhook-secret` uguale al valore del secret configurato sopra.
6. Esegui una richiesta di prova da `checkout.html` e verifica la comparsa nel Manager e nel gruppo. Consulta i log Edge Functions in caso di errore.

Supabase rimane l'archivio degli ordini. Un webhook non recapitato non cancella l'ordine; servirà un meccanismo di retry se si vuole la consegna garantita. Prima dell'uso pubblico integra anche misure antispam nel form.
