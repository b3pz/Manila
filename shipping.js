'use strict';
// Tariffe indicate dal venditore, espresse in centesimi di euro.
// null = tariffa non ancora definita; 0 = spedizione gratuita, solo se confermata.
// Le fasce seguono l'appartenenza all'UE, non il continente geografico.
window.MANILA_SHIPPING = {
  zones: [
    { id: 'italy', label: 'Italia', feeCents: 490 },
    { id: 'eu', label: 'Altri Paesi UE', feeCents: 1000 },
    { id: 'non-eu', label: 'Extra UE', feeCents: 1500 }
  ]
};
