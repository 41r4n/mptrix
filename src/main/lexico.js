// =====================================================================
// lexico.mjs - corretor conservador por lexico para a Letra do MPTRIX
//
// Ideia: o whisper as vezes escreve algo que NAO EXISTE em portugues
// ("Batifica"). Quando isso acontece, trocamos pela palavra REAL mais
// proxima FONETICAMENTE. Se a palavra ja existe em portugues, nao se
// toca nela - mesmo que esteja errada no contexto. Falso positivo aqui
// e pior que erro deixado.
//
// 100% offline. Fonte do lexico: VERO pt-BR (LibreOffice/dictionaries),
// LGPLv3 + MPL - arquivos index.aff / index.dic embarcados no repo.
// Lista de frequencia (opcional, so pra desempate): hermitdave
// FrequencyWords pt_br (CC-BY-SA 4.0), cortada nas N mais comuns.
// =====================================================================
import fs from 'node:fs';
import path from 'node:path';
import { carregarHunspell } from './hunspell.js';

// ---------------------------------------------------------------------
// 1. FONETICA pt-BR  (grafema -> som aproximado, do jeito que se canta)
// ---------------------------------------------------------------------
// Simbolos: S(s/z/c cedilha) X(ch/x) J(j/g fraco) K G R(r forte) r(r brando)
//           L(lh) N(nh) M m n p b(b/v) t d f w(l final) + vogais a e i o u
// tira acento MAS preserva o til (nasalidade importa pra fonetica)
const SEM_ACENTO = (s) => s.normalize('NFD').replace(/[̀-̂̄-ͯ]/g, '').normalize('NFC');
// tira tudo, inclusive til - usado pra classificar "so mudou acento"
const SEM_NADA = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');

export function fonetizar(palavra) {
  let s = palavra.toLowerCase();
  // guarda nasalidade de til antes de tirar acento
  s = s.replace(/[ãâ]/g, 'ã').replace(/[õô]/g, 'õ');
  s = s.replace(/ç/g, 'S');
  s = SEM_ACENTO(s).replace(/̃/g, '');
  s = s.replace(/ã/g, 'a~').replace(/õ/g, 'o~');

  let o = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i], n = s[i + 1] || '', n2 = s[i + 2] || '';
    const proxVogal = 'aeiou'.includes(n);
    const proxEI = n === 'e' || n === 'i';

    if (c === 'S') { o += 'S'; continue; }              // ja veio de cedilha
    if (c === '~') { o += '~'; continue; }
    if (c === 'l' && n === 'h') { o += 'L'; i++; continue; }
    if (c === 'n' && n === 'h') { o += 'N'; i++; continue; }
    if (c === 'c' && n === 'h') { o += 'X'; i++; continue; }
    if (c === 'r' && n === 'r') { o += 'R'; i++; continue; }
    if (c === 's' && n === 's') { o += 'S'; i++; continue; }
    if (c === 's' && n === 'c' && (n2 === 'e' || n2 === 'i')) { o += 'S'; i++; continue; }
    if (c === 'x' && n === 'c' && (n2 === 'e' || n2 === 'i')) { o += 'S'; i++; continue; }
    if (c === 'q' && n === 'u') { o += 'K'; i++; if (n2 === 'e' || n2 === 'i') { } continue; }
    if (c === 'g' && n === 'u' && (n2 === 'e' || n2 === 'i')) { o += 'G'; i++; continue; }
    if (c === 'h') { continue; }                        // h nunca soa
    if (c === 'c') { o += proxEI ? 'S' : 'K'; continue; }
    if (c === 'k') { o += 'K'; continue; }
    if (c === 'q') { o += 'K'; continue; }
    if (c === 'g') { o += proxEI ? 'J' : 'G'; continue; }
    if (c === 'j') { o += 'J'; continue; }
    if (c === 'x') { o += 'X'; continue; }
    if (c === 'z') { o += 'S'; continue; }
    if (c === 's') { o += 'S'; continue; }
    if (c === 'b' || c === 'v' || c === 'w') { o += 'b'; continue; }  // b/v se fundem no canto
    if (c === 'r') { o += (i === 0) ? 'R' : 'r'; continue; }
    if (c === 'l') {
      // l travando silaba vira semivogal no BR: "sol" ~ "sou"
      o += (i === s.length - 1 || !proxVogal) ? 'w' : 'l';
      continue;
    }
    if (c === 'm' || c === 'n') {
      // m/n travando silaba = nasalizacao
      o += (i === s.length - 1 || !proxVogal) ? '~' : c;
      continue;
    }
    if ('aeiou'.includes(c)) { o += c; continue; }
    if ('tdpfy'.includes(c)) { o += c; continue; }
    o += c;
  }

  // reducao de vogal atona final (BR): -o -> u, -e -> i
  o = o.replace(/o$/, 'u').replace(/e$/, 'i');
  // ditongos/hiatos iguais colapsam
  o = o.replace(/(.)\1+/g, '$1');
  return o;
}

