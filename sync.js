/* Booked Up sync helpers (pure functions, no network).
   A club is one JSON document. When two people save at once, `merge3` combines both edits
   instead of letting the last save overwrite the first. */
(function (root) {
  'use strict';

  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const hasId = a => a.length > 0 && a.every(x => isObj(x) && x.id != null);
  const key = x => (isObj(x) && x.id != null ? 'id:' + x.id : JSON.stringify(x));
  const keep = v => v !== undefined;

  // merge two edits (local, remote) made from the same starting point (base).
  // When both sides changed the same value in different ways, the remote one wins:
  // whoever saved first keeps their answer (this is what makes the first wrap-up stick).
  function merge3(base, local, remote) {
    if (eq(local, remote)) return local;
    if (eq(base, local)) return remote;
    if (eq(base, remote)) return local;
    if (isObj(local) && isObj(remote)) {
      const b = isObj(base) ? base : {};
      const out = {};
      new Set([...Object.keys(b), ...Object.keys(local), ...Object.keys(remote)]).forEach(k => {
        const v = merge3(b[k], local[k], remote[k]);
        if (keep(v)) out[k] = v;
      });
      return out;
    }
    if (Array.isArray(local) && Array.isArray(remote)) {
      const b = Array.isArray(base) ? base : [];
      const byId = hasId(local) || hasId(remote) || (!local.length && !remote.length && hasId(b));
      const bm = new Map(b.map(x => [key(x), x]));
      const lm = new Map(local.map(x => [key(x), x]));
      const rm = new Map(remote.map(x => [key(x), x]));
      const out = [];
      const seen = new Set();
      const take = k => {
        if (seen.has(k)) return;
        seen.add(k);
        const inB = bm.has(k), inL = lm.has(k), inR = rm.has(k);
        if (inB && (!inL || !inR)) return;                       // removed by either side: stays removed
        if (inL && inR) { out.push(byId ? merge3(bm.get(k), lm.get(k), rm.get(k)) : rm.get(k)); return; }
        out.push(inL ? lm.get(k) : rm.get(k));                   // added by one side
      };
      remote.forEach(x => take(key(x)));
      local.forEach(x => take(key(x)));
      return out;
    }
    return remote === undefined && base !== undefined ? remote : (remote !== undefined ? remote : local);
  }

  // swap one string for another everywhere in a document (used to turn "me" into the account id and back)
  function swap(v, from, to) {
    if (typeof v === 'string') return v === from ? to : v;
    if (Array.isArray(v)) return v.map(x => swap(x, from, to));
    if (isObj(v)) { const o = {}; for (const k of Object.keys(v)) o[k === from ? to : k] = swap(v[k], from, to); return o; }   // keys too (ratings are keyed by person)
    return v;
  }

  const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const code = () => { const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };

  root.BU = { merge3, swap, eq, clone, code };
  if (typeof module !== 'undefined') module.exports = root.BU;
})(typeof window !== 'undefined' ? window : globalThis);
