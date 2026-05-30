'use strict';
/* Billeteras Fintech — fuentes de verificación
 * Prioridad: Mercado Pago, Personal Pay, Ualá, Naranja X, Prex, Brubank, Lemon, Belo, LetsBit
 */
const SOURCES = [
  { id:'mercado-pago',  name:'Mercado Pago',  url:'https://www.mercadopago.com.ar',          sourceType:'JSON_ENDPOINT' },
  { id:'personal-pay',  name:'Personal Pay',  url:'https://www.personalpay.com.ar/beneficios',sourceType:'SCRAPING'      },
  { id:'uala',          name:'Ualá',          url:'https://www.uala.com.ar',                  sourceType:'SCRAPING'      },
  { id:'naranja-x',     name:'Naranja X',     url:'https://www.naranjax.com',                 sourceType:'SCRAPING'      },
  { id:'prex',          name:'Prex',          url:'https://www.prexcard.com.ar',              sourceType:'SCRAPING'      },
  { id:'brubank',       name:'Brubank',       url:'https://www.brubank.com',                  sourceType:'SCRAPING'      },
  { id:'lemon',         name:'Lemon',         url:'https://www.lemon.me',                     sourceType:'SCRAPING'      },
  { id:'belo',          name:'Belo',          url:'https://belo.app',                         sourceType:'SCRAPING'      },
  { id:'letsbit',       name:'LetsBit',       url:'https://letsbit.io',                       sourceType:'SCRAPING'      },
];
module.exports = SOURCES;
