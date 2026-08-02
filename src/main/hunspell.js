// Motor hunspell minimo: SO consulta (check), sem expansao.
// Le .aff/.dic do VERO pt-BR (LGPLv3 + MPL) e responde "essa palavra existe?".
import fs from 'node:fs';

export function carregarHunspell(affPath, dicPath) {
  const aff = fs.readFileSync(affPath, 'utf8');
  const dic = fs.readFileSync(dicPath, 'utf8');

  // ---- dicionario: palavra -> flags ----
  const dicMap = new Map();
  const linhas = dic.split('\n');
  for (let i = 1; i < linhas.length; i++) {
    const l = linhas[i].trim();
    if (!l) continue;
    const barra = l.indexOf('/');
    let palavra, flags;
    if (barra >= 0) { palavra = l.slice(0, barra); flags = l.slice(barra + 1); }
    else { palavra = l; flags = ''; }
    palavra = palavra.replace(/\t.*$/, '');
    if (!palavra) continue;
    const chave = palavra.toLowerCase();
    const antigo = dicMap.get(chave);
    dicMap.set(chave, antigo === undefined ? flags : antigo + flags);
  }

  // ---- afixos ----
  const sfxPorSufixo = new Map(); // ultimo(s) char(s) do append -> regras
  const pfxPorPrefixo = new Map();
  const sfxRegras = [];
  const pfxRegras = [];
  const proibida = new Set();

  const al = aff.split('\n');
  for (let i = 0; i < al.length; i++) {
    const l = al[i];
    if (l.startsWith('SFX ') || l.startsWith('PFX ')) {
      const p = l.trim().split(/\s+/);
      if (p.length >= 4 && (p[2] === 'Y' || p[2] === 'N') && /^\d+$/.test(p[3])) continue; // cabecalho
      if (p.length < 4) continue;
      const tipo = p[0], flag = p[1];
      const strip = p[2] === '0' ? '' : p[2];
      let add = p[3] === '0' ? '' : p[3];
      // append pode trazer flags proprias: "ado/BX"
      const b = add.indexOf('/');
      if (b >= 0) add = add.slice(0, b);
      const cond = p[4] && p[4] !== '.' ? p[4] : null;
      const regra = { flag, strip, add, cond: cond ? new RegExp(tipo === 'SFX' ? cond + '$' : '^' + cond) : null };
      if (tipo === 'SFX') {
        sfxRegras.push(regra);
        const k = add.slice(-2) || '';
        if (!sfxPorSufixo.has(k)) sfxPorSufixo.set(k, []);
        sfxPorSufixo.get(k).push(regra);
      } else {
        pfxRegras.push(regra);
        const k = add.slice(0, 2) || '';
        if (!pfxPorPrefixo.has(k)) pfxPorPrefixo.set(k, []);
        pfxPorPrefixo.get(k).push(regra);
      }
    }
  }
  const sfxVazio = sfxRegras.filter(r => r.add === '');
  const pfxVazio = pfxRegras.filter(r => r.add === '');

  function temFlag(palavra, flag) {
    const f = dicMap.get(palavra);
    return f !== undefined && f.includes(flag);
  }

  // desfaz um sufixo: devolve lista de radicais candidatos [{stem, flag}]
  function radicaisSfx(w) {
    const out = [];
    const chaves = [w.slice(-2), w.slice(-1), ''];
    const vistos = new Set();
    for (const k of chaves) {
      const grupo = k === '' ? sfxVazio : sfxPorSufixo.get(k);
      if (!grupo) continue;
      for (const r of grupo) {
        if (vistos.has(r)) continue;
        vistos.add(r);
        if (r.add && !w.endsWith(r.add)) continue;
        const base = w.slice(0, w.length - r.add.length) + r.strip;
        if (!base) continue;
        if (r.cond && !r.cond.test(base)) continue;
        out.push({ stem: base, flag: r.flag });
      }
    }
    return out;
  }

  function radicaisPfx(w) {
    const out = [];
    const chaves = [w.slice(0, 2), w.slice(0, 1), ''];
    const vistos = new Set();
    for (const k of chaves) {
      const grupo = k === '' ? pfxVazio : pfxPorPrefixo.get(k);
      if (!grupo) continue;
      for (const r of grupo) {
        if (vistos.has(r)) continue;
        vistos.add(r);
        if (r.add && !w.startsWith(r.add)) continue;
        const base = r.strip + w.slice(r.add.length);
        if (!base) continue;
        if (r.cond && !r.cond.test(base)) continue;
        out.push({ stem: base, flag: r.flag });
      }
    }
    return out;
  }

  const cache = new Map();
  function existe(palavra) {
    const w = palavra.toLowerCase();
    if (!w) return false;
    const c = cache.get(w);
    if (c !== undefined) return c;
    let r = checar(w);
    cache.set(w, r);
    return r;
  }

  function checar(w) {
    if (dicMap.has(w)) return true;
    for (const { stem, flag } of radicaisSfx(w)) {
      if (temFlag(stem, flag)) return true;
    }
    for (const { stem, flag } of radicaisPfx(w)) {
      if (temFlag(stem, flag)) return true;
      // prefixo + sufixo (cross product)
      for (const s of radicaisSfx(stem)) {
        if (temFlag(s.stem, s.flag) && temFlag(s.stem, flag)) return true;
      }
    }
    return false;
  }

  return { existe, dicMap, tamanho: dicMap.size, nSfx: sfxRegras.length, nPfx: pfxRegras.length };
}
