'use strict';

const WALLET_META = {
  /* ── Fintech ───────────────────────────────────────────── */
  'Mercado Pago':          { bank: null,                   color: '#009de0', abbr: 'MP', type: 'FINTECH'  },
  'Personal Pay':          { bank: 'Personal (Telecom)',   color: '#0050d8', abbr: 'PP', type: 'TELCO'    },
  'Ualá':                  { bank: null,                   color: '#ff6b35', abbr: 'UA', type: 'FINTECH'  },
  'Naranja X':             { bank: null,                   color: '#ea580c', abbr: 'NX', type: 'FINTECH'  },
  'Prex':                  { bank: null,                   color: '#6d28d9', abbr: 'PX', type: 'PREPAID'  },
  'Brubank':               { bank: null,                   color: '#7c3aed', abbr: 'BK', type: 'NEOBANK'  },
  'Lemon Cash':            { bank: null,                   color: '#ca8a04', abbr: 'LM', type: 'CRYPTO'   },
  'Belo':                  { bank: null,                   color: '#18181b', abbr: 'BE', type: 'CRYPTO'   },
  'LetsBit':               { bank: null,                   color: '#164e63', abbr: 'LB', type: 'FINTECH'  },

  /* ── Billeteras Bancarias ───────────────────────────────── */
  'Cuenta DNI':            { bank: 'Banco Provincia',      color: '#16a34a', abbr: 'CD', type: 'DIGITAL'  },
  'MODO':                  { bank: 'Multi-banco',          color: '#1d4ed8', abbr: 'MO', type: 'INTEROP'  },
  'BNA+':                  { bank: 'Banco Nación',         color: '#1e40af', abbr: 'BN', type: 'DIGITAL'  },
  'Banco Galicia':         { bank: 'Banco Galicia',        color: '#b91c1c', abbr: 'GA', type: 'DIGITAL'  },
  'Santander':             { bank: 'Banco Santander',      color: '#dc2626', abbr: 'SA', type: 'DIGITAL'  },
  'BBVA':                  { bank: 'Banco BBVA',           color: '#0284c7', abbr: 'BV', type: 'DIGITAL'  },
  'Banco Macro':           { bank: 'Banco Macro',          color: '#c2410c', abbr: 'MA', type: 'DIGITAL'  },
  'ICBC':                  { bank: 'ICBC',                 color: '#b91c1c', abbr: 'IC', type: 'DIGITAL'  },
  'Supervielle':           { bank: 'Banco Supervielle',    color: '#be185d', abbr: 'SV', type: 'DIGITAL'  },
  'Banco Ciudad':          { bank: 'Banco Ciudad',         color: '#059669', abbr: 'BC', type: 'DIGITAL'  },
  'Banco Comafi':          { bank: 'Banco Comafi',         color: '#7e22ce', abbr: 'CO', type: 'DIGITAL'  },
  'Banco Credicoop':       { bank: 'Banco Credicoop',      color: '#65a30d', abbr: 'CR', type: 'DIGITAL'  },

  /* ── Apps Retail ────────────────────────────────────────── */
  'Cencopay':              { bank: 'Cencosud',             color: '#1e3a8a', abbr: 'CX', type: 'RETAIL'   },
  'Club Día':              { bank: null,                   color: '#dc2626', abbr: 'CL', type: 'LOYALTY'  },
  'Comunidad Coto':        { bank: null,                   color: '#0369a1', abbr: 'CC', type: 'LOYALTY'  },
  'Mi Carrefour':          { bank: null,                   color: '#1e40af', abbr: 'MF', type: 'LOYALTY'  },
  'Mi ChangoMás':          { bank: null,                   color: '#15803d', abbr: 'MH', type: 'LOYALTY'  },
  'Jumbo Más':             { bank: 'Cencosud',             color: '#dc2626', abbr: 'JM', type: 'LOYALTY'  },
  'Disco Más':             { bank: 'Cencosud',             color: '#dc2626', abbr: 'DM', type: 'LOYALTY'  },
  'Vea Ahorro':            { bank: 'Cencosud',             color: '#ef4444', abbr: 'VA', type: 'LOYALTY'  },

  /* ── Tarjetas ────────────────────────────────────────────── */
  'Visa Beneficios':       { bank: null,                   color: '#1d4ed8', abbr: 'VI', type: 'CARD'     },
  'Mastercard Surprize':   { bank: null,                   color: '#f97316', abbr: 'MS', type: 'CARD'     },
  'American Express Offers':{ bank: null,                  color: '#0ea5e9', abbr: 'AX', type: 'CARD'     },

  /* ── Bancos Provinciales ────────────────────────────────── */
  'Cuenta Santa Fe':       { bank: 'Banco Santa Fe',       color: '#3b82f6', abbr: 'SF', type: 'DIGITAL'  },
  'Billetera Entre Ríos':  { bank: 'Banco Entre Ríos',    color: '#15803d', abbr: 'ER', type: 'DIGITAL'  },
  'Banco Corrientes':      { bank: 'Banco de Corrientes',  color: '#dc2626', abbr: 'CO', type: 'DIGITAL'  },
  'Banco Formosa':         { bank: 'Banco de Formosa',     color: '#0284c7', abbr: 'FO', type: 'DIGITAL'  },
  'Banco La Pampa':        { bank: 'Banco de La Pampa',    color: '#059669', abbr: 'LP', type: 'DIGITAL'  },
  'Banco del Chubut':      { bank: 'Banco del Chubut',     color: '#0891b2', abbr: 'CH', type: 'DIGITAL'  },
  'Banco del Neuquén':     { bank: 'Banco del Neuquén',    color: '#2563eb', abbr: 'NQ', type: 'DIGITAL'  },
};

class WalletService {
  getAll()       { return Object.entries(WALLET_META).map(([id, meta]) => ({ id, ...meta })); }
  getById(id)    { return WALLET_META[id] ? { id, ...WALLET_META[id] } : null; }
  getMeta(id)    { return WALLET_META[id] || { bank: null, color: '#64748b', abbr: (id||'?').slice(0, 2).toUpperCase(), type: 'OTHER' }; }
}

module.exports = new WalletService();
