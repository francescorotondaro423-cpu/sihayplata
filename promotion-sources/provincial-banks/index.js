'use strict';
/* Bancos Provinciales — fuentes de verificación */
const SOURCES = [
  { id:'cuenta-santa-fe',  name:'Cuenta Santa Fe',    url:'https://www.bancosantafe.com.ar',             sourceType:'SCRAPING' },
  { id:'entre-rios',       name:'Billetera Entre Ríos',url:'https://www.bancoentre.com.ar',             sourceType:'SCRAPING' },
  { id:'corrientes',       name:'Banco Corrientes',   url:'https://www.bancocorrientes.com.ar',          sourceType:'SCRAPING' },
  { id:'formosa',          name:'Banco Formosa',      url:'https://www.bancodeformosa.com.ar',           sourceType:'SCRAPING' },
  { id:'la-pampa',         name:'Banco La Pampa',     url:'https://www.blp.com.ar',                      sourceType:'SCRAPING' },
  { id:'chubut',           name:'Banco del Chubut',   url:'https://www.bancochubut.com.ar',              sourceType:'SCRAPING' },
  { id:'neuquen',          name:'Banco del Neuquén',  url:'https://www.bpn.com.ar',                      sourceType:'SCRAPING' },
];
module.exports = SOURCES;
