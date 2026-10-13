/* Runtime for the mechanically translated original logic (engine/orig.js).
   Mirrors oracle/dalvik.mjs value semantics exactly: int = number, long = BigInt,
   float/double = Flt/Dbl wrappers, null may appear as null or as the int 0.
   Works as a classic script in the browser/WebView and under Node. */
(function (g) {
  'use strict';
  class JavaThrow extends Error { constructor(obj) { super('JavaThrow ' + (obj && obj.cls) + ' ' + ((obj && obj.msg) || '')); this.obj = obj; } }
  class Flt { constructor(v) { this.v = Math.fround(v); } }
  class Dbl { constructor(v) { this.v = v; } }
  const f32 = new Float32Array(1), i32 = new Int32Array(f32.buffer), f64 = new Float64Array(1), i64 = new BigInt64Array(f64.buffer);
  const toF = x => x instanceof Flt ? x.v : (typeof x === 'number' ? (i32[0] = x, f32[0]) : 0);
  const toD = x => x instanceof Dbl ? x.v : (typeof x === 'bigint' ? (i64[0] = BigInt.asIntN(64, x), f64[0]) : (x instanceof Flt ? x.v : 0));
  const L = x => typeof x === 'bigint' ? x : (x instanceof Dbl ? (f64[0] = x.v, i64[0]) : BigInt(x | 0));
  const I = x => typeof x === 'number' ? x | 0 : (x instanceof Flt ? (f32[0] = x.v, i32[0]) : (x === true ? 1 : x ? Number(BigInt.asIntN(32, L(x))) : 0));
  const w64 = x => BigInt.asIntN(64, x);

  const RT = { JavaThrow, Flt, Dbl, toF, toD, L, I, C: Object.create(null), M: Object.create(null), shims: new Map(), sstatics: new Map(), now: new Date(), cur: null, log: [], random: n => Math.floor(Math.random() * n), res: null };
  const C = RT.C, M = RT.M;
  const jthrow = RT.jthrow = (cls, msg) => { throw new JavaThrow({ cls, f: {}, msg }); };
  const D0 = RT.D0 = new Dbl(0), F0 = RT.F0 = new Flt(0);
  RT.defVal = t => { const c = t[0]; return c === 'J' ? 0n : c === 'D' ? D0 : c === 'F' ? F0 : (c === 'L' || c === '[') ? null : 0; };

  // ---- classes
  RT.IC = desc => { const c = C[desc]; if (!c || c.inited) return; c.inited = true; if (c.sinit) c.sinit(c.statics); const ci = M[desc + '.<clinit>:()V']; if (ci) ci(); };
  RT.find = (desc, key) => { let c = C[desc], d = desc; while (c) { const m = M[d + '.' + key]; if (m) return m; d = c.sup; c = C[d]; } return null; };
  const fwBase = desc => { let d = desc; while (C[d] && C[C[d].sup]) d = C[d].sup; return C[d] ? C[d].sup : d; };
  RT.SG = (chain, name, def) => { for (let i = 0; i < chain.length; i++) RT.IC(chain[i]); const s = C[chain[chain.length - 1]].statics; const v = s[name]; return v === undefined ? def : v; };
  RT.SP = (decl, name, v) => { RT.IC(decl); C[decl].statics[name] = v; };
  RT.FS = k => { if (RT.sstatics.has(k)) return RT.sstatics.get(k); throw new Error('NOSTATIC ' + k); };

  // ---- objects / arrays
  RT.G = (o, n, d) => { if (o == null) jthrow('Ljava/lang/NullPointerException;', 'iget ' + n); const v = o.f[n]; return v === undefined ? d : v; };
  RT.P = (o, n, v) => { if (o == null) jthrow('Ljava/lang/NullPointerException;', 'iput ' + n); o.f[n] = v; };
  RT.NA = (n, type) => { const arr = new Array(n).fill(RT.defVal(type.slice(1))); arr.t = type; return arr; };
  RT.AL = a => { if (a == null) jthrow('Ljava/lang/NullPointerException;'); return a.length; };
  RT.AG = (arr, ix) => { if (arr == null) jthrow('Ljava/lang/NullPointerException;', 'aget'); if (ix < 0 || ix >= arr.length) jthrow('Ljava/lang/ArrayIndexOutOfBoundsException;', 'len=' + arr.length + ' ix=' + ix); return arr[ix]; };
  RT.AP = (arr, ix, v) => { if (arr == null) jthrow('Ljava/lang/NullPointerException;', 'aput'); if (ix < 0 || ix >= arr.length) jthrow('Ljava/lang/ArrayIndexOutOfBoundsException;', 'len=' + arr.length + ' ix=' + ix); arr[ix] = v; };
  RT.APB = (arr, ix, v) => RT.AP(arr, ix, (I(v) << 24) >> 24);
  RT.FA = (arr, data, w) => { const ch = w === 2 && arr.t === '[C'; for (let k = 0; k < data.length; k++) arr[k] = ch ? data[k] & 0xffff : data[k]; };
  RT.IO = (o, type) => { if (o == null) return 0; if (typeof o === 'string') return /String|CharSequence|Object/.test(type) ? 1 : 0; let cd = o.cls; while (cd) { if (cd === type) return 1; const cc = C[cd]; cd = cc ? cc.sup : null; } return 0; };

  // ---- comparisons
  RT.EQ = (x, y) => x === y || (x == null && y == null) || (x == null && y === 0) || (x === 0 && y == null);
  RT.Z = x => x === 0 || x == null || x === false;
  RT.CL = (a, b) => { const x = L(a), y = L(b); return x < y ? -1 : x > y ? 1 : 0; };
  RT.CF = (a, b, gt) => { const x = toF(a), y = toF(b); return (isNaN(x) || isNaN(y)) ? (gt ? 1 : -1) : x < y ? -1 : x > y ? 1 : 0; };
  RT.CD = (a, b, gt) => { const x = toD(a), y = toD(b); return (isNaN(x) || isNaN(y)) ? (gt ? 1 : -1) : x < y ? -1 : x > y ? 1 : 0; };

  // ---- arithmetic (same rules as the interpreter's arith())
  const trunc = (n, lo, hi) => isNaN(n) ? 0 : n <= lo ? lo : n >= hi ? hi : Math.trunc(n);
  RT.CONV = (op, v) => {
    const p = op.split('-'), from = p[0], to = p[2];
    const src = from === 'int' ? I(v) : from === 'long' ? L(v) : from === 'float' ? toF(v) : toD(v);
    switch (to) {
      case 'long': return w64(from === 'int' ? BigInt(src) : BigInt(trunc(src, -9223372036854775808, 9223372036854775807)));
      case 'int': return from === 'long' ? Number(BigInt.asIntN(32, src)) : trunc(src, -2147483648, 2147483647);
      case 'float': return new Flt(Number(src));
      case 'double': return new Dbl(Number(src));
      case 'byte': return (src << 24) >> 24;
      case 'char': return src & 0xffff;
      case 'short': return (src << 16) >> 16;
    }
    throw new Error('conv ' + op);
  };
  RT.NEG = (kind, ty, v) => ty === 'int' ? (kind === 'neg' ? (-I(v)) | 0 : ~I(v)) : ty === 'long' ? w64(kind === 'neg' ? -L(v) : ~L(v)) : ty === 'float' ? new Flt(-toF(v)) : new Dbl(-toD(v));
  RT.AR = (kind, ty, x, y) => {
    if (ty === 'int') {
      x = I(x); y = I(y); let r;
      switch (kind) {
        case 'add': r = x + y; break; case 'sub': r = x - y; break; case 'mul': r = Math.imul(x, y); break;
        case 'div': if (y === 0) jthrow('Ljava/lang/ArithmeticException;', 'div0'); r = Math.trunc(x / y); break;
        case 'rem': if (y === 0) jthrow('Ljava/lang/ArithmeticException;', 'rem0'); r = x % y; break;
        case 'and': r = x & y; break; case 'or': r = x | y; break; case 'xor': r = x ^ y; break;
        case 'shl': r = x << (y & 31); break; case 'shr': r = x >> (y & 31); break; case 'ushr': r = x >>> (y & 31); break;
        case 'rsub': r = y - x; break;
        default: throw new Error('int op ' + kind);
      }
      return r | 0;
    }
    if (ty === 'long') {
      x = L(x); let r;
      if (kind === 'shl' || kind === 'shr' || kind === 'ushr') { const s = BigInt(I(y) & 63); r = kind === 'shl' ? x << s : kind === 'shr' ? x >> s : BigInt.asUintN(64, x) >> s; return w64(r); }
      y = L(y);
      switch (kind) {
        case 'add': r = x + y; break; case 'sub': r = x - y; break; case 'mul': r = x * y; break;
        case 'div': if (y === 0n) jthrow('Ljava/lang/ArithmeticException;'); r = x / y; break;
        case 'rem': if (y === 0n) jthrow('Ljava/lang/ArithmeticException;'); r = x % y; break;
        case 'and': r = x & y; break; case 'or': r = x | y; break; case 'xor': r = x ^ y; break;
        default: throw new Error('long op ' + kind);
      }
      return w64(r);
    }
    const cv = ty === 'float' ? toF : toD; x = cv(x); y = cv(y); let r;
    switch (kind) { case 'add': r = x + y; break; case 'sub': r = x - y; break; case 'mul': r = x * y; break; case 'div': r = x / y; break; case 'rem': r = x % y; break; default: throw new Error('fp op ' + kind); }
    return ty === 'float' ? new Flt(r) : new Dbl(r);
  };

  // ---- calls
  RT.NN = (o, what) => { if (o === null || o === undefined) jthrow('Ljava/lang/NullPointerException;', what); return o; };
  RT.SH = (cs, args) => {
    const fw = C[cs.tcls] ? fwBase(cs.tcls) : cs.tcls;
    let fn = RT.shims.get(cs.tcls + '.' + cs.tname + ':' + cs.tsig) || RT.shims.get(cs.tcls + '.' + cs.tname) || RT.shims.get(fw + '.' + cs.tname) || RT.shims.get('*.' + cs.tname + ':' + cs.tsig) || RT.shims.get('*.' + cs.tname);
    if (!fn) throw new Error('NOSHIM ' + cs.tcls + '.' + cs.tname + ':' + cs.tsig);
    RT.cur = cs; const P = cs.params, off = cs.st ? 0 : 1;
    for (let i = off; i < args.length; i++) { const p = P[i - off]; if (p === 'F') args[i] = toF(args[i]); else if (p === 'D') args[i] = toD(args[i]); else if (p === 'J') args[i] = L(args[i]); }
    const r = fn.apply(RT, args), rt = cs.ret;
    if (rt === 'V') return undefined;
    if (rt === 'F') return new Flt(r); if (rt === 'D') return new Dbl(r); if (rt === 'J') return L(r);
    if (rt === 'Z') return r ? 1 : 0;
    if (rt === 'I' || rt === 'B' || rt === 'S' || rt === 'C') return r | 0;
    return r === undefined ? null : r;
  };
  // virtual / interface dispatch on the receiver's runtime class
  RT.VC = (cs, args) => {
    const recv = args[0];
    if (recv === null || recv === undefined) jthrow('Ljava/lang/NullPointerException;', cs.tcls + '.' + cs.tname);
    if (recv && recv.cls && C[recv.cls]) { const m = RT.find(recv.cls, cs.key); if (m) return m.apply(null, args); }
    return RT.SH(cs, args);
  };
  RT.handler = (tries, pc, ex) => {
    for (let i = 0; i < tries.length; i++) { const t = tries[i]; if (pc >= t[0] && pc < t[1]) for (let k = 2; k < t.length; k += 2) { const ty = t[k];
      if (ty === '<any>' || ty === 'Ljava/lang/Throwable;' || ty === 'Ljava/lang/Exception;' || ty === ex.cls) return t[k + 1];
      if (ty === 'Ljava/lang/RuntimeException;' && /NullPointer|IndexOutOf|Arithmetic|NumberFormat|ClassCast|IllegalArgument/.test(ex.cls)) return t[k + 1];
      if (ty === 'Ljava/io/IOException;' && /java\/io\//.test(ex.cls)) return t[k + 1]; } }
    return -1;
  };
  RT.call = (desc, name, sig, args) => { const m = RT.find(desc, name + ':' + sig); if (!m) throw new Error('no method ' + desc + name + sig); RT.IC(desc); return m.apply(null, args); };
  RT.newObj = cls => { RT.IC(cls); return { cls, f: {} }; };

  // ================= framework shims =================
  const S = 'Ljava/lang/String;', SB = 'Ljava/lang/StringBuilder;', SBF = 'Ljava/lang/StringBuffer;';
  const sh = (k, f) => RT.shims.set(k, f);
  const jstr = RT.jstr = o => {
    if (o === null || o === undefined) return 'null';
    if (typeof o === 'string') return o;
    if (typeof o === 'number' || typeof o === 'bigint') return String(o);
    if (o instanceof Flt || o instanceof Dbl) return String(o.v);
    if (o.cls === SB || o.cls === SBF) return o.s;
    if (o.cls === 'Ljava/lang/Integer;') return String(o.v);
    if (C[o.cls]) { const m = RT.find(o.cls, 'toString:()Ljava/lang/String;'); if (m) return m(o); }
    return o.cls + '@obj';
  };
  const oob = m => jthrow('Ljava/lang/StringIndexOutOfBoundsException;', m);
  sh('*.<init>', function () { });
  sh('Ljava/lang/Object;.getClass', o => ({ cls: 'Ljava/lang/Class;', name: o.cls }));
  sh('Ljava/lang/Object;.toString', o => jstr(o));
  sh('Ljava/lang/Object;.equals', (a, b) => a === b);
  sh('Ljava/lang/Object;.hashCode', () => 1);
  sh('Ljava/lang/Object;.clone', o => { if (Array.isArray(o)) { const r = o.slice(); r.t = o.t; return r; } return Object.assign({}, o, { f: Object.assign({}, o.f) }); });
  sh('Ljava/util/Objects;.requireNonNull', o => { if (o == null) jthrow('Ljava/lang/NullPointerException;', 'requireNonNull'); return o; });
  for (const lv of ['d', 'e', 'i']) sh('Landroid/util/Log;.' + lv, (a, b) => { if (RT.keepLog) RT.log.push(a + ': ' + b); return 0; });
  sh('Landroid/util/Log;.v', () => 0); sh('Landroid/util/Log;.w', () => 0);
  sh('Ljava/lang/System;.gc', () => { });
  sh('Ljava/lang/System;.currentTimeMillis', () => BigInt(RT.now.getTime()));
  sh('Ljava/lang/System;.arraycopy', (src, sp, dst, dp, n) => { if (src === dst && sp < dp) { for (let i = n - 1; i >= 0; i--) dst[dp + i] = src[sp + i]; } else for (let i = 0; i < n; i++) dst[dp + i] = src[sp + i]; });
  sh('*.printStackTrace', e => { if (RT.keepLog) RT.log.push('printStackTrace ' + (e && e.cls) + ' ' + ((e && e.msg) || '')); });
  sh('*.getMessage', e => (e && e.msg) || null);
  const str = (n, f) => sh(S + '.' + n, f);
  str('equals', (a, b) => typeof b === 'string' && a === b);
  str('equalsIgnoreCase', (a, b) => typeof b === 'string' && a.toLowerCase() === b.toLowerCase());
  str('compareTo', (a, b) => { const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) { const d = a.charCodeAt(i) - b.charCodeAt(i); if (d) return d; } return a.length - b.length; });
  str('length', a => a.length);
  str('isEmpty', a => a.length === 0);
  str('charAt', (a, i) => { if (i < 0 || i >= a.length) oob('charAt ' + i + '/' + a.length); return a.charCodeAt(i); });
  str('startsWith', (a, b, off) => a.startsWith(b, off || 0));
  str('endsWith', (a, b) => a.endsWith(b));
  str('contains', (a, b) => a.includes(jstr(b)));
  str('trim', a => { let s = 0, e = a.length; while (s < e && a.charCodeAt(s) <= 32) s++; while (e > s && a.charCodeAt(e - 1) <= 32) e--; return a.slice(s, e); });
  str('toUpperCase', a => a.toUpperCase());
  str('toLowerCase', a => a.toLowerCase());
  str('toString', a => a);
  str('hashCode', a => { let h = 0; for (let i = 0; i < a.length; i++) h = (Math.imul(31, h) + a.charCodeAt(i)) | 0; return h; });
  str('concat', (a, b) => a + b);
  str('intern', a => a);
  str('toCharArray', a => { const r = Array.from(a, c => c.charCodeAt(0)); r.t = '[C'; return r; });
  str('substring', function (a, s, e) { if (e === undefined) e = a.length; if (s < 0 || e > a.length || s > e) oob('substring ' + s + ',' + e + '/' + a.length); return a.slice(s, e); });
  str('indexOf', function (a, x, from) { const needle = RT.cur.params[0] === 'I' ? String.fromCharCode(x) : x; return a.indexOf(needle, from || 0); });
  str('lastIndexOf', function (a, x, from) { const needle = RT.cur.params[0] === 'I' ? String.fromCharCode(x) : x; return from === undefined ? a.lastIndexOf(needle) : a.lastIndexOf(needle, from); });
  str('replace', function (a, x, y) { if (RT.cur.params[0] === 'C') { x = String.fromCharCode(x); y = String.fromCharCode(y); } else { x = jstr(x); y = jstr(y); } return a.split(x).join(y); });
  str('replaceAll', (a, x, y) => a.replace(new RegExp(x, 'g'), y));
  str('replaceFirst', (a, x, y) => a.replace(new RegExp(x), y));
  str('split', (a, x) => { let r = a.split(new RegExp(x)); while (r.length > 1 && r[r.length - 1] === '') r.pop(); r.t = '[' + S; return r; });
  sh(S + '.valueOf', function (x) { const p = RT.cur.params[0]; if (p === 'C') return String.fromCharCode(x); if (p === 'Z') return x ? 'true' : 'false'; if (p === 'F') return String(toF(x)); if (p === 'D') return String(toD(x)); return jstr(x); });
  sh(S + '.format', (fmt, args) => { let i = 0; return fmt.replace(/%[sd]/g, () => String(args[i++])); });
  sh('Ljava/lang/CharSequence;.toString', a => jstr(a));
  sh('Ljava/lang/CharSequence;.length', a => jstr(a).length);
  for (const Cn of [SB, SBF]) {
    sh(Cn + '.<init>', function (o, x) { o.s = typeof x === 'string' ? x : ''; });
    sh(Cn + '.append', function (o, x) { const p = RT.cur.params[0]; o.s += p === 'C' ? String.fromCharCode(x) : p === 'Z' ? (x ? 'true' : 'false') : p === 'F' ? String(toF(x)) : p === 'D' ? String(toD(x)) : jstr(x); return o; });
    sh(Cn + '.toString', o => o.s);
    sh(Cn + '.length', o => o.s.length);
    sh(Cn + '.charAt', (o, i) => o.s.charCodeAt(i));
    sh(Cn + '.setLength', (o, n) => { o.s = o.s.slice(0, n); });
    sh(Cn + '.insert', function (o, i, x) { o.s = o.s.slice(0, i) + (RT.cur.params[1] === 'C' ? String.fromCharCode(x) : jstr(x)) + o.s.slice(i); return o; });
    sh(Cn + '.deleteCharAt', (o, i) => { o.s = o.s.slice(0, i) + o.s.slice(i + 1); return o; });
    sh(Cn + '.delete', (o, i, j) => { o.s = o.s.slice(0, i) + o.s.slice(j); return o; });
    sh(Cn + '.reverse', o => { o.s = [...o.s].reverse().join(''); return o; });
    sh(Cn + '.indexOf', (o, x) => o.s.indexOf(x));
    sh(Cn + '.substring', (o, a, b) => o.s.slice(a, b === undefined ? o.s.length : b));
  }
  const aioob = (o, i) => { if (i < 0 || i >= o.a.length) jthrow('Ljava/lang/ArrayIndexOutOfBoundsException;', i + ' >= ' + o.a.length); };
  for (const Cn of ['Ljava/util/Vector;', 'Ljava/util/ArrayList;', 'Ljava/util/List;', 'Ljava/util/Collection;']) {
    sh(Cn + '.<init>', o => { o.a = []; });
    sh(Cn + '.addElement', (o, x) => { o.a.push(x); });
    sh(Cn + '.add', function (o, x, y) { if (RT.cur.params.length === 2) { o.a.splice(x, 0, y); return; } o.a.push(x); return 1; });
    sh(Cn + '.elementAt', (o, i) => { aioob(o, i); return o.a[i]; });
    sh(Cn + '.get', (o, i) => { aioob(o, i); return o.a[i]; });
    sh(Cn + '.size', o => o.a.length);
    sh(Cn + '.isEmpty', o => o.a.length === 0);
    sh(Cn + '.removeElementAt', (o, i) => { aioob(o, i); o.a.splice(i, 1); });
    sh(Cn + '.remove', function (o, i) { if (RT.cur.params[0] === 'I') { aioob(o, i); return o.a.splice(i, 1)[0]; } const k = o.a.indexOf(i); if (k >= 0) o.a.splice(k, 1); return k >= 0; });
    sh(Cn + '.insertElementAt', (o, x, i) => { o.a.splice(i, 0, x); });
    sh(Cn + '.setElementAt', (o, x, i) => { aioob(o, i); o.a[i] = x; });
    sh(Cn + '.set', (o, i, x) => { aioob(o, i); const old = o.a[i]; o.a[i] = x; return old; });
    sh(Cn + '.clear', o => { o.a.length = 0; });
    sh(Cn + '.removeAllElements', o => { o.a.length = 0; });
    sh(Cn + '.contains', (o, x) => o.a.includes(x));
    sh(Cn + '.indexOf', (o, x) => o.a.indexOf(x));
    sh(Cn + '.firstElement', o => o.a[0]);
    sh(Cn + '.lastElement', o => o.a[o.a.length - 1]);
  }
  const H = 'Ljava/util/Hashtable;';
  sh(H + '.<init>', o => { o.m = new Map(); });
  sh(H + '.put', (o, k, v) => { const old = o.m.get(k); o.m.set(k, v); return old === undefined ? null : old; });
  sh(H + '.get', (o, k) => { const v = o.m.get(k); return v === undefined ? null : v; });
  sh('Ljava/lang/Integer;.parseInt', s => { if (typeof s !== 'string' || !/^[+-]?\d+$/.test(s)) jthrow('Ljava/lang/NumberFormatException;', String(s)); return parseInt(s, 10); });
  sh('Ljava/lang/Integer;.valueOf', x => ({ cls: 'Ljava/lang/Integer;', f: {}, v: typeof x === 'string' ? parseInt(x, 10) : x }));
  sh('Ljava/lang/Integer;.intValue', o => o.v);
  sh('Ljava/lang/Integer;.toHexString', x => (x >>> 0).toString(16));
  sh('Ljava/lang/Integer;.toString', x => typeof x === 'object' ? String(x.v) : String(x));
  sh('Ljava/lang/Boolean;.valueOf', b => ({ cls: 'Ljava/lang/Boolean;', f: {}, v: b ? 1 : 0 }));
  sh('Ljava/lang/Boolean;.booleanValue', o => o.v);
  for (const n of ['abs', 'min', 'max', 'floor', 'ceil', 'sqrt', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'pow']) sh('Ljava/lang/Math;.' + n, (...a) => Math[n](...a.map(Number)));
  sh('Ljava/lang/Math;.toRadians', d => d * Math.PI / 180);
  sh('Ljava/lang/Math;.toDegrees', r => r * 180 / Math.PI);
  sh('Ljava/lang/Math;.round', function (d) { return RT.cur.ret === 'J' ? BigInt(Math.floor(d + 0.5)) : Math.floor(d + 0.5); });
  sh('Ljava/lang/Double;.isNaN', d => Number.isNaN(d));
  sh('Ljava/lang/Double;.isInfinite', d => d === Infinity || d === -Infinity);
  sh('Ljava/util/Random;.nextInt', (o, n) => RT.random(n));
  for (const [c, t] of [['Byte', 'B'], ['Integer', 'I'], ['Long', 'J'], ['Short', 'S'], ['Character', 'C'], ['Boolean', 'Z'], ['Float', 'F'], ['Double', 'D']]) RT.sstatics.set('Ljava/lang/' + c + ';.TYPE', { cls: 'Ljava/lang/Class;', name: t });
  const mk = (t, dims, k) => { const n = dims[k], leaf = k === dims.length - 1, arr = new Array(n); for (let i = 0; i < n; i++) arr[i] = leaf ? RT.defVal(t) : mk(t, dims, k + 1); arr.t = '['.repeat(dims.length - k) + t; return arr; };
  sh('Ljava/lang/reflect/Array;.newInstance', (cls, dims) => Array.isArray(dims) ? mk(cls.name, dims, 0) : mk(cls.name, [dims], 0));
  sh('Ljava/lang/reflect/Array;.getLength', a => a.length);
  // wall clock: RT.now is a Date whose LOCAL fields are the wall time the app should see
  const CAL = 'Ljava/util/Calendar;', GC = 'Ljava/util/GregorianCalendar;';
  const calFields = d => ({ 1: d.getFullYear(), 2: d.getMonth(), 5: d.getDate(), 7: d.getDay() + 1, 11: d.getHours(), 10: d.getHours() % 12, 9: d.getHours() >= 12 ? 1 : 0, 12: d.getMinutes(), 13: d.getSeconds(), 14: 0, 6: Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 864e5), 15: 2 * 3600e3, 16: 0 });
  sh(CAL + '.getInstance', () => ({ cls: GC, f: {}, d: new Date(RT.now.getTime()) }));
  for (const Cn of [CAL, GC]) {
    sh(Cn + '.<init>', o => { o.d = new Date(RT.now.getTime()); });
    sh(Cn + '.get', (o, f) => { const v = calFields(o.d)[f]; if (v === undefined) throw new Error('Calendar field ' + f); return v; });
    sh(Cn + '.getTimeInMillis', o => BigInt(o.d.getTime()));
    sh(Cn + '.setTime', (c, d) => { c.d = new Date(d.d.getTime()); });
    sh(Cn + '.getTimeZone', () => ({ cls: 'Ljava/util/TimeZone;', f: {} }));
  }
  sh('Ljava/util/Date;.<init>', o => { o.d = new Date(RT.now.getTime()); });
  sh('Ljava/util/TimeZone;.getDefault', () => ({ cls: 'Ljava/util/TimeZone;', f: {} }));
  sh('Ljava/util/TimeZone;.inDaylightTime', () => false);
  sh('Ljava/util/TimeZone;.getRawOffset', () => 2 * 3600e3);
  sh('Ljava/util/TimeZone;.getOffset', () => 2 * 3600e3);

  // ---- view stand-ins: enough for the original menu-building code to run and be observed
  const resStr = id => { const r = RT.res.strings[id]; return r === undefined ? '?res' + id : r; };
  RT.resStr = resStr;
  sh('*.getLayoutInflater', () => ({ cls: 'Landroid/view/LayoutInflater;', f: {} }));
  sh('Landroid/view/LayoutInflater;.inflate', (inf, id) => { const Lo = RT.res.layouts[id] || { name: '?', views: [] }; return { cls: 'Landroid/view/View;', f: {}, layout: Lo.name, views: Lo.views.map(v => Object.assign({ cls: 'Landroid/widget/Button;', f: {}, enabled: 1, listener: null }, v)) }; });
  sh('Landroid/view/View;.findViewById', (root, id) => { let v = (root.views || []).find(x => x.id === id); if (!v) { v = { cls: 'Landroid/widget/Button;', f: {}, id, text: '', vis: 0, enabled: 1, tag: '?', listener: null }; (root.views = root.views || []).push(v); } return v; });
  for (const Cn of ['Landroid/widget/Button;', 'Landroid/widget/TextView;', 'Landroid/view/View;', 'Landroid/widget/ScrollView;', 'Landroid/widget/LinearLayout;']) {
    for (const n of ['setTypeface', 'setTextSize', 'setMovementMethod', 'setGravity', 'setTextColor', 'setBackgroundColor', 'setPadding', 'setLineSpacing', 'setLayoutParams', 'setScrollBarStyle', 'setOrientation']) sh(Cn + '.' + n, () => { });
    sh(Cn + '.setText', (v, s) => { v.text = typeof s === 'string' ? s : jstr(s); });
    sh(Cn + '.setVisibility', (v, x) => { v.vis = x; });
    sh(Cn + '.setEnabled', (v, x) => { v.enabled = x; });
    sh(Cn + '.setOnClickListener', (v, l) => { v.listener = l; });
    sh(Cn + '.addView', (p, c) => { (p.kids = p.kids || []).push(c); });
  }
  sh('Landroid/widget/Button;.<init>', b => { b.text = ''; b.vis = 0; b.enabled = 1; b.tag = 'Button'; b.id = 0; b.listener = null; });
  sh('Landroid/widget/TextView;.<init>', b => { b.text = ''; b.vis = 0; b.tag = 'TextView'; });
  sh('Landroid/widget/ScrollView;.<init>', b => { b.kids = []; b.tag = 'ScrollView'; });
  sh('Landroid/widget/LinearLayout;.<init>', b => { b.kids = []; b.tag = 'LinearLayout'; });
  sh('Landroid/text/Html;.fromHtml', s => s);
  sh('*.getString', (t, id) => resStr(id));
  sh('*.getResources', () => ({ cls: 'Landroid/content/res/Resources;', f: {} }));
  sh('*.getPackageName', () => 'bav.sbav');
  sh('Landroid/content/res/Resources;.getStringArray', (r, id) => { const a = (RT.res.arrays[id] || []).slice(); a.t = '[' + S; return a; });
  sh('Landroid/content/res/Resources;.getIdentifier', (r, name, type) => { const k = (type || 'id') + '/' + name; const v = RT.res.ids[k]; return v === undefined ? 0 : v; });
  sh('Landroid/content/res/Resources;.getString', (r, id) => resStr(id));

  g.SidurRT = RT;
  if (typeof module !== 'undefined' && module.exports) module.exports = RT;
})(typeof globalThis !== 'undefined' ? globalThis : this);
