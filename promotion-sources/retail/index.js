'use strict';
/* Apps Retail — fuentes de verificación
 * Cencopay, Club Día, Comunidad Coto, Mi Carrefour, Mi ChangoMás, Jumbo Más, Disco Más, Vea Ahorro
 */
const SOURCES = [
  { id:'cencopay',      name:'Cencopay',       url:'https://www.cencopay.com.ar',                   sourceType:'SCRAPING' },
  { id:'club-dia',      name:'Club Día',        url:'https://diaonline.supermercadosdia.com.ar',      sourceType:'SCRAPING' },
  { id:'comunidad-coto',name:'Comunidad Coto',  url:'https://www.coto.com.ar/legales',               sourceType:'SCRAPING' },
  { id:'mi-carrefour',  name:'Mi Carrefour',    url:'https://www.carrefour.com.ar/beneficios',       sourceType:'SCRAPING' },
  { id:'mi-changomas',  name:'Mi ChangoMás',    url:'https://www.changomas.com.ar',                  sourceType:'SCRAPING' },
  { id:'jumbo-mas',     name:'Jumbo Más',       url:'https://www.jumbo.com.ar/club-jumbo',           sourceType:'SCRAPING' },
  { id:'disco-mas',     name:'Disco Más',       url:'https://www.disco.com.ar',                      sourceType:'SCRAPING' },
  { id:'vea-ahorro',    name:'Vea Ahorro',      url:'https://www.veadigital.com.ar',                 sourceType:'SCRAPING' },
];
module.exports = SOURCES;