// custo de troca entre dois fonemas (0 = igual, 1 = nada a ver)
const VOGAIS = new Set(['a', 'e', 'i', 'o', 'u']);
const PARES = [
  ['e', 'i', 0.12], ['o', 'u', 0.12], ['a', 'e', 0.5], ['a', 'o', 0.5], ['e', 'o', 0.6], ['i', 'u', 0.5],
  ['S', 'X', 0.3], ['S', 'J', 0.5], ['X', 'J', 0.3],
  ['L', 'l', 0.3], ['N', 'n', 0.3], ['n', '~', 0.3], ['m', '~', 0.3], ['m', 'n', 0.25],
  ['R', 'r', 0.25], ['r', 'w', 0.55], ['w', 'u', 0.3], ['l', 'w', 0.3],
  ['K', 'G', 0.4], ['t', 'd', 0.4], ['p', 'b', 0.4], ['f', 'b', 0.45],
  ['t', 'X', 0.5], ['d', 'J', 0.5], ['i', 'y', 0.2], ['S', '~', 0.8],
];
const CUSTO = new Map();
for (const [a, b, c] of PARES) { CUSTO.set(a + b, c); CUSTO.set(b + a, c); }

function custoSub(a, b) {
  if (a === b) return 0;
  const c = CUSTO.get(a + b);
  if (c !== undefined) return c;
  const va = VOGAIS.has(a) || a === '~', vb = VOGAIS.has(b) || b === '~';
  if (va !== vb) return 1.0;   // vogal x consoante: caro
  return va ? 0.7 : 0.95;
}
function custoIndel(x) {
  if (VOGAIS.has(x) || x === '~') return 0.45;  // vogal some/aparece facil no canto
  if (x === 'S' || x === 'w' || x === 'r') return 0.6;
  return 0.9;
}

// distancia fonetica ponderada (Levenshtein com matriz de custo)
export function distanciaFonetica(a, b) {
  const A = fonetizar(a), B = fonetizar(b);
  const n = A.length, m = B.length;
  let prev = new Float64Array(m + 1), cur = new Float64Array(m + 1);
  for (let j = 1; j <= m; j++) prev[j] = prev[j - 1] + custoIndel(B[j - 1]);
  for (let i = 1; i <= n; i++) {
    cur[0] = prev[0] + custoIndel(A[i - 1]);
    for (let j = 1; j <= m; j++) {
      let v = prev[j - 1] + custoSub(A[i - 1], B[j - 1]);
      const d = prev[j] + custoIndel(A[i - 1]);
      if (d < v) v = d;
      const ins = cur[j - 1] + custoIndel(B[j - 1]);
      if (ins < v) v = ins;
      cur[j] = v;
    }
    const t = prev; prev = cur; cur = t;
  }
  return prev[m];
}

