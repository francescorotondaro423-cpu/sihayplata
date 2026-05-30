'use strict';

const SUPERMARKET_META = {
  'Carrefour':  { color:'#1d4ed8', abbr:'CF', chain:'Carrefour',  country:'FR' },
  'ChangoMás':  { color:'#16a34a', abbr:'CM', chain:'Walmart',    country:'AR' },
  'Jumbo':      { color:'#dc2626', abbr:'JU', chain:'Cencosud',   country:'AR' },
  'Disco':      { color:'#dc2626', abbr:'DI', chain:'Cencosud',   country:'AR' },
  'Vea':        { color:'#dc2626', abbr:'VE', chain:'Cencosud',   country:'AR' },
  'Coto':       { color:'#0369a1', abbr:'CO', chain:'Coto',       country:'AR' },
  'Día%':       { color:'#dc2626', abbr:'D%', chain:'Día',        country:'ES' },
};

class SupermarketService {
  getAll()    { return Object.entries(SUPERMARKET_META).map(([id, meta]) => ({ id, ...meta })); }
  getById(id) { return SUPERMARKET_META[id] ? { id, ...SUPERMARKET_META[id] } : null; }
  getMeta(id) { return SUPERMARKET_META[id] || { color:'#64748b', abbr:id.slice(0,2).toUpperCase(), chain:id, country:'AR' }; }
}

module.exports = new SupermarketService();
