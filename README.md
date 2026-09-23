# Manila Dark Lab

Sito statico HTML, CSS e JavaScript, senza dipendenze e senza build. Restyling di settembre 2026.

## Anteprima locale

Dalla cartella del progetto:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Aprire `http://localhost:8080/index.html` in Safari.

## Struttura

- `index.html`: home, categorie, selezione prodotti, storia e FAQ.
- `shop.html`, `man.html`, `woman.html`: catalogo con filtri e ordinamento.
- `kids.html`: pagina in arrivo. I prodotti junior della demo non avevano foto reali dedicate.
- `product.html`: scheda prodotto, taglie, quantità e aiuto taglie.
- `catalog.js`: unica fonte dei prodotti. Prezzi espressi in euro come numeri.
- `script.js`: catalogo, carrello persistente, finestre accessibili e riepilogo WhatsApp.
- `styles.css`: sistema grafico condiviso e adattamento agli schermi piccoli.
- `tests/storefront.test.cjs`: verifiche della logica di carrello e contatto.

Il carrello salva solo ID del capo, taglia e quantità; nome e note non sono memorizzati. Al caricamento, prezzi e descrizioni vengono sempre riletti dal catalogo. Le quantità sono limitate a 10 per variante. La vecchia cache V7 non viene importata perché poteva contenere prodotti e dati della demo non più validi.

## Materiale definitivo

Foto e dettagli del catalogo sono ancora dimostrativi, indicato anche nel sito. I prezzi confermati sono **19,90 € per tutte le t-shirt** e **39,90 € per tutte le felpe**. La cartella Drive fornita richiede un accesso Google:
https://drive.google.com/drive/folders/1DxzHrCIli_On8zeAVR1XKUQMJOU9yuOv

Per ogni capo servono foto, nome, prezzo, taglie, colore, vestibilità e composizione confermati. Le immagini attuali rimangono intatte: il ritaglio delle schermate demo avviene solo in CSS. Quando arrivano le foto definitive, rimuovere la classe `demo-crop` dai contenitori interessati (schede, dettaglio, carrello e categoria Donna), aggiornare le descrizioni e togliere gli avvisi di anteprima solo dopo la conferma dei dati.

Le vecchie dichiarazioni di disponibilità, urgenza, tempi di spedizione e misure standard sono state rimosse. Prima dell'apertura vanno inserite informazioni effettive su venditore, spedizione, resi e trattamento dei dati. I vecchi file `LEGGIMI-V9*` descrivono solo la versione precedente.

## PayPal

Il pulsante è presente nel carrello in modalità **anteprima**. Il click spiega che PayPal non è ancora attivo. Non carica l'SDK, non invia dati a PayPal, non crea ordini e non effettua addebiti. Il carrello non viene svuotato e non viene mostrata una finta conferma di pagamento.

Per attivarlo in una fase successiva:

1. Configurare il conto Business del venditore e le credenziali sandbox.
2. Aggiungere un backend che crei e acquisisca gli ordini, validando ID, taglie, prezzi e disponibilità sul server. Non accettare importi decisi dal browser.
3. Integrare il pulsante ufficiale PayPal JS SDK, gestire annullamenti, errori e verifica del pagamento lato server; conservare il secret esclusivamente sul server.
4. Verificare il flusso in sandbox e poi configurare l'ambiente live con i dati definitivi.

La soluzione standard pubblicizzata da PayPal non prevede un canone mensile o di attivazione; i pagamenti ricevuti hanno commissioni. Verificare le tariffe al momento dell'attivazione:

- https://www.paypal.com/it/business/accept-payments/checkout
- https://www.paypal.com/it/business/fees
- https://developer.paypal.com/studio/checkout/standard/integrate

Il percorso WhatsApp prepara una richiesta di disponibilità, non un ordine confermato. Il visitatore deve inviare personalmente la bozza nell'app.

## Verifiche

```sh
node tests/storefront.test.cjs
```

I test coprono prezzi ricalcolati dal catalogo, cache corrotta, ID/taglie non validi, quantità e varianti duplicate, rimozione, persistenza, sincronizzazione del carrello, storage disabilitato, testo WhatsApp e stato PayPal. Non inviano messaggi o pagamenti reali.

Verificati direttamente in Safari: home, filtri, ordinamento, scheda, validazione taglia, quantità, subtotale, persistenza dopo ricaricamento, rimozione, carrello vuoto, menu mobile e dialogo taglie. Vista desktop, finestra stretta e viewport da 390 pixel tramite pagina locale di prova. Nessun test su dispositivo iPhone fisico e nessuna transazione PayPal reale.

## Identità del marchio

Usare esclusivamente il nome **Manila Dark Lab** e il logo originale `logo-manila-dark-lab.jpeg`, con teschio e corona di cristalli. Il logo è presente nell’intestazione e nel footer di ogni pagina. Non creare sigle o nomi alternativi. Le immagini della precedente demo con scritte non conformi sono state escluse dal sito e conservate fuori dalla cartella pubblica, in `/private/tmp/manila-retired-branding/`.

Il video originale `manila-intro.mp4` è stato verificato e reinserito in apertura, nello sfondo della home: contiene il marchio corretto. Parte senza audio, può essere messo in pausa e rispetta la preferenza di riduzione del movimento. Il logo JPEG senza cornice è il file originale fornito, copiato senza ritocchi.

## Spedizione per destinazione

`shipping.js` definisce le tre fasce Italia, altri Paesi UE ed extra UE. Le tariffe sono in centesimi (`feeCents`). Le tariffe indicate dal venditore sono **4,90 € per Italia, 10 € per altri Paesi UE e 15 € per extra UE**, per ordine. Se una tariffa viene impostata a `null`, il sito mostra “Da confermare” e non finge che la spedizione sia gratuita. Il valore `0` indica invece una tariffa gratuita esplicitamente confermata.

Il carrello conserva la fascia scelta, mostra separatamente subtotale, spedizione e totale, e include tutto nella bozza WhatsApp. Le fasce riguardano l’appartenenza all’UE, non l’Europa geografica. Nessuna soglia di gratuità è attiva. Prima dei pagamenti reali, anche tariffe e destinazioni dovranno essere validate dal backend.

Palette attuale: antracite `#222625`, superfici profonde `#161a18`, testo chiaro e accento lime originale `#d6ed45`. Il file del logo rimane originale; sul fondo scuro viene mostrato in negativo tramite CSS.