// ---------------------------------------------------------------------
// 2. GERACAO DE CANDIDATAS - variacoes foneticamente plausiveis
// ---------------------------------------------------------------------
const VOG_ESCRITA = ['a', 'e', 'i', 'o', 'u', 'á', 'é', 'ê', 'í', 'ó', 'ô', 'ú', 'ã', 'õ'];
const CONFUSAO = {
  b: ['v'], v: ['b'], s: ['z', 'ç', 'c', 'x'], z: ['s', 'ç'], c: ['s', 'ç', 'q', 'k'],
  ç: ['s', 'c', 'z'], x: ['s', 'ch', 'z'], j: ['g'], g: ['j', 'gu'], q: ['c', 'k'], k: ['c', 'qu'],
  l: ['r', 'u'], r: ['l', 'rr'], n: ['m', 'nh'], m: ['n'], h: [''], p: ['b'], t: ['d'], d: ['t'], f: ['v'],
};
// vogais trocam entre si com liberdade: quem filtra e a distancia fonetica,
// nao a geracao. Gerar pouco cria ponto cego e faz a margem mentir.
for (const v of ['a', 'e', 'i', 'o', 'u', 'á', 'é', 'ê', 'í', 'ó', 'ô', 'ú', 'ã', 'õ', 'à', 'â', 'y']) {
  CONFUSAO[v] = VOG_ESCRITA.concat(['y']).filter(x => x !== v);
}
CONFUSAO.w = ['v', 'u'];

function* variacoes(w) {
  const L = w.length;
  // 1) substituicao por confusao
  for (let i = 0; i < L; i++) {
    const alt = CONFUSAO[w[i]];
    if (!alt) continue;
    for (const a of alt) yield w.slice(0, i) + a + w.slice(i + 1);
  }
  // 2) delecao
  for (let i = 0; i < L; i++) yield w.slice(0, i) + w.slice(i + 1);
  // 3) insercao de vogal (o caso "batifica" -> "beatifica")
  for (let i = 0; i <= L; i++) for (const v of VOG_ESCRITA) yield w.slice(0, i) + v + w.slice(i);
  // 4) insercao de consoante comum de ser engolida
  for (let i = 0; i <= L; i++) for (const c of ['s', 'r', 'l', 'm', 'n', 'h', 'c']) yield w.slice(0, i) + c + w.slice(i);
  // 5) transposicao
  for (let i = 0; i + 1 < L; i++) yield w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2);
  // 6) digrafos
  for (let i = 0; i < L; i++) {
    if (w[i] === 'l') yield w.slice(0, i) + 'lh' + w.slice(i + 1);
    if (w[i] === 'n') yield w.slice(0, i) + 'nh' + w.slice(i + 1);
    if (w[i] === 'c') yield w.slice(0, i) + 'ch' + w.slice(i + 1);
    if (w[i] === 'r') yield w.slice(0, i) + 'rr' + w.slice(i + 1);
    if (w[i] === 's') yield w.slice(0, i) + 'ss' + w.slice(i + 1);
  }
  if (w.startsWith('lh')) yield 'li' + w.slice(2);
  if (w.startsWith('li')) yield 'lh' + w.slice(2);
}

// ---------------------------------------------------------------------
// 3. CARGA
// ---------------------------------------------------------------------
export function carregarLexico(base = '.') {
  const hs = carregarHunspell(path.join(base, 'pt-BR.aff'), path.join(base, 'pt-BR.dic'));
  const freq = new Map();
  const fp = path.join(base, 'freq-pt-BR.txt');
  const fpAlt = path.join(base, 'freq-pt-BR.txt');
  const arq = fs.existsSync(fp) ? fp : (fs.existsSync(fpAlt) ? fpAlt : null);
  if (arq) {
    const linhas = fs.readFileSync(arq, 'utf8').split('\n');
    const N = Math.min(linhas.length, 120000);
    for (let i = 0; i < N; i++) {
      const p = linhas[i].split(' ');
      if (p.length < 2) continue;
      freq.set(p[0], +p[1] || 1);
    }
  }
  // guarda de ingles: letra brasileira tem "baby", "love", "night"...
  // e nenhuma delas esta no dicionario pt - sem isso o corretor as destroi.
  const ingles = new Set();
  const ip = path.join(base, 'ingles.txt');
  if (fs.existsSync(ip)) for (const l of fs.readFileSync(ip, 'utf8').split('\n')) { const w = l.trim(); if (w) ingles.add(w); }

  return { existe: hs.existe, freq, ingles, hs };
}

