'use strict';
/* Billeteras Bancarias — fuentes de verificación
 * Prioridad: Cuenta DNI, MODO, BNA+, Galicia, Santander, BBVA, Macro, ICBC, Supervielle, Ciudad, Comafi, Credicoop
 */
const SOURCES = [
  { id:'cuenta-dni',   name:'Cuenta DNI',    url:'https://www.bancoprovincia.com.ar/cuentadni', sourceType:'SCRAPING' },
  { id:'modo',         name:'MODO',          url:'https://www.modo.com.ar/promociones',          sourceType:'SCRAPING' },
  { id:'bna-plus',     name:'BNA+',          url:'https://www.bna.com.ar',                       sourceType:'SCRAPING' },
  { id:'galicia',      name:'Galicia',       url:'https://www.galicia.ar/beneficios',            sourceType:'SCRAPING' },
  { id:'santander',    name:'Santander',     url:'https://www.santander.com.ar/banco/online/beneficios', sourceType:'SCRAPING' },
  { id:'bbva',         name:'BBVA',          url:'https://www.bbva.com.ar/beneficios',           sourceType:'SCRAPING' },
  { id:'macro',        name:'Macro',         url:'https://www.macro.com.ar/descuentos',          sourceType:'SCRAPING' },
  { id:'icbc',         name:'ICBC',          url:'https://www.icbc.com.ar/ICBC/Beneficios',      sourceType:'SCRAPING' },
  { id:'supervielle',  name:'Supervielle',   url:'https://www.supervielle.com.ar/beneficios',    sourceType:'SCRAPING' },
  { id:'ciudad',       name:'Ciudad',        url:'https://www.bancociudad.com.ar/beneficios',    sourceType:'SCRAPING' },
  { id:'comafi',       name:'Comafi',        url:'https://www.comafi.com.ar/descuentos',         sourceType:'SCRAPING' },
  { id:'credicoop',    name:'Credicoop',     url:'https://www.bancocredicoop.coop/beneficios',   sourceType:'SCRAPING' },
];
module.exports = SOURCES;
