'use strict';
/* Beneficios de Tarjetas — fuentes de verificación */
const SOURCES = [
  { id:'visa-beneficios',      name:'Visa Beneficios',       url:'https://www.visa.com.ar/beneficios',       sourceType:'SCRAPING' },
  { id:'mastercard-surprize',  name:'Mastercard Surprize',   url:'https://www.mastercard.com.ar/es-ar/consumidores/beneficios.html', sourceType:'SCRAPING' },
  { id:'amex-offers',          name:'American Express Offers',url:'https://www.americanexpress.com/es-ar/benefits/', sourceType:'SCRAPING' },
];
module.exports = SOURCES;