// Cheiro de palavra estrangeira: o portugues nao escreve assim.
// Sem isso o corretor "aportuguesa" nome proprio de gringo
// (nathan->natan, lauren->laureno, mulder->muldera) - estrago puro.
export function pareceEstrangeira(w) {
  const s = SEM_NADA(w.toLowerCase());
  if (/[kwy]/.test(s)) return true;                       // k, w, y nao sao do alfabeto pt
  if (/(th|ph|ck|sh|wh|ll|nn|tt|ff|gg|pp|bb|dd|mm|ee|oo|sch)/.test(s)) return true;
  if (/[bcdfgjklmnpqrstvxz]$/.test(s) && !/[lrszmx]$/.test(s)) return true; // pt so termina em l r s z m x
  if (/(ay|ey|oy|uy)$/.test(s)) return true;
  return false;
}

// onomatopeia / vocalize: "lalaia", "iêiê", "ôôô", "tumtum", "trarrá"
export function ehVocalize(w) {
  const s = SEM_NADA(w.toLowerCase());
  if (/(.)\1\1/.test(s)) return true;                 // 3 letras iguais seguidas
  if (/^[aeiouh]+$/.test(s)) return true;             // so vogal
  const m = s.match(/^(..+?)\1$/);                    // silaba repetida inteira
  if (m) return true;
  if (/^(..?)\1{2,}/.test(s)) return true;            // padrao repetido 3x
  const vog = (s.match(/[aeiou]/g) || []).length;
  if (vog / s.length > 0.72) return true;             // quase so vogal
  return false;
}

// ---------------------------------------------------------------------
// 4. CORRETOR
// ---------------------------------------------------------------------
export const PADRAO = {
  minLetras: 5,        // palavra curta demais = risco alto, nao mexe
  limiteDist: 0.75,    // distancia fonetica maxima aceita
  margem: 0.35,        // a melhor tem que ganhar da 2a por essa folga
  minFreq: 30,         // candidata precisa aparecer no corpus falado
  puloMaiuscula: true, // nome proprio no meio da frase: nao mexe
  unicaB: true,        // troca fonetica so quando existe UMA candidata valida
};

function limpa(t) {
  const m = t.match(/^([^\p{L}]*)(.*?)([^\p{L}]*)$/su);
  return { pre: m[1] || '', nucleo: m[2] || '', pos: m[3] || '' };
}

export function corrigirPalavra(bruta, lex, opt = PADRAO, ehInicio = false) {
  const { nucleo } = limpa(bruta);
  if (!nucleo) return null;
  const w = nucleo.toLowerCase();
  if (w.length < opt.minLetras) return null;
  if (!/^[a-záàâãéêíóôõúüçñ'-]+$/i.test(w)) return null;
  if (w.includes('-') || w.includes("'")) return null;
  // nome proprio no meio da frase fica em paz
  if (opt.puloMaiuscula && !ehInicio && nucleo[0] === nucleo[0].toUpperCase() && nucleo[0] !== nucleo[0].toLowerCase()) return null;
  if (lex.existe(w)) return null;   // <<< regra de ouro: existe, nao se toca
  // palavra estrangeira ou vocalize: legitimamente fora do lexico, deixa em paz
  if (lex.ingles && lex.ingles.has(SEM_NADA(w))) return null;
  if (ehVocalize(w)) return null;
  if (pareceEstrangeira(w)) return null;

  // gera e filtra candidatas
  const vistos = new Set();
  const cands = [];
  for (const v of variacoes(w)) {
    if (v === w || vistos.has(v)) continue;
    vistos.add(v);
    if (v.length < 3) continue;
    if (!lex.existe(v)) continue;
    const f = lex.freq.get(v) || 0;
    const d = distanciaFonetica(w, v);
    cands.push({ p: v, d, f });
  }
  if (!cands.length) return null;

  // pontua: distancia fonetica + castigo por raridade
  for (const c of cands) {
    const raro = c.f >= opt.minFreq ? 0 : (c.f > 0 ? 0.15 : 0.30);
    c.score = c.d + raro;
  }
  cands.sort((a, b) => a.score - b.score || b.f - a.f);
  const melhor = cands[0];
  // segunda DIFERENTE foneticamente (variantes so de acento nao contam como rival)
  const rival = cands.find(c => fonetizar(c.p) !== fonetizar(melhor.p));

  if (melhor.d > opt.limiteDist) return null;
  if (rival && (rival.score - melhor.score) < opt.margem) return null;

  // tier A = so acento (mesmas letras): risco praticamente zero
  // tier B = troca fonetica de verdade
  const soAcento = SEM_NADA(melhor.p) === SEM_NADA(w);
  // troca fonetica de verdade so passa se o lexico apontou UMA saida so.
  // duas saidas plausiveis = o corretor esta chutando; chute aqui e estrago.
  if (opt.unicaB && !soAcento && cands.length !== 1) return null;
  return {
    de: nucleo, para: casar(nucleo, melhor.p), d: melhor.d, f: melhor.f,
    rival: rival ? rival.p : null, nCands: cands.length, tier: soAcento ? 'A' : 'B',
  };
}

// so pra diagnostico: lista as candidatas validas, ja pontuadas
export function candidatas(w, lex, opt = PADRAO) {
  w = w.toLowerCase();
  const vistos = new Set(); const cands = [];
  for (const v of variacoes(w)) {
    if (v === w || vistos.has(v)) continue;
    vistos.add(v);
    if (v.length < 3 || !lex.existe(v)) continue;
    const f = lex.freq.get(v) || 0;
    const d = distanciaFonetica(w, v);
    cands.push({ p: v, d: +d.toFixed(3), f, score: +(d + (f >= opt.minFreq ? 0 : (f > 0 ? 0.15 : 0.30))).toFixed(3) });
  }
  return cands.sort((a, b) => a.score - b.score || b.f - a.f);
}

function casar(orig, nova) {
  if (orig[0] === orig[0].toUpperCase() && orig[0] !== orig[0].toLowerCase())
    return nova[0].toUpperCase() + nova.slice(1);
  return nova;
}

// segments: [{text, words:[{t0,t1,text}]}]  -> so o texto muda, tempo nunca
export function corrigirVersos(segments, lex, opt = PADRAO) {
  const trocas = [];
  const saida = segments.map((seg) => {
    const words = (seg.words || []).map((w, i) => {
      const r = corrigirPalavra(w.text, lex, opt, i === 0);
      if (!r) return w;
      const { pre, nucleo, pos } = limpa(w.text);
      trocas.push({ de: r.de, para: r.para, d: +r.d.toFixed(3), f: r.f, rival: r.rival, verso: seg.text });
      return { ...w, text: pre + r.para + pos };
    });
    const text = words.length ? juntar(seg.text, seg.words || [], words) : seg.text;
    return { ...seg, words, text };
  });
  return { segments: saida, trocas };
}

function juntar(original, antigas, novas) {
  let t = original;
  for (let i = 0; i < antigas.length; i++) {
    if (antigas[i].text !== novas[i].text) {
      const a = limpa(antigas[i].text).nucleo, b = limpa(novas[i].text).nucleo;
      if (a && b) t = t.replace(new RegExp('(^|[^\\p{L}])' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}])', 'u'), '$1' + b);
    }
  }
  return t;
}
