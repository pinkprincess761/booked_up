(() => {
  'use strict';

  // If anything throws, say so on screen instead of leaving a blank page.
  addEventListener('error', e => {
    const m = document.getElementById('app');
    if (m && !m.children.length) m.innerHTML = '<p style="padding:24px 0">Something went wrong loading the app: ' + String(e.message).replace(/[<>&]/g, '') + '. Try reloading.</p>';
  });

  const STORE = 'booked_up_v2';
  const SB_URL = 'https://atqeqttonqyklgldmohb.supabase.co';
  const SB_KEY = 'sb_publishable_RX115FmdR-gw0HqHj6UHig_JMUtf7NL';
  // add ?local to the address to use the app without an account (demo data on this device only)
  const BACKEND = !!SB_KEY && !/[?&]local\b/.test(location.search);
  let storeKey = STORE;
  const ME = 'me';
  const LIVE_MS = 12 * 3600 * 1000; // a meeting stays "next" for 12 hours after it starts, so the club can use it live
  const DAY = 864e5;

  const at = (d, h = 19) => { const t = new Date(); t.setDate(t.getDate() + d); t.setHours(h, 0, 0, 0); return t.toISOString(); };
  const ago = h => new Date(Date.now() - h * 36e5).toISOString();
  const meeting = (d, h, place, note, going = [], table = null) => ({ date: at(d, h), place, note, going, out: [], table });

  // session colors: deep navy, teal, forest and slate
  const GRADS = [
    'linear-gradient(135deg,#1c3a63,#2c5a8c)',  // navy
    'linear-gradient(135deg,#12545c,#1f7f84)',  // teal
    'linear-gradient(135deg,#1f4f3b,#33734f)',  // forest
    'linear-gradient(135deg,#34445f,#4e6483)',  // slate
    'linear-gradient(135deg,#1b4a6b,#2b7ba8)',  // ocean
    'linear-gradient(135deg,#2c3474,#4552a3)',  // indigo
    'linear-gradient(135deg,#0f5156,#2a8a80)',  // deep teal
    'linear-gradient(135deg,#3b4a5a,#587087)',  // steel
  ];
  const CLUB_COLORS = ['#7fb0e6', '#56bcc0', '#68bd93', '#9fb3c7', '#6cb6df', '#97a0e8', '#4fc0b0', '#a9bccd'];
  const clubGradById = cid => gradFor(state.clubs.findIndex(c => c.id === cid));
  const TICKET_COLORS = ['#c8333a', '#8fa8c0', '#e9b949', '#7fb08f', '#e5733d', '#b9a7d6', '#e8a0a5', '#2a2f36'];
  const onColor = hex => { const n = parseInt(hex.slice(1), 16); const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; return l > 0.55 ? '#1f2328' : '#ffffff'; };
  const MAIN_COLORS = ['#c9a45c', '#7f9bb5', '#a8434d', '#5aa59b', '#b78460', '#9a8fc0', '#d4a5a5', '#e6dfd0'];
  const MAIN_COLORS_2 = ['#b87d4b', '#6f98c4', '#8a5a3b', '#5f8fb8', '#d4a373', '#8fa8c0', '#a67c52', '#e3d5bd'];
  let theme = (() => { try { const t = +localStorage.getItem('booked_up_theme'); return t === 2 ? 2 : 1; } catch (e) { return 1; } })();
  const clubColor = cid => { const oc = state.clubs.find(x => x.id === cid); if (typeof harkUI !== 'undefined' && harkUI && oc && THEME_OPTIONS[oc.themeKey]) return THEME_OPTIONS[oc.themeKey].t[2]; const P = (typeof harkUI !== 'undefined' && (harkUI || bookUI)) ? TICKET_COLORS : (typeof mainUI !== 'undefined' && mainUI) ? theme === 2 ? MAIN_COLORS_2 : MAIN_COLORS : CLUB_COLORS; return P[((state.clubs.findIndex(c => c.id === cid) % P.length) + P.length) % P.length]; };
  const clubMark = c => (mainUI || harkUI) ? `<i class="cmark" style="--mk:${clubColor(c.id)}"></i>` : esc(c.emoji || '📚');
  const clubMarkId = (id, em) => { const c = state.clubs.find(x => x.id === id); return (mainUI || harkUI) && c ? clubMark(c) : esc(em || (c && c.emoji) || '📚'); };
  const bookFor = (c, m) => (m && m.book) || c.book;
  const coverKeyFor = (c, m) => (m && m.book) ? `${c.id}:m${c.meetings.indexOf(m)}` : c.id;
  const SPARK = '<svg class="spark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1c.8 6.2 4.8 10.2 11 11-6.2.8-10.2 4.8-11 11-.8-6.2-4.8-10.2-11-11 6.2-.8 10.2-4.8 11-11z"/></svg>';
  const gradFor = i => GRADS[((i % GRADS.length) + GRADS.length) % GRADS.length];
  const clubGrad = c => gradFor(state.clubs.indexOf(c));
  const pastGrad = (c, i) => gradFor(state.clubs.indexOf(c) + 1 + i);

  /* book covers via Open Library, with a typographic fallback */
  const coverImg = (id, title) => `<img src="https://covers.openlibrary.org/b/id/${id}-M.jpg" alt="Cover of ${esc(title)}" onerror="this.remove()">`;
  const coverHTML = (b, key) => `<span class="cover" data-cover="${esc(key)}">${b.coverId ? coverImg(b.coverId, b.title) : ''}<em>${esc(b.title)}</em></span>`;
  async function fetchCovers() {
    const items = [];
    state.clubs.forEach(c => {
      items.push({ b: c.book, key: c.id });
      (c.history || []).forEach(h => items.push({ b: h, key: `${c.id}:${h.id}` }));
      (c.wishlist || []).forEach(w => items.push({ b: w, key: `${c.id}:w:${w.id}` }));
      if (c.upNext) items.push({ b: c.upNext, key: `${c.id}:next` });
      (c.meetings || []).forEach((m, i) => { if (m.book) items.push({ b: m.book, key: `${c.id}:m${i}` }); });
      (c.suggestions || []).forEach(x => items.push({ b: x, key: `${c.id}:s:${x.id}` }));
    });
    for (const { b, key } of items) {
      try {
        if (b.coverId === undefined || b.pages === null) {
          const q = new URLSearchParams({ title: b.title, author: b.author, limit: 1, fields: 'cover_i,number_of_pages_median' });
          const r = await fetch('https://openlibrary.org/search.json?' + q);
          const d = ((await r.json()).docs || [])[0] || {};
          if (b.coverId === undefined) b.coverId = d.cover_i || 0;
          if (b.pages === null) b.pages = d.number_of_pages_median || 0;
          save();
          if (b.coverId) document.querySelectorAll(`[data-cover="${key}"]`).forEach(el => { if (!el.querySelector('img')) el.insertAdjacentHTML('afterbegin', coverImg(b.coverId, b.title)); });
        }
      } catch (e) { /* offline: try again next load */ }
    }
  }
  const ICON_BOOK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5C10.5 5.3 8 5 4 5v13c4 0 6.5.3 8 1.5 1.5-1.2 4-1.5 8-1.5V5c-4 0-6.5.3-8 1.5z"/><path d="M12 6.5v13"/></svg>';
  const ICON_PREV = '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>';
  const ICON_NEXT = '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>';

  // richer past-read records: ratings by member, who came, food, quotes, chat
  function seedHistory(id) {
    const H = (hid, title, author, pages, d, h, place, ratings, x = {}) => ({ id: hid, title, author, pages, date: at(d, h), place, note: '', going: Object.keys(ratings), table: null, quotes: [], updates: [], ratings, ...x });
    return ({
      c1: [
        H('h1a', 'Rebecca', 'Daphne du Maurier', 449, -25, 19, "Maya's rooftop", { me: 5, maya: 5, jo: 4, dev: 4 }, {
          table: { name: 'Dev', food: 'Lemon bars' },
          quotes: [{ id: 'qa', author: 'maya', text: 'Last night I dreamt I went to Manderley again.' }],
          updates: [{ id: 'ua', author: 'jo', text: 'Still thinking about that ending. Who else is mad at Maxim?', at: at(-25, 22) }, { id: 'ub', author: 'dev', text: 'Great discussion, everyone. Next time I am bringing the wine.', at: at(-24, 9) }],
        }),
        H('h1b', 'Gone Girl', 'Gillian Flynn', 432, -60, 19, "Dev's apartment", { me: 3, maya: 3, jo: 4, sam: 2 }, {
          going: ['me', 'maya', 'jo', 'sam', 'dev'], table: { name: 'Sam', food: 'Popcorn' },
          updates: [{ id: 'uc', author: 'sam', text: 'Hot take: the book is better than the movie.', at: at(-60, 21) }],
        }),
        H('h1c', 'The Thursday Murder Club', 'Richard Osman', 382, -95, 19, "Jo's kitchen", { me: 4, maya: 4, jo: 5, dev: 4, sam: 3 }, { table: { name: 'Jo', food: 'Shortbread' } }),
      ],
      c2: [
        H('h2a', 'Circe', 'Madeline Miller', 393, -20, 18, 'Lucky Dumpling House', { me: 5, ali: 5, rae: 4 }, {
          table: { name: 'Ali', food: 'Scallion pancakes' },
          updates: [{ id: 'ud', author: 'rae', text: 'Dinner and Circe was exactly the right call.', at: at(-20, 21) }],
        }),
        H('h2b', 'Mexican Gothic', 'Silvia Moreno-Garcia', 301, -55, 18, "Rae's place", { me: 3, ali: 3, rae: 4, tom: 2 }, { table: { name: 'You', food: 'Mushroom dumplings' } }),
        H('h2c', 'The Ocean at the End of the Lane', 'Neil Gaiman', 181, -90, 18, "Tom's porch", { me: 4, ali: 4, tom: 5 }, { table: { name: 'Tom', food: 'Lemonade' } }),
      ],
      c3: [
        H('h3a', "Giovanni's Room", 'James Baldwin', 169, -14, 11, 'Blue Door Café', { me: 5, lu: 5, kai: 4 }, {
          table: { name: 'Lu', food: 'Almond croissants' },
          quotes: [{ id: 'qb', author: 'lu', text: 'Perhaps home is not a place but simply an irrevocable condition.' }],
          updates: [{ id: 'ue', author: 'kai', text: 'That last chapter. I need a minute.', at: at(-14, 14) }],
        }),
        H('h3b', 'Normal People', 'Sally Rooney', 266, -49, 11, "Kai's apartment", { me: 4, lu: 4, kai: 3 }, { table: { name: 'Kai', food: 'Banana bread' } }),
      ],
    })[id];
  }

  const seed = () => ({
    read: {},
    friends: [],
    clubs: [
      {
        id: 'c1', name: 'Plot Twist Society',
        book: { title: 'The Secret History', author: 'Donna Tartt', pages: 559 },
        meetings: [
          meeting(3, 19, "Maya's rooftop", '', ['me', 'maya', 'jo'], { name: 'Maya', food: 'Cheese board' }),
        ],
        members: [
          { id: 'me', name: 'You' }, { id: 'maya', name: 'Maya' },
          { id: 'jo', name: 'Jo' }, { id: 'dev', name: 'Dev' }, { id: 'sam', name: 'Sam' },
        ],
        history: seedHistory('c1'),
        quotes: [{ id: 'q1', author: 'maya', text: 'Beauty is terror.' }],
        updates: [
          { id: 'u1', author: 'maya', text: 'Moving the start to 7:30. I am picking up the wine. Please read through Part Two.', at: ago(2) },
          { id: 'u2', author: 'jo', text: 'No spoilers about the ending in the group chat. I am begging.', at: ago(26) },
        ],
      },
      {
        id: 'c2', name: 'Dragons & Dumplings',
        book: { title: 'Piranesi', author: 'Susanna Clarke', pages: 272 },
        meetings: [
          meeting(6, 18, 'Lucky Dumpling House', 'Dinner first, discussion after.', ['ali'], { name: 'You', food: 'Sesame noodles' }),
        ],
        members: [
          { id: 'me', name: 'You' }, { id: 'ali', name: 'Ali' },
          { id: 'rae', name: 'Rae' }, { id: 'tom', name: 'Tom' },
        ],
        history: seedHistory('c2'),
        quotes: [{ id: 'q2', author: 'ali', text: 'The Beauty of the House is immeasurable; its Kindness infinite.' }],
        updates: [
          { id: 'u3', author: 'ali', text: 'The reservation is under "Piranesi" at the back table.', at: ago(5) },
          { id: 'u4', author: 'tom', text: 'Still on page 44. Send encouragement.', at: ago(50) },
        ],
      },
      {
        id: 'c3', name: 'Sunday Sappho',
        book: { title: 'Real Life', author: 'Brandon Taylor', pages: 330 },
        meetings: [
          meeting(14, 11, 'Blue Door Café', 'Brunch. Bring your annotated copies.', []),
        ],
        members: [
          { id: 'me', name: 'You' }, { id: 'lu', name: 'Lu' }, { id: 'kai', name: 'Kai' },
        ],
        history: seedHistory('c3'),
        quotes: [],
        updates: [
          { id: 'u5', author: 'lu', text: 'Brunch at 11. I will save the corner table by the window.', at: ago(30) },
        ],
      },
    ],
  });

  let state = load();
  function load() {
    try { const s = JSON.parse(localStorage.getItem(STORE)); if (s && s.clubs) return migrate(s); } catch (e) {}
    return migrate(seed());
  }
  function seedNext(id) {
    return id === 'c2' ? { title: 'The Night Circus', author: 'Erin Morgenstern', pages: null, by: 'ali', key: '' } : null;
  }
  function seedSugg(id) {
    return ({
      c1: [{ id: 'sg1', title: 'Jane Eyre', author: 'Charlotte Brontë', by: 'maya', votes: ['maya', 'jo'] }, { id: 'sg2', title: 'The Little Stranger', author: 'Sarah Waters', by: 'dev', votes: ['dev'] }],
      c2: [{ id: 'sg3', title: 'Uprooted', author: 'Naomi Novik', by: 'rae', votes: ['rae', 'me'] }],
    }[id] || []).map(x => ({ pages: null, key: '', ...x }));
  }
  function seedNotes(id) {
    return ({
      c1: [
        { id: 'n1', author: 'maya', kind: 'note', page: 88, text: 'Is Henry really a good friend, or is he just in control?' },
        { id: 'n2', author: 'jo', kind: 'note', page: 120, text: 'Why does everyone trust Julian so much?' },
        { id: 'n3', author: 'dev', kind: 'note', page: 41, text: 'The opening gives away so much on purpose. Why?' },
      ],
      c2: [{ id: 'n4', author: 'rae', kind: 'note', page: 57, text: 'The House feels calm and eerie at the same time.' }],
    }[id] || []).map(n => ({ at: new Date().toISOString(), ...n }));
  }
  function seedDiscussed(id) {
    return ({
      c1: ['Is Maxim a victim or a villain?', 'Why does the narrator never get a name?'],
      c2: ["Is Circe's exile a punishment or a gift?", 'How does the book reframe the gods?'],
      c3: ["What does 'home' mean for David?", "Is David's shame the real tragedy?"],
    }[id] || []);
  }
  function seedWish(id) {
    return ({
      c1: [['Jane Eyre', 'Charlotte Brontë'], ['The Little Stranger', 'Sarah Waters']],
      c2: [['The Night Circus', 'Erin Morgenstern'], ['Uprooted', 'Naomi Novik']],
      c3: [['Call Me by Your Name', 'André Aciman'], ['Maurice', 'E. M. Forster']],
    }[id] || []).map(([title, author], i) => ({ id: `w${id}${i}`, title, author, pages: null }));
  }
  function migrate(s) {
    s.read = s.read || {};
    s.friends = s.friends || [];
    s.profile = s.profile || { name: '', email: '', phone: '', color: '', photo: '' };
    if (s.profile.color === '#1f2328') s.profile.color = ''; // the old black default becomes an automatic color
    if (s.profile.name == null) s.profile.name = '';
    s.profile.notif = Object.assign({ created: true, half: true, before: true, food: true, chat: true, days: 2 }, s.profile.notif || {});
    s.clubs.forEach(c => {
      c.quotes = c.quotes || [];
      {
        const fut = (c.meetings || []).filter(m => new Date(m.date) >= Date.now() - LIVE_MS).sort((a, b) => new Date(a.date) - new Date(b.date));
        if (fut.length > 1) c.meetings = c.meetings.filter(m => new Date(m.date) < Date.now() || m === fut[0]);
      }
      if (!c.notes) c.notes = [...c.quotes.map(q => ({ id: q.id, author: q.author, kind: 'quote', text: q.text, page: q.page || null, at: new Date().toISOString() })), ...seedNotes(c.id)];
      c.discussed = c.discussed || [];
      if (!c.wishlist) c.wishlist = seedWish(c.id);
      if (c.upNext === undefined) {
        c.upNext = seedNext(c.id);
        if (c.upNext) c.wishlist = c.wishlist.filter(w => w.title.toLowerCase() !== c.upNext.title.toLowerCase());
      }
      if (!c.suggestions) c.suggestions = seedSugg(c.id);
      if (c.upNext && !c.suggestions.some(x => String(x.title).toLowerCase() === String(c.upNext.title).toLowerCase())) c.suggestions.push({ id: 'sp' + Math.random().toString(36).slice(2, 7), title: c.upNext.title, author: c.upNext.author, pages: c.upNext.pages || null, coverId: c.upNext.coverId, key: c.upNext.key || '', by: c.upNext.by || 'me', votes: [c.upNext.by || 'me'] });
      if (!c.emoji) c.emoji = ({ c1: '🕵️', c2: '🐉', c3: '💌' })[c.id] || '📚';
      c.updates = c.updates || [];
      c.history = c.history || [];
      const sh = ['c1', 'c2', 'c3'].includes(c.id) && (!c.history.length || !c.history[0].ratings) ? seedHistory(c.id) : null;
      if (sh) { c.history = sh; c.meetings = (c.meetings || []).filter(m => new Date(m.date) >= Date.now() - LIVE_MS); }
      c.history.forEach((h, i) => {
        h.id = h.id || 'h' + Date.now().toString(36) + i;
        h.date = h.date || h.finishedAt;
        h.ratings = h.ratings || (h.rating ? { [ME]: h.rating } : {});
        h.going = h.going || Object.keys(h.ratings);
        h.quotes = h.quotes || []; h.updates = h.updates || []; h.place = h.place || '';
        if (!h.discussed) h.discussed = i === 0 ? seedDiscussed(c.id) : [];
        if (!('table' in h)) h.table = null;
      });
      (c.meetings || []).forEach(m => {
        m.out = m.out || [];
        if (m.note === 'Bring a hot take and a pen.') m.note = '';
        if (!('table' in m)) {
          const e = Object.entries(m.potluck || {})[0];
          m.table = e ? { name: e[0] === ME ? 'You' : ((c.members.find(x => x.id === e[0]) || {}).name || e[0]), food: e[1] } : null;
        }
        delete m.potluck; delete m.maybe;
      });
    });
    return s;
  }
  function save() { try { localStorage.setItem(storeKey, JSON.stringify(state)); } catch (e) {} afterSave(); }

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const app = $('#app');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initial = n => esc(((n || '?').match(/[A-Za-z0-9]/) || ['?'])[0].toUpperCase());
  const AV_COLORS = ['#8fb8e8', '#5ed0d4', '#7fd6a8', '#b0b9e8', '#a8aef5', '#f0c35a'];
  const avColor = id => id === ME ? '#7fb0e6' : AV_COLORS[[...String(id)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % AV_COLORS.length];
  const people = {}; // other members' profiles, filled in from the server
  const avatar = (m, i) => {
    const q = m.id !== ME && people[m.id];
    const p = m.id === ME ? state.profile : q;
    const st = p ? (p.photo ? `;background:url('${p.photo}') center/cover !important;color:transparent !important` : p.color ? `;background:${p.color} !important;color:#fff !important` : '') : '';
    return `<span class="av ${m.id === ME ? 'you' : ''}" style="--mc:${avColor(m.id)}${st}">${initial(m.id === ME && myName() ? myName() : (q && q.name) || m.name)}</span>`;
  };
  const myName = () => (state.profile && state.profile.name || '').trim();
  const memberName = (c, id) => id === ME ? (myName() || 'You') : (people[id] && people[id].name) || (c.members.find(m => m.id === id) || { name: 'Someone' }).name;
  const fmt = (iso, o) => new Date(iso).toLocaleDateString(undefined, o);
  const fmtLong = iso => fmt(iso, { weekday: 'long', month: 'long', day: 'numeric' });
  const fmtShort = iso => fmt(iso, { weekday: 'short', month: 'short', day: 'numeric' });
  const fmtTime = iso => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const dkey = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const pluralize = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  function dayDiff(iso) {
    const a = new Date(iso), b = new Date();
    a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0);
    return Math.round((a - b) / DAY);
  }
  const relDay = iso => { const n = dayDiff(iso); return n <= 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`; };
  const relPhrase = iso => { const n = dayDiff(iso); return n <= 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`; };
  function timeAgo(iso) {
    const m = Math.floor((Date.now() - new Date(iso)) / 6e4);
    if (m < 2) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return d === 1 ? 'Yesterday' : `${d}d ago`;
  }

  const ratingVals = h => Object.values(h.ratings || {}).filter(n => n > 0);
  const avgOf = h => { const v = ratingVals(h); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
  const avgText = h => avgOf(h) ? avgOf(h).toFixed(1) : '—';
  const starSpans = n => [1, 2, 3, 4, 5].map(i => `<span class="${Math.round(n) >= i ? 'on' : ''}">★</span>`).join('');

  const ratingLine = (avg, count, suffix = '') => avg ? `<span class="rline"><span class="stars-s">${starSpans(avg)}</span><b>${(+avg).toFixed(2).replace(/0$/, '')}</b>${count ? `<span class="rcount">${Number(count).toLocaleString()} ratings</span>` : ''}${suffix}</span>` : '';
  const clubAvg = c => { const h = c.history || []; return h.length ? h.reduce((a, x) => a + avgOf(x), 0) / h.length : 0; };
  function shelfTile(c, h) {
    return `
      <a class="tile" href="#/club/${c.id}/book/${h.id}">
        ${coverHTML(h, `${c.id}:${h.id}`)}
        <div class="ttitle">${esc(h.title)}</div>
        <div class="trate"><span class="stars-s">${starSpans(avgOf(h))}</span><b>${avgText(h)}</b></div>
        <div class="tmeta">${fmt(h.date, { month: 'short', year: 'numeric' })}</div>
      </a>`;
  }

  const nextMeeting = c => (c.meetings || []).filter(m => new Date(m.date) >= Date.now() - LIVE_MS).sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  const nextTime = c => { const m = nextMeeting(c); return m ? new Date(m.date).getTime() : Infinity; };

  /* ---------- layout modes ---------- */
  const UI_MODES = ['hark', 'main', 'book'];
  const UI_NAMES = { hark: 'Clean', main: 'Scrap', book: 'Book' };
  let uiMode = 'hark'; // only the Clean layout remains
  let bookUI = uiMode === 'book', harkUI = uiMode === 'hark', mainUI = uiMode === 'main';
  // a colored bar that says which club you are in
  const clubBar = (c, href, label) => `<a class="clubbar" href="${href}" style="--cc:${clubColor(c.id)};--cx:${onColor(clubColor(c.id))}"><span class="cb-back">‹</span><span class="cb-emoji">${clubMark(c)}</span><span class="cb-name">${esc(c.name)}</span>${label ? `<span class="cb-label">${esc(label)}</span>` : ''}</a>`;
  /* ---------- "Book" layout: the cover and title are the headline ---------- */
  function bookHero(c, m, kind) {
    const past = kind === 'past';
    const bk = past ? m : bookFor(c, m);
    const key = past ? `${c.id}:${m.id}` : coverKeyFor(c, m);
    const nr = past ? ratingVals(m).length : 0;
    const people = past ? (m.going || []) : m.going;
    return `
      <section class="bhero" style="--cc:${clubColor(c.id)};--cx:${onColor(clubColor(c.id))}">
        <div class="bh-cover">${coverHTML(bk, key)}</div>
        <div class="bh-body">
          <div class="bk-club">${clubMark(c)} ${esc(c.name)}</div>
          <h1 class="bh-title">${esc(bk.title)}</h1>
          <div class="bk-author">by ${esc(bk.author)}${bk.pages ? ` · ${bk.pages} pages` : ''}</div>
        </div>
      </section>
      <div class="bmeta" style="--cc:${clubColor(c.id)};--cx:${onColor(clubColor(c.id))}">
        <div class="bm"><span>${past ? 'Met' : 'Next meeting'}</span><b>${fmt(m.date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${fmtTime(m.date)}</b></div>
        ${m.place ? `<div class="bm"><span>Where</span><b>${esc(m.place)}</b></div>` : ''}
        <div class="bm"><span>${past ? 'Rating' : 'Going'}</span><b>${past ? (nr ? `★ ${avgText(m)} (${nr})` : 'Not rated') : `${people.length}${people.length ? ' · ' + people.map(g => esc(memberName(c, g))).join(', ') : ''}`}</b></div>
      </div>`;
  }
  function homeBook(clubs) {
    app.innerHTML = `
      <section class="page-head head-row"><h1>Your clubs</h1><a class="newclub" href="#/new">+ New club</a></section>
      <div class="bk-list">${clubs.map(c => {
        const m = nextMeeting(c), bk = bookFor(c, m);
        return `<a class="bk-card" href="#/club/${c.id}" style="--cc:${clubColor(c.id)};--cx:${onColor(clubColor(c.id))}">
          <div class="bk-cover">${coverHTML(bk, coverKeyFor(c, m))}</div>
          <div class="bk-body">
            <div class="bk-club">${clubMark(c)} ${esc(c.name)}</div>
            <h2 class="bk-title">${esc(bk.title)}</h2>
            <div class="bk-author">by ${esc(bk.author)}</div>
            <div class="bk-meet">${m ? `<b>${fmt(m.date, { weekday: 'short', month: 'short', day: 'numeric' })}</b> ${fmtTime(m.date)}<br>${relDay(m.date)}` : 'No meeting yet'}</div>
          </div>
        </a>`;
      }).join('') || '<p class="muted-line">No clubs yet. Start one with “New club”.</p>'}</div>`;
  }
  function clubBookBody(c, next, hist) {
    return `
      ${next ? `<a class="blink" href="#/club/${c.id}/meeting">${bookHero(c, next, 'next')}<span class="bopen">Open meeting →</span></a>` : '<button type="button" class="btn big" data-plan>Plan a meeting</button>'}
      ${hist.length ? `<div class="sec"><h2>Previous meetings</h2><span class="kicker">${hist.length}</span></div>
      <div class="shelfrow">${hist.map(h => `<a class="bshelf" href="#/club/${c.id}/book/${h.id}">${coverHTML(h, `${c.id}:${h.id}`)}<b>${esc(h.title)}</b><span>${fmt(h.date, { month: 'short', day: 'numeric' })}${ratingVals(h).length ? ' · ★ ' + avgText(h) : ''}</span></a>`).join('')}</div>` : ''}`;
  }

  const rsvpMe = (m, yes) => { m.out = m.out || []; m.going = m.going.filter(x => x !== ME); m.out = m.out.filter(x => x !== ME); (yes ? m.going : m.out).push(ME); save(); };
  const lastHeld = c => [...(c.history || [])].sort((x, y) => new Date(y.date) - new Date(x.date))[0];

  /* ---------- "Hark" layout: a calm widget dashboard that suggests what to do and answers questions ---------- */
  const dayWord = iso => fmt(iso, { weekday: 'long' });
  const heldSteps = clubs => {
    const byTime = [...clubs].sort((a, b) => nextTime(a) - nextTime(b)), out = [];
    byTime.forEach(c => { const m = nextMeeting(c); if (!m) return; m.out = m.out || []; if (!m.going.includes(ME) && !m.out.includes(ME)) out.push({ kind: 'rsvp', c, m, title: `Are you going to <span class="cn">${esc(c.name)}</span>?`, sub: `${dayWord(m.date)} · ${fmtTime(m.date)}` }); });
    byTime.forEach(c => { const h = lastHeld(c); if (h && !(h.ratings || {})[ME]) out.push({ kind: 'rate', c, h, title: `Rate ${esc(h.title)}`, sub: `<span class="cn">${esc(c.name)}</span>` }); });
    byTime.forEach(c => { const m = nextMeeting(c); if (m && m.going.includes(ME) && !tableList(m).length) out.push({ kind: 'table', c, m, title: `Bring something to <span class="cn">${esc(c.name)}</span>?`, sub: 'Nobody has signed up for snacks' }); });
    return out;
  };
  const sugCard = (s, i) => `<div class="hk-sug-card" style="--cc:${clubColor(s.c.id)}"><div class="hk-sug-t"><span class="hk-dot"></span><span class="hk-sug-tt">${s.title}</span></div><div class="hk-sug-s">${s.sub}</div>${s.kind === 'rsvp' ? `<div class="hk-sug-a"><button type="button" class="hk-b dark" data-hk="yes" data-i="${i}">Yes</button><button type="button" class="hk-b" data-hk="no" data-i="${i}">No</button></div>` : s.kind === 'rate' ? `<div class="hk-sug-a hk-stars">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-hk="star" data-n="${n}" data-i="${i}" aria-label="${n} stars">★</button>`).join('')}</div>` : `<div class="hk-sug-a"><a class="hk-b dark" href="#/club/${s.c.id}/meeting">Sign up</a></div>`}</div>`;
  function wireHark(steps) {
    app.querySelectorAll('[data-hk]').forEach(b => b.onclick = () => {
      const s = steps[+b.dataset.i], k = b.dataset.hk;
      if (k === 'yes' || k === 'no') { rsvpMe(s.m, k === 'yes'); }
      else { s.h.ratings = s.h.ratings || {}; s.h.ratings[ME] = +b.dataset.n; save(); }
      route();
    });
  }
  function homeHark(clubs) {
    const sorted = [...clubs].sort((a, b) => nextTime(a) - nextTime(b));
    const steps = heldSteps(clubs).slice(0, 4);
    const hr = new Date().getHours(), hi = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
    if (!sorted.length) {
      // first-time home: looks like the real thing, with a big invitation to start
      const spines = [2, 3, 4, 5, 0, 1].map((k, i) => `<i style="--h:${[78, 104, 90, 118, 96, 84][i]}px;--sc:${THEME_OPTIONS[k].t[2]};--r:${[-4, 2, -2, 3, -3, 4][i]}deg"></i>`).join('');
      const nm = (state.profile && state.profile.name || '').split(' ')[0];
      app.innerHTML = `
        <section class="hk-top"><div class="hk-hi">${hi}${nm ? ', ' + esc(nm) : ''}</div><h1>Your clubs</h1></section>
        <div class="hk-label">Get started</div>
        <a class="wg em-hero" href="#/new">
          <div class="em-shelf" aria-hidden="true">${spines}</div>
          <div class="em-copy"><div class="wg-l">New club</div><div class="em-big">Start your first club</div><div class="em-sub">Pick a book, set a date and invite your friends.</div></div>
          <span class="em-cta">+ New club</span>
        </a>
        ${BACKEND ? '<button type="button" class="wg em-join" data-join><span class="em-hash">#</span><span class="em-jt"><b>Join with a code</b><small>A friend already started a club? Enter their code.</small></span><i aria-hidden="true">›</i></button>' : ''}
        <div class="hk-label">How it works</div>
        <div class="hk-grid em-steps">
          <div class="wg"><div class="wg-l">Step 1</div><div class="wg-val">Pick a book</div><div class="wg-sub">Search by title and we fill in the rest.</div></div>
          <div class="wg"><div class="wg-l">Step 2</div><div class="wg-val">Set the night</div><div class="wg-sub">Date, place and who brings the snacks.</div></div>
          <div class="wg"><div class="wg-l">Step 3</div><div class="wg-val">Talk it over</div><div class="wg-sub">Questions, quotes and notes for the meeting.</div></div>
          <div class="wg"><div class="wg-l">Step 4</div><div class="wg-val">Wrap up</div><div class="wg-sub">Rate it and choose what's next.</div></div>
        </div>`;
      return;
    }
    app.innerHTML = `
      <section class="hk-top"><div class="hk-hi">${hi}</div><h1>Your clubs</h1></section>
      ${steps.length ? `<div class="hk-label">Suggested for you</div><div class="hk-sug">${steps.map(sugCard).join('')}</div>` : `<div class="hk-label">You're all caught up</div>`}
      <div class="hk-label">Upcoming</div>
      <div class="hk-grid">
        ${sorted.map(c => harkPoster(c, true)).join('')}
        <a class="wg wg-new" href="#/new"><span>+</span> New club</a>
        ${BACKEND ? '<button type="button" class="wg wg-new wg-join" data-join><span>#</span> Join with a code</button>' : ''}
      </div>`;
    wireHark(steps);
  }
  // Clean: every club has its own color family, used on its poster and across all of its pages
  const THEME_OPTIONS = [
    { name: 'Teal', t: ['#d6ede9', '#3b8683', '#2d706d', '#245f5d', '#143f3e'] },
    { name: 'Slate blue', t: ['#dce4ee', '#6b85a6', '#587394', '#475f7d', '#2c3d54'] },
    { name: 'Red', t: ['#f5dcdc', '#c24a4f', '#a93c42', '#8c3137', '#571c20'] },
    { name: 'Coral', t: ['#fbe1dd', '#e47a6c', '#d1655a', '#b24f46', '#6e2f2a'] },
    { name: 'Burnt orange', t: ['#fbe5d3', '#d9803f', '#c2672b', '#a35320', '#613212'] },
    { name: 'Marigold', t: ['#faedc8', '#d9a52e', '#c08d1f', '#9c7016', '#5e430c'] },
    { name: 'Berry', t: ['#f1dbe4', '#a8506f', '#8e3d59', '#742f47', '#451b2a'] },
    { name: 'Navy', t: ['#dbe4f1', '#3d5d8f', '#2f4a73', '#233a5b', '#142238'] }
  ];
  const clubTheme = () => THEME_OPTIONS[0].t; // cards and club pages are always teal; a club's own color is an accent (see --ac)
  const themeVars = cid => clubTheme(cid).map((v, i) => `--k${i}:${v}`).join(';');
  // one poster layout for every club; the soonest meeting is the dark one
  function harkPoster(c, dark, later) {
    const m = nextMeeting(c);
    if (!m) return `<a class="wg wg-hero ${dark ? '' : 'wg-light'}" href="#/club/${c.id}" style="--cc:${clubColor(c.id)};${themeVars(c.id)}"><div class="wg-l">Not scheduled</div><div class="wg-hero-body"><div><div class="wg-big">No meeting yet</div><div class="wg-sub cn">${esc(c.name)}</div></div></div></a>`;
    const b = bookFor(c, m);
    return `<a class="wg wg-hero ${dark ? '' : 'wg-light'}" href="#/club/${c.id}" style="--cc:${clubColor(c.id)};${themeVars(c.id)}">
      <div class="wg-l">${relDay(m.date)}</div>
      <div class="wg-hero-body"><div><div class="wg-big">${esc(b.title)}</div><div class="wg-sub cn">${esc(c.name)}</div><div class="wg-when">${fmt(m.date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${fmtTime(m.date)}</div>${m.place ? `<div class="wg-sub">${esc(m.place)}</div>` : ''}</div><div class="wg-cover">${coverHTML(b, coverKeyFor(c, m))}</div></div></a>`;
  }
  const APPLE_MAPS_ICON = '<svg viewBox="0 0 60 60" aria-hidden="true"><defs><clipPath id="amc"><rect width="60" height="60" rx="14"/></clipPath><linearGradient id="amb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5ac8fa"/><stop offset="1" stop-color="#007aff"/></linearGradient></defs><g clip-path="url(#amc)"><rect width="60" height="60" fill="#f4f1ea"/><rect x="-4" y="30" width="30" height="34" fill="#a5dc9c"/><rect x="40" y="-4" width="24" height="22" fill="#a5dc9c"/><path d="M-4 22 L30 56 L38 56 L-4 14Z" fill="#fff"/><path d="M26 -4 L64 34 L64 44 L18 -4Z" fill="#fff"/><path d="M-2 46 L46 -2" stroke="#ffd54a" stroke-width="5" fill="none"/><circle cx="30" cy="31" r="11" fill="url(#amb)" stroke="#fff" stroke-width="3"/><path d="M30 25 L35 36 L30 33 L25 36Z" fill="#fff"/></g></svg>';
  const GOOGLE_MAPS_ICON = '<svg viewBox="0 0 60 60" aria-hidden="true"><defs><clipPath id="gmc"><rect width="60" height="60" rx="14"/></clipPath><clipPath id="gmp"><path d="M30 8c-8.3 0-15 6.5-15 14.6 0 10.2 15 28.4 15 28.4s15-18.2 15-28.4C45 14.5 38.3 8 30 8z"/></clipPath></defs><g clip-path="url(#gmc)"><rect width="60" height="60" fill="#e8f0e6"/><path d="M-4 40 L64 18 L64 28 L-4 50Z" fill="#fff"/><path d="M-4 12 L26 64 L36 64 L-4 4Z" fill="#fff" opacity=".9"/></g><g clip-path="url(#gmp)"><rect x="10" y="4" width="40" height="50" fill="#ea4335"/><path d="M10 8 L30 8 L16 24 L10 24Z" fill="#4285f4"/><path d="M10 24 L16 24 L30 54 L24 40Z" fill="#34a853"/><path d="M50 18 L50 26 L30 54 L36 36Z" fill="#fbbc04"/></g><circle cx="30" cy="23" r="6" fill="#fff"/></svg>';
  // a place that opens in Apple Maps or Google Maps
  const placeLink = (place, address) => {
    const p = String(place || '').trim(), a = String(address || '').trim();
    if ((!p || /^tbd$/i.test(p)) && !a) return esc(p || 'TBD');
    const name = p && !/^tbd$/i.test(p) ? p : a;
    return `<button type="button" class="map-link" data-map="${esc(a || p)}" data-name="${esc(name)}" aria-label="Open ${esc(name)} in Maps">${esc(name)}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="10" r="2.4"/></svg></button>`;
  };
  function openMapSheet(place, name) {
    const q = encodeURIComponent(place); name = name || place;
    const root = document.createElement('div');
    root.className = 'sheet-backdrop';
    root.innerHTML = `
      <div class="sheet mapsheet" role="dialog" aria-modal="true" aria-label="Open ${esc(name)} in Maps">
        <div class="kicker">Directions</div>
        <h2>${esc(name)}</h2>${name !== place ? `<p class="muted-line">${esc(place)}</p>` : ''}
        <div class="map-apps">
          <a class="map-app" href="https://maps.apple.com/?q=${q}" target="_blank" rel="noopener"><span class="map-icon">${APPLE_MAPS_ICON}</span><b>Apple Maps</b></a>
          <a class="map-app" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener"><span class="map-icon">${GOOGLE_MAPS_ICON}</span><b>Google Maps</b></a>
          <button type="button" class="map-app" data-copy><span class="map-icon map-icon-copy"><svg viewBox="0 0 60 60" aria-hidden="true"><rect x="19" y="17" width="23" height="28" rx="5" fill="none" stroke="#fff" stroke-width="3.2"/><rect x="26" y="12" width="23" height="28" rx="5" fill="#6d7279" stroke="#fff" stroke-width="3.2"/></svg></span><b>Copy address</b></button>
        </div>
        <div class="form-actions end"><button type="button" class="btn ghost" data-cancel>Cancel</button></div>
      </div>`;
    document.body.appendChild(root);
    const close = () => root.remove();
    root.addEventListener('click', e => { if (e.target === root) close(); });
    root.querySelector('[data-cancel]').onclick = close;
    root.querySelectorAll('a.map-app').forEach(l => l.addEventListener('click', () => setTimeout(close, 150)));
    root.querySelector('[data-copy]').onclick = async () => { try { await navigator.clipboard.writeText(place); } catch (e) { toast('Could not copy'); } close(); };
  }

  /* ---------- address suggestions (type, then pick the full address from the list) ---------- */
  const fmtAddr = f => {
    const p = f.properties || {};
    const street = [p.housenumber, p.street].filter(Boolean).join(' ');
    const parts = [p.name && p.name !== p.street && p.name !== p.city ? p.name : '', street, p.city || p.town || p.village || p.district, [p.state, p.postcode].filter(Boolean).join(' '), p.country];
    const seen = new Set();
    return parts.filter(x => x && !seen.has(x) && seen.add(x)).join(', ');
  };
  (() => {
    let box = null, timer = null, ctl = null, cur = null, token = 0;
    const hide = () => { if (box) { box.remove(); box = null; } };
    const choose = (inp, text) => { inp.value = text; hide(); inp.dispatchEvent(new Event('change', { bubbles: true })); };
    const show = (inp, items) => {
      hide();
      if (!items.length) return;
      box = document.createElement('ul');
      box.className = 'addr-list';
      box.setAttribute('role', 'listbox');
      box.innerHTML = items.map(t => { const i = t.indexOf(','); const head = i > 0 ? t.slice(0, i) : t, tail = i > 0 ? t.slice(i + 1).trim() : ''; return `<li role="option" tabindex="-1" data-t="${esc(t)}"><b>${esc(head)}</b>${tail ? `<span>${esc(tail)}</span>` : ''}</li>`; }).join('');
      const label = inp.closest('label') || inp.parentNode;
      label.style.position = 'relative';
      label.appendChild(box);
      try { inp.scrollIntoView({ block: 'start', behavior: 'smooth' }); inp.closest('.plan-scroll, .sheet') ; } catch (e) {}
      box.addEventListener('pointerdown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); choose(inp, li.dataset.t); } });
    };
    document.addEventListener('input', e => {
      const inp = e.target;
      if (!inp.matches || !inp.matches('input[data-addr]')) return;
      cur = inp; clearTimeout(timer);
      const q = inp.value.trim();
      if (q.length < 3) { hide(); return; }
      timer = setTimeout(async () => {
        if (ctl) ctl.abort();
        ctl = new AbortController(); const my = ++token;
        try {
          const r = await fetch('https://photon.komoot.io/api/?limit=6&lang=en&q=' + encodeURIComponent(q), { signal: ctl.signal });
          const j = await r.json();
          if (my !== token || cur !== inp || !document.body.contains(inp)) return;
          const out = [...new Set((j.features || []).map(fmtAddr).filter(Boolean))];
          show(inp, out);
        } catch (err) { /* offline or cancelled: typing the address by hand still works */ }
      }, 320);
    });
    document.addEventListener('focusout', e => { if (e.target.matches && e.target.matches('input[data-addr]')) setTimeout(hide, 120); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
    window.addEventListener('hashchange', hide);
  })();
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-map]'); if (b) { e.preventDefault(); e.stopPropagation(); openMapSheet(b.dataset.map, b.dataset.name); } }, true);
  function harkHero(c, m, kind, extra = '') {
    const past = kind === 'past';
    const bk = past ? m : bookFor(c, m);
    const key = past ? `${c.id}:${m.id}` : coverKeyFor(c, m);
    const nr = past ? ratingVals(m).length : 0;
    const people = past ? (m.going || []) : m.going;
    return `<div class="hk-grid hk-grid-s" style="--cc:${clubColor(c.id)}">
      <div class="wg wg-hero wg-book">${past ? '<div class="wg-l">We read</div>' : ''}<div class="wg-hero-body"><div><div class="wg-big">${esc(bk.title)}</div><div class="wg-sub">${esc(bk.author)}${bk.pages ? ` · ${bk.pages} pages` : ''}</div></div><div class="wg-cover">${coverHTML(bk, key)}</div></div></div>
      <div class="wg"><div class="wg-l">${past ? 'Met' : 'When'}</div><div class="wg-val">${fmt(m.date, { weekday: 'short', month: 'short', day: 'numeric' })}</div><div class="wg-sub">${fmtTime(m.date)}</div></div>
      <div class="wg"><div class="wg-l">${past ? 'Rated' : 'Where'}</div><div class="wg-val">${past ? (nr ? `${avgText(m)} ★` : '—') : placeLink(m.place, m.address)}</div>${past ? `<div class="wg-sub">${pluralize(nr, 'rating')}</div>` : ''}</div>
      <div class="wg ${extra ? '' : 'wg-wide'}"><div class="wg-l">${past ? 'Went' : 'Going'}</div><div class="wg-going-row"><div class="wg-val wg-going-n">${people.length}</div>${people.length ? '<span class="wg-going-dot" aria-hidden="true">•</span>' : ''}<div class="wg-going-av" role="list" aria-label="${past ? 'Went' : 'Going'}: ${esc(people.map(g => memberName(c, g)).join(', ') || 'nobody yet')}">${people.slice(0, 6).map(g => g === ME ? `<span role="listitem" title="You">${avatar({ id: g, name: memberName(c, g) })}</span>` : `<a role="listitem" class="gv-link" href="#/person/${encodeURIComponent(g)}" title="${esc(memberName(c, g))}" aria-label="${esc(memberName(c, g))}'s profile">${avatar({ id: g, name: memberName(c, g) })}</a>`).join('')}${people.length > 6 ? `<span class="gv-more">+${people.length - 6}</span>` : ''}${people.length ? '' : '<span class="wg-sub">Nobody yet</span>'}</div></div></div>
      ${extra}
    </div>`;
  }
  function clubHarkBody(c, next, hist, listOnly) {
    const steps = listOnly ? [] : heldSteps([c]).slice(0, 3);
    return `
      ${steps.length ? `<div class="hk-label">Suggested</div><div class="hk-sug">${steps.map(sugCard).join('')}</div>` : ''}
      ${listOnly ? '' : next ? harkHero(c, next, 'next') + `<a class="hk-cta" href="#/club/${c.id}/meeting">Meeting details</a>` : '<button type="button" class="btn big" data-plan>Plan a meeting</button>'}
      ${hist.length ? `<div class="hk-label">Previous meetings</div><div class="wg hk-list">${hist.map(h => { const nr = ratingVals(h).length; return `<a class="hk-row" href="#/club/${c.id}/book/${h.id}"><span class="hk-rc">${coverHTML(h, `${c.id}:${h.id}`)}</span><span class="hk-rt"><b>${esc(h.title)}</b><span>${esc(h.author)}</span></span><span class="hk-rr">${nr ? `${avgText(h)} ★` : ''}</span><span class="hk-chev" aria-hidden="true">›</span></a>`; }).join('')}</div>` : ''}`;
  }


  /* ---------- "Booked Up" (main) layout: sleek, scheme-1 colors, one prompt card, collage title ---------- */
  const cutout = t => { let i = 0; return Array.from(t).map(ch => ch === ' ' ? '<span class="cut-gap"></span>' : `<i class="cut cut${i++ % 8}">${esc(ch)}</i>`).join(''); };

  // an editorial poster: cover as the headline, big serif title, ruled key facts
  function posterHero(c, m, kind, o = {}) {
    const past = kind === 'past';
    const bk = past ? m : bookFor(c, m);
    const key = past ? `${c.id}:${m.id}` : coverKeyFor(c, m);
    const nr = past ? ratingVals(m).length : 0;
    const people = past ? (m.going || []) : m.going;
    const tag = o.href ? 'a' : 'div';
    return `<div class="ps-wrap"><${tag} class="ps ${o.dark ? 'ps-dark' : ''}" ${o.href ? `href="${o.href}"` : ''} style="--cc:${clubColor(c.id)}">
      <div class="ps-eyebrow"><span>${o.href ? esc(c.name) : past ? 'We read' : 'Next meeting'}</span><span>${past ? fmt(m.date, { month: 'short', year: 'numeric' }) : relDay(m.date)}</span></div>
      <div class="ps-main"><div class="ps-cover">${coverHTML(bk, key)}</div><div class="ps-tw"><h1 class="ps-title">${esc(bk.title)}</h1><div class="ps-author">${esc(bk.author)}${bk.pages ? ` · ${bk.pages} pages` : ''}</div></div></div>
      <dl class="ps-rows">
        <div><dt>${past ? 'Met' : 'When'}</dt><dd>${fmt(m.date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${fmtTime(m.date)}</dd></div>
        ${m.place || m.address ? `<div><dt>Where</dt><dd>${o.href ? esc(m.place) : placeLink(m.place, m.address)}</dd></div>` : ''}
        <div><dt>${past ? 'Rated' : 'Going'}</dt><dd>${past ? (nr ? `${avgText(m)} ★ · ${pluralize(nr, 'rating')}` : 'Not rated yet') : `${people.length}${people.length ? ' · ' + people.map(g => esc(memberName(c, g))).join(', ') : ''}`}</dd></div>
      </dl>
    </${tag}></div>`;
  }

  const prevRows = (c, hist) => `<div class="pl">${hist.map((h, i) => { const nr = ratingVals(h).length; return `<a class="pl-row" href="#/club/${c.id}/book/${h.id}" style="--cc:${clubColor(c.id)}"><span class="pl-n">${String(hist.length - i).padStart(2, '0')}</span><span class="pl-cover">${coverHTML(h, `${c.id}:${h.id}`)}</span><span class="pl-t"><b>${esc(h.title)}</b><span>${esc(h.author)}</span></span><span class="pl-r">${nr ? `${avgText(h)} ★` : ''}</span></a>`; }).join('')}</div>`;





  function homeMain(clubs) {
    const sorted = [...clubs].sort((a, b) => nextTime(a) - nextTime(b));
    const c0 = sorted.find(c => nextMeeting(c)), m0 = c0 && nextMeeting(c0), b0 = m0 && bookFor(c0, m0);
    app.innerHTML = `
      ${m0 ? `${posterHero(c0, m0, 'next', { href: `#/club/${c0.id}/meeting` })}` : ''}
      <div class="lm-sec"><h2>Your clubs</h2><a class="newclub" href="#/new">+ New club</a></div>
      <div class="cl">${sorted.map(c => { const m = nextMeeting(c);
        return `<a class="cl-row" href="#/club/${c.id}" style="--cc:${clubColor(c.id)}"><span class="cl-em">${clubMark(c)}</span><span class="cl-t"><b>${esc(c.name)}</b><span>${m ? `${fmt(m.date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${esc(bookFor(c, m).title)}` : 'No meeting yet'}</span></span><span class="cl-go">›</span></a>`; }).join('') || '<p class="muted-line">No clubs yet. Start one with “New club”.</p>'}</div>`;
  }
  function clubMainBody(c, next, hist) {
    return `
      ${next ? posterHero(c, next, 'next') + `<a class="hk-cta" href="#/club/${c.id}/meeting">Meeting details</a>` : '<button type="button" class="btn big" data-plan>Plan a meeting</button>'}
      ${hist.length ? `<div class="hk-label ps-sec">Previous meetings</div>${prevRows(c, hist)}` : ''}`;
  }
  // a tiny buzz on tap where the phone supports it
  document.addEventListener('pointerdown', e => { if (mainUI && e.target.closest('button, .tab, .lm-club, .wg, a.hk-cta, .hk-row') && navigator.vibrate) navigator.vibrate(8); }, { passive: true });

  /* ---------- home ---------- */
  function home() {
    const clubs = [...state.clubs].sort((a, b) => nextTime(a) - nextTime(b));
    const first = clubs[0] && nextMeeting(clubs[0]);
    if (bookUI) { homeBook(clubs); return; }
    if (harkUI) { homeHark(clubs); return; }
    homeMain(clubs);
  }

  /* =====================================================================
     FLOW: Home -> Club -> (Meeting -> Discussion) / (Previous meeting card)
     Pain points it solves: picking the next book, coming up with questions,
     and pointing at parts of the book.
     ===================================================================== */
  let ui = { table: false, dq: 'all', qall: false, mtab: 'details' };
  const previewOpen = new Set(); // clubs whose discussion was opened early
  const byId = id => state.clubs.find(x => x.id === id);
  const isOpen = (c, m) => !!m && (Date.now() >= new Date(m.date).getTime() || previewOpen.has(c.id));
  const hashS = t => [...String(t)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(36);
  const pageTag = n => n.page ? `p. ${n.page}` : '';

  function mrow(c, h) {
    const n = ratingVals(h).length;
    return `
      <li><a class="mrow" href="#/club/${c.id}/book/${h.id}">
        <span class="thumb" data-cover="${c.id}:${h.id}">${h.coverId ? coverImg(h.coverId, h.title) : ''}<em>${initial(h.title)}</em></span>
        <div class="mbody">
          <div class="mtitle">${esc(h.title)}</div>
          <div class="msub">${fmtShort(h.date)}${h.place ? ` · ${esc(h.place)}` : ''}</div>
          <div class="mrate"><span class="stars-s">${starSpans(avgOf(h))}</span><b>${avgText(h)}</b><span class="rcount">${pluralize(n, 'rating')}</span></div>
        </div>
        <span class="chev">›</span>
      </a></li>`;
  }


  /* ---------- club page: every meeting as a poster ---------- */

  // the full list of past meetings, one tap from the club page
  function clubHistory(id) {
    const c = byId(id);
    if (!c) { location.hash = '#/'; return; }
    const hist = [...(c.history || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
    const body = bookUI ? clubBookBody(c, null, hist) : harkUI ? clubHarkBody(c, null, hist, true) : clubMainBody(c, null, hist);
    app.innerHTML = `
      <div class="club-top"><a class="back" href="#/club/${id}">‹ ${esc(c.name)}</a></div>
      <section class="club-head"><h1>${esc(c.name)}</h1></section>
      ${body}`;
    app.querySelectorAll('[data-plan]').forEach(b => b.remove());
  }

  function club(id) {
    const c = byId(id);
    if (!c) { location.hash = '#/'; return; }
    const upcoming = (c.meetings || []).filter(m => new Date(m.date) >= Date.now() - LIVE_MS).sort((a, b) => new Date(a.date) - new Date(b.date));
    const histAll = [...(c.history || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
    const hist = [];
    const invited = c.members.filter(m => m.phone);
    const next = upcoming[0];
    if (next) {
      meetingPage(id, true);
      if (invited.length) app.insertAdjacentHTML('beforeend', `
        <div class="sec"><h2>Invited friends</h2><span class="kicker">${invited.length}</span></div>
        <ul class="invites">${invited.map(m => `
          <li><span class="who">${avatar(m)}<b>${esc(m.name)}</b>${m.name !== fmtPhone(m.phone) ? `<small>${esc(fmtPhone(m.phone))}</small>` : ''}</span><a class="mini-link" href="${smsHref(m, c, next)}">Text invite</a></li>`).join('')}</ul>`);
      const em = $('[data-emoji]'); if (em) em.onclick = () => openEmojiPicker(c.emoji, e => { c.emoji = e; save(); club(id); });
      return;
    }

    app.innerHTML = `
      <div class="club-top"><a class="back" href="#/">‹ All clubs</a>${histAll.length && !harkUI ? `<a class="back hist-link" href="#/club/${id}/history">Previous meetings<b>${histAll.length}</b></a>` : ''}</div>
      <section class="club-head">
        <h1>${mainUI ? clubMark(c) : harkUI ? '' : `<button type="button" class="emoji-btn" data-emoji aria-label="Change club emoji">${clubMark(c)}</button>`}${esc(c.name)}</h1>
      </section>
      ${bookUI ? clubBookBody(c, next, hist) : harkUI ? `${histAll.length ? histCard(c) : ''}<div class="hk-label hk-reading">Next meeting</div><div class="wg nm-empty"><div class="wg-val">Nothing scheduled yet</div><div class="wg-sub">Pick a date, time and place for the next meeting.</div><button type="button" class="btn big" data-plan>Plan a meeting</button></div>` : clubMainBody(c, next, hist)}
      ${invited.length ? `
      <div class="sec"><h2>Invited friends</h2><span class="kicker">${invited.length}</span></div>
      <ul class="invites">${invited.map(m => `
        <li><span class="who">${avatar(m)}<b>${esc(m.name)}</b>${m.name !== fmtPhone(m.phone) ? `<small>${esc(fmtPhone(m.phone))}</small>` : ''}</span><a class="mini-link" href="${smsHref(m, c, next)}">Text invite</a></li>`).join('')}</ul>` : ''}
    `;
    const rerender = () => club(id);
    if ($('[data-emoji]')) $('[data-emoji]').onclick = () => openEmojiPicker(c.emoji, e => { c.emoji = e; save(); rerender(); });
    const pb = $('[data-plan]'); if (pb) pb.onclick = () => openPlan(c, rerender);
  }

  /* ---------- meeting page: details, chat and notes in one place ---------- */
  // Clean: the club's book suggestions as a widget that opens the full list
  function ourList(c, half) {
    const shared = isOpen(c, nextMeeting(c));
    const l = [...(c.suggestions || [])].filter(x => shared || x.by === ME).sort((x, y) => y.votes.length - x.votes.length);
    const top = l[0];
    return `<a class="wg wg-ol ${half ? '' : 'wg-wide'}" href="#/club/${c.id}/next"><div class="wg-l">Our list</div><div class="wg-val">${l.length ? `${l.length} ${l.length === 1 ? 'suggestion' : 'suggestions'}` : 'No suggestions yet'}</div><div class="wg-sub">${top ? `Top pick · ${esc(top.title)}` : 'Tap to add a book'}</div><span class="wg-chev">›</span></a>`;
  }
  // Clean: previous meetings as a half-width card beside Going
  function histHalf(c) {
    const h = [...(c.history || [])].sort((x, y) => new Date(y.date) - new Date(x.date));
    return `<a class="wg wg-hist wg-wide" href="#/club/${c.id}/history"><div class="wg-l">Previous meetings</div><div class="wg-val">${h.length} ${h.length === 1 ? 'book' : 'books'}</div><div class="wg-sub">Latest · ${esc(h[0].title)}</div><span class="wg-viewall">View all <i>›</i></span><span class="wg-covers">${h.slice(0, 3).reverse().map(x => coverHTML(x, `${c.id}:${x.id}`)).join('')}</span></a>`;
  }
  // Clean: previous meetings as a larger card under the poster
  function histCard(c) {
    const h = [...(c.history || [])].sort((x, y) => new Date(y.date) - new Date(x.date));
    return `<a class="hist-card" href="#/club/${c.id}/history" style="--cc:${clubColor(c.id)}"><span class="hc-covers">${h.slice(0, 3).map(x => coverHTML(x, `${c.id}:${x.id}`)).join('')}</span><span class="hc-t"><b>Previous meetings</b><span>${h.length} ${h.length === 1 ? 'book' : 'books'} · latest ${esc(h[0].title)}</span></span><span class="hc-chev">›</span></a>`;
  }

  function meetingPage(id, asClub, live) {
    const c = byId(id);
    if (!c) { location.hash = '#/'; return; }
    const meet = nextMeeting(c);
    if (!meet) { location.hash = `#/club/${id}`; return; }
    meet.out = meet.out || [];
    const going = meet.going;
    const rsvp = going.includes(ME) ? 'yes' : meet.out.includes(ME) ? 'no' : '';
    const updates = [...(c.updates || [])].sort((a, b) => new Date(b.at) - new Date(a.at));
    const mine = (c.notes || []).filter(n => n.author === ME);
    const open = isOpen(c, meet);
    const nGroup = (c.notes || []).length;
    const sugg = [...(c.suggestions || [])].sort((a, b) => b.votes.length - a.votes.length);
    const mySugg = sugg.filter(x => x.by === ME);
    const LOCK = '<svg class="tlock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
    const tab = ui.mtab || 'details';
    const chatSeen = c.chatSeen ? new Date(c.chatSeen).getTime() : 0;
    const unreadChat = tab === 'chat' ? 0 : updates.filter(u => u.author !== ME && new Date(u.at).getTime() > chatSeen).length;
    if (tab === 'chat') { c.chatSeen = new Date().toISOString(); save(); }

    const tl = tableList(meet);
    const editing = ui.table === true ? 'new' : ui.table;
    const tableForm = idx => { const t = idx === 'new' ? null : tl[idx]; return `
          <form class="table-form" id="table-form" data-idx="${idx}">
            <input name="who" maxlength="40" required placeholder="Who is bringing food?" value="${esc(t ? t.name : '')}" aria-label="Name" list="tb-who">
            <input name="food" maxlength="60" required placeholder="What are they bringing?" value="${esc(t ? t.food : '')}" aria-label="Food">
            <datalist id="tb-who">${['You', ...c.members.filter(m => m.id !== ME).map(m => m.name)].map(n => `<option value="${esc(n)}">`).join('')}</datalist>
            <div class="form-actions"><button class="btn">Save</button><button type="button" class="linkbtn" data-cancel-table>Cancel</button>${t ? '<button type="button" class="linkbtn" data-clear-table>Remove</button>' : ''}</div>
          </form>`; };
    const tableHTML = tl.map((t, i) => String(editing) === String(i) ? tableForm(i) : `
          <div class="table-row"><div><b>${esc(whoBrings(t.name).who)}</b> ${whoBrings(t.name).verb} bringing <span class="food">${esc(t.food)}</span></div><button class="mini-btn" data-edit-table="${i}">Edit</button></div>`).join('')
      + (editing === 'new' ? tableForm('new') : `
          <button class="plus" data-edit-table="new" aria-label="Add who is bringing food"><span>+</span>${tl.length ? 'Add someone else' : "Add who's bringing food"}</button>`);

    const histN = (c.history || []).length;
    const clubTop = `<div class="club-top"><a class="back" href="#/">‹ All clubs</a>${harkUI ? `<a class="settings-btn" href="#/club/${id}/settings" aria-label="Club settings">${SETTINGS_ICON}</a>` : ''}${histN && !harkUI ? `<a class="back hist-link" href="#/club/${id}/history">Previous meetings<b>${histN}</b></a>` : ''}</div>
      <section class="club-head"><h1>${mainUI ? clubMark(c) : harkUI ? '' : `<button type="button" class="emoji-btn" data-emoji aria-label="Change club emoji">${clubMark(c)}</button>`}${esc(c.name)}</h1></section>${harkUI ? '<div class="hk-label hk-reading">Reading</div>' : ''}`;
    const liveTop = `<div class="club-top"><a class="back" href="#/club/${id}">‹ ${esc(c.name)}</a></div>
      <section class="club-head"><h1>Meeting time</h1></section><div class="hk-label hk-reading">${esc(bookFor(c, meet).title)} · ${fmtTime(meet.date)}${meet.place ? ' · ' + esc(meet.place) : ''}</div>`;
    app.innerHTML = `
      ${live ? liveTop : asClub ? clubTop : clubBar(c, `#/club/${c.id}`, 'Meeting')}
      ${bookUI ? bookHero(c, meet, 'next') : harkUI ? harkHero(c, meet, 'next', asClub ? ourList(c, true) + (histN ? histHalf(c) : '') : '') : posterHero(c, meet, 'next')}

      <div class="mtabs" role="tablist">
        <button type="button" class="mtab ${tab === 'details' ? 'on' : ''}" data-mtab="details" role="tab">RSVP</button>
        <button type="button" class="mtab ${tab === 'chat' ? 'on' : ''}" data-mtab="chat" role="tab">Chat${unreadChat ? `<b>${unreadChat}</b>` : ''}</button>
        <button type="button" class="mtab ${tab === 'meeting' ? 'on' : ''}" data-mtab="meeting" role="tab">Meeting</button>
      </div>

      <div class="mpanel" data-mp="details" ${tab === 'details' ? '' : 'hidden'}>
        <section class="mp-block">
          <h3 class="mp-q">Can you make it?</h3>
          <div class="rsvp">
            <button data-rsvp="yes" class="${rsvp === 'yes' ? 'on' : ''}">I'm going</button>
            <button data-rsvp="no" class="${rsvp === 'no' ? 'on' : ''}">Can't make it</button>
          </div>
        </section>
        <section class="mp-block">
          <div class="sec"><h2>On the table</h2></div>
          <div class="tablebox">${tableHTML}</div>
        </section>
      </div>

      <div class="mpanel" data-mp="chat" ${tab === 'chat' ? '' : 'hidden'}>
        <form class="note-form chat-form" id="note-form">
          <textarea name="text" maxlength="400" placeholder="Write to the club…" aria-label="Post to the chat" rows="2" required></textarea>
          <div class="chat-form-row"><span class="chat-hint">Visible to the club</span><button class="btn">Post</button></div>
        </form>
        <ul class="feed chat-posts">
          ${updates.map(u => `
            <li class="post">
              ${avatar({ id: u.author, name: memberName(c, u.author) })}
              <div class="post-body"><div class="meta"><b>${esc(memberName(c, u.author))}</b><span>${timeAgo(u.at)}</span></div><p>${esc(u.text)}</p></div>
            </li>`).join('') || '<li class="chat-empty">No messages yet. Start the conversation.</li>'}
        </ul>
      </div>

      <div class="mpanel" data-mp="meeting" ${tab === 'meeting' ? '' : 'hidden'}>
        ${open && !live ? `<section class="mp-block begin-block"><h3 class="mp-q">It's meeting time</h3><p class="begin-sub">Open the meeting to see the discussion questions and everyone's quotes and notes.</p><a class="begin-btn" href="#/club/${c.id}/live">Begin meeting</a></section>` : ''}
        ${live ? '<section class="mp-block" id="mt-disc"></section>' : ''}
        ${open ? '' : ''}<p class="privacy ${open ? 'shared' : ''}" ${open ? 'hidden' : ''}>${open ? (previewOpen.has(c.id) && Date.now() < new Date(meet.date).getTime() ? 'Preview: this is how the tab looks once the meeting starts. <button type="button" class="linkbtn" data-exit-preview>Exit preview</button>' : 'Annotations and book suggestions are now shared with the club.') : `Only you can see your annotations and book suggestions until ${fmt(meet.date, { weekday: 'long' })} at ${fmtTime(meet.date)}. Then they are shared with the club automatically. <button type="button" class="linkbtn" data-preview>Preview meeting time</button>`}</p>
        ${open && !live ? '' : `<section class="mp-block">
        <div class="sec"><h2>Annotations</h2></div>
        <form class="composer" id="notes-form">
          <div class="seg" role="radiogroup" aria-label="Type">
            <label><input type="radio" name="kind" value="note" checked><span>Note</span></label>
            <label><input type="radio" name="kind" value="quote"><span>Quote</span></label>
          </div>
          <textarea name="text" maxlength="300" required placeholder="Something to discuss" aria-label="Your note"></textarea>
          <div class="crow2">
            <label class="fl pg">Page <input name="page" type="number" inputmode="numeric" min="1" max="5000" placeholder="e.g. 142"></label>
            <button class="btn">Add</button>
          </div>
          <p class="fhint">Only you see these until the meeting.</p>
        </form>
        ${mine.length ? `<ul class="myentries">${mine.map(n => ui.editNote === n.id ? `
          <li class="entry entry-edit"><form class="edit-note" data-edit-form="${n.id}">
            <div class="seg" role="radiogroup" aria-label="Type">
              <label><input type="radio" name="kind" value="note" ${n.kind === 'quote' ? '' : 'checked'}><span>Note</span></label>
              <label><input type="radio" name="kind" value="quote" ${n.kind === 'quote' ? 'checked' : ''}><span>Quote</span></label>
            </div>
            <textarea name="text" maxlength="300" required aria-label="Edit your entry">${esc(n.text)}</textarea>
            <div class="crow2"><label class="fl pg">Page <input name="page" type="number" inputmode="numeric" min="1" max="5000" placeholder="e.g. 142" value="${n.page || ''}"></label></div>
            <div class="form-actions"><button class="btn">Save</button><button type="button" class="linkbtn" data-cancel-edit>Cancel</button></div>
          </form></li>` : `
          <li class="entry"><span class="pagebadge ${n.page ? '' : 'none'}">${n.page ? 'p. ' + n.page : '—'}</span>
            <div class="ebody"><span class="etype">${n.kind === 'quote' ? 'Quote' : 'Note'}</span><p>${n.kind === 'quote' ? '“' + esc(n.text) + '”' : esc(n.text)}</p></div>
            <span class="eact"><button type="button" class="rmlink" data-edit-note="${n.id}">Edit</button><button type="button" class="rmlink" data-rm-note="${n.id}">Remove</button></span></li>`).join('')}</ul>` : ''}
        </section>`}

        ${live ? `
        <section class="mp-block">
        <div class="sec"><h2>Book suggestions</h2><button type="button" class="mini-link" data-suggest>+ Suggest a book</button></div>
        ${open ? `
        ${sugg.length ? `<ul class="sugglist">${sugg.map(x => {
          const picked = c.upNext && normTitle(c.upNext.title) === normTitle(x.title);
          return `
          <li class="srow2 ${picked ? 'is-picked' : ''}">
            <span class="thumb" data-cover="${c.id}:s:${x.id}">${x.coverId ? coverImg(x.coverId, x.title) : ''}<em>${initial(x.title)}</em></span>
            <div class="winfo"><div class="wtitle">${esc(x.title)}${picked ? '<span class="pickedtag">Picked</span>' : ''}</div><div class="by">${esc(x.author)} · ${picked ? `picked by ${esc(memberName(c, c.upNext.by))}` : `${pluralize(x.votes.length, 'vote')} · suggested by ${esc(memberName(c, x.by))}`}</div></div>
            <div class="sact">${picked ? '<button type="button" class="mini-link" data-clear-next>Clear</button>' : `<button type="button" class="mini-link" data-pick-sugg="${x.id}">Pick</button>`}</div>
          </li>`; }).join('')}</ul>` : '<p class="muted-line">No suggestions yet.</p>'}
        <div class="wrapcard">
          <div><b>Meeting over?</b></div>
          <button type="button" class="btn" data-wrap>Wrap up</button>
        </div>` : `
        ${mySugg.length ? `<ul class="sugglist">${mySugg.map(x => `
          <li class="srow2">
            <span class="thumb" data-cover="${c.id}:s:${x.id}">${x.coverId ? coverImg(x.coverId, x.title) : ''}<em>${initial(x.title)}</em></span>
            <div class="winfo"><div class="wtitle">${esc(x.title)}</div><div class="by">${esc(x.author)} · only you can see this</div></div>
            <div class="sact"><button type="button" class="rmlink" data-rm-sugg="${x.id}">Remove</button></div>
          </li>`).join('')}</ul>` : '<p class="muted-line">You have not suggested a book yet.</p>'}`}
        </section>
        ` : ''}
      </div>
    `;
    if (live) mountDiscussion(c, meet, $('#mt-disc'));
    const rerender = () => { const y = window.scrollY; if (live) meetingPage(id, true, true); else if (asClub) club(id); else meetingPage(id); window.scrollTo(0, y); };
    if (live) app.classList.add('live-page'); else app.classList.remove('live-page');

    app.querySelectorAll('[data-mtab]').forEach(b => b.onclick = () => {
      ui.mtab = b.dataset.mtab;
      if (ui.mtab === 'chat') { c.chatSeen = new Date().toISOString(); save(); const bd = b.querySelector('b'); if (bd) bd.remove(); }
      app.querySelectorAll('[data-mtab]').forEach(x => x.classList.toggle('on', x === b));
      app.querySelectorAll('[data-mp]').forEach(p => { p.hidden = p.dataset.mp !== ui.mtab; });
    });
    app.querySelectorAll('[data-rsvp]').forEach(b => b.onclick = () => {
      const yes = b.dataset.rsvp === 'yes';
      meet.going = meet.going.filter(x => x !== ME);
      meet.out = meet.out.filter(x => x !== ME);
      (yes ? meet.going : meet.out).push(ME);
      save(); rerender();
    });
    app.querySelectorAll('[data-edit-table]').forEach(b => b.onclick = () => { ui.table = b.dataset.editTable === 'new' ? true : +b.dataset.editTable; rerender(); const i = $('#table-form input'); if (i) i.focus(); });
    const cancelT = $('[data-cancel-table]'); if (cancelT) cancelT.onclick = () => { ui.table = false; rerender(); };
    const tf = $('#table-form');
    const clearT = $('[data-clear-table]'); if (clearT) clearT.onclick = () => { const l = tableList(meet).filter((_, k) => String(k) !== tf.dataset.idx); meet.table = l.length ? l : null; ui.table = false; save(); rerender(); };
    if (tf) tf.onsubmit = e => {
      e.preventDefault();
      const f = new FormData(tf), entry = { name: f.get('who').trim(), food: f.get('food').trim(), at: new Date().toISOString() };
      const l = [...tableList(meet)];
      if (tf.dataset.idx === 'new') l.push(entry); else l[+tf.dataset.idx] = entry;
      meet.table = l;
      ui.table = false; save(); rerender();
    };
    $('#note-form').onsubmit = e => {
      e.preventDefault();
      const text = new FormData(e.target).get('text').trim();
      if (!text) return;
      (c.updates = c.updates || []).push({ id: 'u' + Date.now(), author: ME, text, at: new Date().toISOString() });
      ui.mtab = 'chat'; save(); rerender();
    };
    const nf = $('#notes-form');
    if (nf) nf.querySelectorAll('input[name=kind]').forEach(r => r.onchange = () => { nf.querySelector('textarea').placeholder = r.value === 'quote' ? 'A line you loved' : 'Something to discuss'; });
    if (nf) nf.onsubmit = e => {
      e.preventDefault();
      const f = new FormData(nf);
      const text = f.get('text').trim();
      if (!text) return;
      (c.notes = c.notes || []).push({ id: 'n' + Date.now(), author: ME, kind: f.get('kind'), text, page: +f.get('page') || null, at: new Date().toISOString() });
      ui.mtab = 'meeting'; save(); rerender();
    };
    app.querySelectorAll('[data-edit-note]').forEach(b => b.onclick = () => { ui.editNote = b.dataset.editNote; ui.mtab = 'meeting'; rerender(); const t = $('.edit-note textarea'); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } });
    const ef = $('.edit-note');
    if (ef) {
      const cancel = $('[data-cancel-edit]'); if (cancel) cancel.onclick = () => { ui.editNote = null; ui.mtab = 'meeting'; rerender(); };
      ef.onsubmit = e => {
        e.preventDefault();
        const f = new FormData(ef), text = (f.get('text') || '').trim(), n = (c.notes || []).find(x => x.id === ef.dataset.editForm);
        if (!text || !n) return;
        n.text = text; n.kind = f.get('kind') === 'quote' ? 'quote' : 'note'; n.page = +f.get('page') || null; n.edited = new Date().toISOString();
        ui.editNote = null; ui.mtab = 'meeting'; save(); rerender();
      };
      ef.querySelectorAll('input[name=kind]').forEach(r => r.onchange = () => { ef.querySelector('textarea').placeholder = r.value === 'quote' ? 'A line you loved' : 'Something to discuss'; });
    }
    app.querySelectorAll('[data-rm-note]').forEach(b => b.onclick = () => { c.notes = c.notes.filter(n => n.id !== b.dataset.rmNote); ui.mtab = 'meeting'; save(); rerender(); });
    app.querySelectorAll('[data-suggest]').forEach(b => b.onclick = () => { ui.mtab = 'meeting'; if (open) openPicker(c, rerender, { startTab: 'search', select: bk => { setNextBook(c, bk); ui.mtab = 'meeting'; rerender(); celebrate(); } }); else openPicker(c, rerender, { suggestOnly: true }); });
    app.querySelectorAll('[data-rm-sugg]').forEach(b => b.onclick = () => { c.suggestions = c.suggestions.filter(x => x.id !== b.dataset.rmSugg); ui.mtab = 'meeting'; save(); rerender(); });
    const xp = $('[data-exit-preview]'); if (xp) xp.onclick = () => { previewOpen.delete(c.id); ui.mtab = 'meeting'; rerender(); };
    const pv = $('[data-preview]'); if (pv) pv.onclick = () => { previewOpen.add(c.id); ui.mtab = 'meeting'; rerender(); };
    app.querySelectorAll('[data-pick-sugg]').forEach(b => b.onclick = () => {
      const x = c.suggestions.find(y => y.id === b.dataset.pickSugg);
      setNextBook(c, x); ui.mtab = 'meeting'; rerender(); celebrate();
    });
    const cn = $('[data-clear-next]'); if (cn) cn.onclick = () => { c.upNext = null; ui.mtab = 'meeting'; save(); rerender(); };
    const wr = $('[data-wrap]'); if (wr) wr.onclick = async () => { await freshClub(c.id); const lm = nextMeeting(c); if (!lm || !isOpen(c, lm)) { refreshView(true); return; } openWrap(c, () => { navStack.length = 0; navStack.push('#/'); ui.mtab = 'details'; if (location.hash !== `#/club/${c.id}`) location.hash = `#/club/${c.id}`; else route(); }); };
  }

  /* ---------- discussion: questions + references by page ---------- */
  const ACADEMIC_Q = [
    'What is the central conflict of {t}, and is it resolved by the end, or only paused?',
    'Open the book to a page you marked. Read the first sentence aloud: why does it matter to the whole?',
    'Who is telling this story, and what are they leaving out? Where did you stop trusting them, if you did?',
    'How does the opening of {t} set up the ending? Reread the first page: what looks different now?',
    'Which character do you understand least, and what would you need to know to understand them?',
    'What do you think the title means by the final page, and did that meaning shift along the way?',
    'How does the setting press on the characters? What could they do somewhere else that they cannot do here?',
    'The plot is what happens. What is {t} actually about underneath it?',
    'Was the ending earned? Point to the earliest moment you can find that made it inevitable, or avoidable.',
    'Whose side did you take, and was there a point where you switched?',
    'How does the book handle time: what does it skip, linger on or repeat, and why?',
    'What is the most important decision a character makes, and who pays for it?',
    'What question do you wish the author had answered? Is the silence a flaw or a choice?',
    'Which scene is the turning point, and what had to be true for it to work?',
    'What does {t} want you to feel in its last pages, and does it get you there honestly?',
    "Choose a sentence that shows the author's style at its best. What makes it work: rhythm, image, word choice?",
    'What does the book assume about what its readers already know or believe? Did that fit you?',
    'Which relationship in {t} is the real love story, or the real tragedy, even if it is not the main one?',
  ];
  const CASUAL_Q = [
    'Before anyone speaks, rate {t} out of 5. Then defend your number in one sentence.',
    'Describe {t} in a single word. What did the others choose?',
    'Which character would you invite to dinner, and who would you quietly uninvite?',
    'Who would you cast in the movie, and which scene would the trailer open with?',
    'Which line would you put on a mug, a poster or a tattoo?',
    'What surprised you most: a twist, a character, or how you felt about the ending?',
    'When did you want to put the book down, and when could you not?',
    'Which minor character deserves their own book?',
    'Where were you when you finished it, and did the place change how it landed?',
    'If you were in the main character\'s shoes at the hardest moment, what would you have done?',
    'Who in your life would love this book, and who should never be handed it?',
    'What song, season or weather is {t}?',
    'If you could ask the author one thing over coffee, what would it be?',
    'Which book on your shelf is the perfect double feature with {t}?',
  ];
  const authorCache = {};
  async function authorBooks(author, exclude) {
    if (!author || /unknown/i.test(author)) return [];
    if (!authorCache[author]) {
      const q = new URLSearchParams({ author, limit: 12, fields: 'title', language: 'eng' });
      authorCache[author] = ((await (await fetch(`${OL}/search.json?` + q)).json()).docs || []).map(d => d.title);
    }
    const seen = new Set([normTitle(exclude)]);
    return authorCache[author].filter(t => { const k = normTitle(t); if (seen.has(k)) return false; seen.add(k); return true; });
  }
  // Question generator: group notes and quotes first, then themes, connections, and a generic bank.
  // (Template-based. The same function could be backed by a language model on a server.)
  function buildQuestions(c, meet, ctx) {
    const book = bookFor(c, meet);
    const T = book.title;
    const out = [];
    const add = (cat, text, extra = {}) => out.push({ cat, text, id: 'q' + hashS(cat + text), ...extra });
    let rot = 0; // rotate through the variants so neighbouring questions never read the same
    const pick = arr => arr[rot++ % arr.length];
    (c.notes || []).forEach(n => {
      const who = memberName(c, n.author), pg = n.page ? ` (p. ${n.page})` : '', by = who === 'You' ? 'You' : who;
      if (n.kind === 'quote') {
        add('notes', pick([
          `${by} marked this line${pg}: “${n.text}” What is it doing in the story, and what would be lost if it were cut?`,
          `${by} marked this line${pg}: “${n.text}” Read it aloud. Which word carries the most weight, and why?`,
          `${by} marked this line${pg}: “${n.text}” What does it tell us about the person saying it, or the person it is about?`,
          `${by} marked this line${pg}: “${n.text}” Is this the book's idea in miniature, or an exception to it?`,
        ], n.id + n.text), { by: who, page: n.page });
      } else {
        add('notes', pick([
          `${by} wants to talk about${pg}: “${n.text}” What do you think the author wants us to notice here?`,
          `${by} flagged${pg}: “${n.text}” Did it land the same way for the rest of you, or did you read it differently?`,
          `${by} flagged${pg}: “${n.text}” How does this moment change what you thought earlier in the book?`,
          `${by} wants to talk about${pg}: “${n.text}” What is left unsaid here, and why might the author hold it back?`,
          `${by} flagged${pg}: “${n.text}” Whose point of view is this, and what would it sound like from someone else's?`,
        ], n.id + n.text), { by: who, page: n.page });
      }
    });
    (ctx.themes || []).slice(0, 3).forEach(t => add('academic', pick([
      `${T} keeps returning to ${t.toLowerCase()}. Which scene shows it best, and does the book ever complicate its own view?`,
      `Is ${t.toLowerCase()} something the characters in ${T} choose, or something that happens to them?`,
      `What does ${T} seem to be saying about ${t.toLowerCase()}, and did it change your mind about anything?`,
    ], T + t)));
    (c.history || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 2).forEach(h => add('connect', pick([
      `Which character in ${T} would be most at home in ${h.title}, which our club read before? What would they say to each other?`,
      `${T} and ${h.title} both ask something of the reader. What does each one want from you?`,
      `Which of the two stayed with you longer, ${T} or ${h.title}? Name the moment that did it.`,
    ], T + h.title)));
    (ctx.authorBooks || []).slice(0, 2).forEach(t => add('connect', `${book.author} also wrote ${t}. What does ${T} do differently, and what is unmistakably the same hand?`));
    ACADEMIC_Q.forEach(q => add('academic', q.replace(/\{t\}/g, T)));
    CASUAL_Q.forEach(q => add('casual', q.replace(/\{t\}/g, T)));
    return out;
  }
  const QCATS = [['all', 'All'], ['notes', 'Our notes'], ['casual', 'Casual'], ['academic', 'Academic'], ['connect', 'Connections']];
  const QLABEL = { notes: 'Our notes', casual: 'Casual', academic: 'Academic', connect: 'Connections' };

  // the questions and everyone's quotes, drawn into `host`; shared by the Discussion page and the meeting-time page
  function mountDiscussion(c, meet, host) {
    const cur = bookFor(c, meet);
    const bookObj = meet.book || c.book;
    const ctx = { themes: [], authorBooks: [] };
    const notes = [...(c.notes || [])].sort((a, b) => (a.page || 1e9) - (b.page || 1e9));
    c.discussed = c.discussed || [];
    host.innerHTML = `
      <div class="spoiler">Spoilers ahead</div>
      <div class="sec"><h2>Questions</h2><span class="kicker" id="qcount"></span></div>
      <div class="filters" id="qchips" role="group" aria-label="Question type"></div>
      <ul class="qlist" id="qlist"></ul>

      <div class="sec"><h2>Quotes and notes</h2><span class="kicker">${notes.length}</span></div>
      ${notes.length ? `<ul class="refs">${notes.map(n => `
        <li class="ref"><span class="pagebadge ${n.page ? '' : 'none'}">${n.page ? 'p. ' + n.page : 'any'}</span>
          <div class="ebody"><span class="etype">${n.kind === 'quote' ? 'Quote' : 'Note'} · ${esc(memberName(c, n.author))}</span><p>${n.kind === 'quote' ? '“' + esc(n.text) + '”' : esc(n.text)}</p></div></li>`).join('')}</ul>`
        : '<p class="muted-line">No notes or quotes were added. Members can add them from the meeting page.</p>'}`;
    const paint = () => {
      const qs = buildQuestions(c, meet, ctx);
      const cat = ui.dq || 'all';
      const filtered = qs.filter(q => cat === 'all' || q.cat === cat);
      const shown = ui.qall ? filtered : filtered.slice(0, 8);
      $('#qchips').innerHTML = QCATS.map(([k, l]) => `<button type="button" class="fchip2 ${cat === k ? 'on' : ''}" data-dq="${k}" style="--cc:#14538f">${l}<b>${k === 'all' ? qs.length : qs.filter(q => q.cat === k).length}</b></button>`).join('');
      $('#qcount').textContent = `${c.discussed.length} discussed`;
      $('#qlist').innerHTML = shown.map(q => {
        const done = c.discussed.includes(q.text);
        return `<li class="qcard ${done ? 'done' : ''}"><label class="qcheck"><input type="checkbox" data-q="${q.id}" ${done ? 'checked' : ''}><span class="box" aria-hidden="true"></span></label>
          <div class="qbody"><span class="qtag">${QLABEL[q.cat]}${q.page ? ` · p. ${q.page}` : ''}</span><p>${esc(q.text)}</p></div></li>`;
      }).join('') || '<li class="muted-line">Nothing in this group yet.</li>';
      if (filtered.length > shown.length) $('#qlist').insertAdjacentHTML('beforeend', `<li class="qmore"><button type="button" class="btn ghost" data-more>Show ${filtered.length - shown.length} more</button></li>`);
      const mb = $('[data-more]'); if (mb) mb.onclick = () => { ui.qall = true; paint(); };
      host.querySelectorAll('[data-dq]').forEach(b => b.onclick = () => { ui.dq = b.dataset.dq; ui.qall = false; paint(); });
      host.querySelectorAll('[data-q]').forEach(cb => cb.onchange = () => {
        const q = qs.find(x => x.id === cb.dataset.q);
        const i = c.discussed.indexOf(q.text);
        if (cb.checked && i < 0) c.discussed.push(q.text); else if (!cb.checked && i >= 0) c.discussed.splice(i, 1);
        save(); $('#qcount').textContent = `${c.discussed.length} discussed`; cb.closest('.qcard').classList.toggle('done', cb.checked);
      });
    };
    paint();
    // connections and themes load in the background and add more questions
    (async () => {
      try { ctx.themes = (await ensureSubjects(bookObj)) || []; } catch (e) {}
      try { ctx.authorBooks = await authorBooks(cur.author, cur.title); } catch (e) {}
      if (document.body.contains(host)) paint();
    })();
  }
  function discussionPage(id) {
    const c = byId(id);
    if (!c) { location.hash = '#/'; return; }
    const meet = nextMeeting(c);
    if (!meet) { location.hash = `#/club/${id}`; return; }
    if (!isOpen(c, meet)) { location.hash = `#/club/${id}/meeting`; return; }
    const cur = bookFor(c, meet);
    app.innerHTML = `
      ${clubBar(c, `#/club/${c.id}/meeting`, 'Discussion')}
      <section class="page-head"><div class="kicker">Discussion</div><h1>${esc(cur.title)}</h1><p class="deck">${esc(cur.author)}${cur.pages ? ` · ${cur.pages} pages` : ''}</p></section>
      <div id="disc-host"></div>`;
    mountDiscussion(c, meet, $('#disc-host'));
  }

  /* ---------- next book: suggestions, votes, the list ---------- */
  function nextBookPage(id) {
    const c = byId(id);
    if (!c) { location.hash = '#/'; return; }
    const wl = c.wishlist || [];
    const shared = isOpen(c, nextMeeting(c));
    const sugg = [...(c.suggestions || [])].filter(x => shared || x.by === ME).sort((a, b) => b.votes.length - a.votes.length);
    if (harkUI) {
      const picked = x => c.upNext && normTitle(c.upNext.title) === normTitle(x.title);
      app.innerHTML = `
        <div class="club-top"><a class="back" href="#/club/${c.id}">‹ ${esc(c.name)}</a></div>
        <div class="hk-label hk-reading">${esc(c.name)}</div>
        <section class="club-head"><h1>Our list</h1></section>
        <div class="hk-label hk-sugg-head"><span>List</span><button type="button" class="hk-add" data-pick>+ Suggest a book</button></div>
        ${sugg.length + wl.length ? `<div class="wg hk-list">${[
          ...sugg.map(x => `<div class="hk-row sg-row" style="--cc:${clubColor(c.id)}"><a class="hk-rc" href="#/browse/book?${wishParams(x)}"><span class="cover" data-cover="${c.id}:s:${x.id}">${x.coverId ? coverImg(x.coverId, x.title) : ''}<em>${initial(x.title)}</em></span></a><div class="hk-rt"><a class="hk-rl" href="#/browse/book?${wishParams(x)}"><b>${esc(x.title)}</b></a><span>${esc(x.author)}${x.pages ? ` · ${x.pages} pages` : ''}</span>${picked(x) ? '<em class="sg-picked">Picked</em>' : ''}</div><button type="button" class="hk-vote ${x.votes.includes(ME) ? 'on' : ''}" data-vote="${x.id}" aria-pressed="${x.votes.includes(ME)}" aria-label="Vote for ${esc(x.title)}"><i>▲</i>${x.votes.length}</button></div>`),
          ...wl.filter(w => !sugg.some(x => normTitle(x.title) === normTitle(w.title))).map(w => `<div class="hk-row" style="--cc:${clubColor(c.id)}"><a class="hk-rc" href="#/browse/book?${wishParams(w)}"><span class="cover" data-cover="${c.id}:w:${w.id}">${w.coverId ? coverImg(w.coverId, w.title) : ''}<em>${initial(w.title)}</em></span></a><div class="hk-rt"><a class="hk-rl" href="#/browse/book?${wishParams(w)}"><b>${esc(w.title)}</b></a><span>${esc(w.author)}${w.pages ? ` · ${w.pages} pages` : ''}</span></div><button type="button" class="hk-rm" data-rm-wish="${w.id}">Remove</button></div>`)].join('')}</div>` : '<div class="wg nm-empty"><div class="wg-val">Nothing on the list yet</div><div class="wg-sub">Tap + Suggest a book, or add one from Browse.</div></div>'}`;
    } else
    app.innerHTML = `
      ${clubBar(c, `#/club/${c.id}/meeting`, 'Suggestions')}
      <section class="page-head"><div class="kicker">${clubMark(c)} ${esc(c.name)}</div><h1>Book suggestions</h1></section>

      <div class="subhead"><span class="kicker">${sugg.length} suggested</span><button type="button" class="mini-link" data-pick>+ Suggest a book</button></div>
      ${sugg.length ? `<ul class="suggs">${sugg.map(x => `
        <li class="srow2 ${c.upNext && normTitle(c.upNext.title) === normTitle(x.title) ? 'is-picked' : ''}">
          <span class="thumb" data-cover="${c.id}:s:${x.id}">${x.coverId ? coverImg(x.coverId, x.title) : ''}<em>${initial(x.title)}</em></span>
          <div class="winfo"><a class="wtitle" href="#/browse/book?${wishParams(x)}">${esc(x.title)}</a>${c.upNext && normTitle(c.upNext.title) === normTitle(x.title) ? '<span class="pickedtag">Picked</span>' : ''}<div class="by">${esc(x.author)}${x.pages ? ` · ${x.pages} pages` : ''}<br>Suggested by ${esc(memberName(c, x.by))}</div></div>
          <div class="sact"><button type="button" class="vote ${x.votes.includes(ME) ? 'on' : ''}" data-vote="${x.id}" aria-pressed="${x.votes.includes(ME)}" aria-label="Vote for ${esc(x.title)}">▲ ${x.votes.length}</button></div>
        </li>`).join('')}</ul>` : '<p class="muted-line">No suggestions yet.</p>'}

      <div class="sec"><h2>Want to read</h2><span class="kicker">${wl.length}</span></div>
      ${wl.length ? `<div class="hshelf">${wl.map(w => `
        <div class="tile">
          <a href="#/browse/book?${wishParams(w)}"><span class="cover" data-cover="${c.id}:w:${w.id}">${w.coverId ? coverImg(w.coverId, w.title) : ''}<em>${esc(w.title)}</em></span></a>
          <a class="ttitle" href="#/browse/book?${wishParams(w)}">${esc(w.title)}</a>
          <div class="tmeta">${esc(w.author)}${w.pages ? ` · ${w.pages} pages` : ''}</div>
          <button type="button" class="rmlink" data-rm-wish="${w.id}">Remove</button>
        </div>`).join('')}</div>` : '<p class="muted-line">Nothing on the list yet. Find a book in <a class="inl" href="#/browse">Browse</a> and tap “Add to list”.</p>'}
    `;
    const rerender = () => nextBookPage(id);
    app.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => openPicker(c, rerender, { suggestOnly: true }));
    app.querySelectorAll('[data-vote]').forEach(b => b.onclick = () => {
      const x = c.suggestions.find(y => y.id === b.dataset.vote), i = x.votes.indexOf(ME);
      if (i >= 0) x.votes.splice(i, 1); else x.votes.push(ME);
      save(); rerender();
    });
    app.querySelectorAll('[data-rm-wish]').forEach(b => b.onclick = () => { c.wishlist = wl.filter(w => w.id !== b.dataset.rmWish); save(); rerender(); });
  }

  /* ---------- wrap up: rate, pick the next book, set the next date ---------- */
  function openWrap(c, onDone) {
    const meet = nextMeeting(c);
    if (!meet) return;
    meet.id = meet.id || 'm' + Math.random().toString(36).slice(2, 9);
    // fixed ids, so if several people wrap up at once they all create the SAME previous meeting and next meeting
    const hid = 'h' + meet.id, nid = 'n' + meet.id;
    let already = false;
    const cur = bookFor(c, meet);
    const ct = clubTime(c);
    const base = new Date(Math.max(Date.now(), new Date(meet.date).getTime()));
    const d0 = new Date(base.getTime() + 14 * DAY);
    const dateVal = `${d0.getFullYear()}-${pad(d0.getMonth() + 1)}-${pad(d0.getDate())}`;
    const top = [...(c.suggestions || [])].sort((a, b) => b.votes.length - a.votes.length)[0];
    const seed = c.upNext || top;
    let next = seed ? { title: seed.title, author: seed.author, pages: seed.pages, coverId: seed.coverId, key: seed.key || '' } : null;
    let rating = 0;

    const root = document.createElement('div');
    root.className = 'plan';
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Wrap up the meeting');
    root.innerHTML = `
      <div class="plan-bar"><button type="button" class="linkbtn" data-cancel>Cancel</button><strong>Wrap up</strong><span></span></div>
      <div class="plan-scroll">
        <section class="fcard">
          <div class="kicker">1 · How was ${esc(cur.title)}?</div>
          <div class="stars big" id="wr-stars" role="group" aria-label="Your rating">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-r="${n}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}</div>
        </section>
        <section class="fcard">
          <div class="kicker">2 · The next book</div>
          <button type="button" class="bookpick" id="wr-book"></button>
        </section>
        <section class="fcard">
          <div class="kicker">3 · The next meeting</div>
          <div class="frow">
            <label class="fl">Date<input id="wr-date" type="date" value="${dateVal}"></label>
            <label class="fl">Time<input id="wr-time" type="time" value="${ct.time}"></label>
          </div>
          <label class="fl">Place<input id="wr-place" maxlength="60" placeholder="Someone's living room" value="${esc(meet.place || '')}"></label>
          <label class="fl">Address<input data-addr autocomplete="off" id="wr-addr" maxlength="120" placeholder="Street, city (opens in Maps)" value="${esc(meet.address || '')}"></label>
          <label class="later"><input type="checkbox" id="wr-later"> <span>Schedule it later</span></label>
        </section>
      </div>
      <div class="plan-foot"><button type="button" class="btn big" id="wr-go">Done</button></div>`;
    document.body.appendChild(root);
    document.body.style.overflow = 'hidden';
    const onKey = e => { if (e.key === 'Escape' && !document.querySelector('.sheet-backdrop')) close(); };
    const close = () => { document.removeEventListener('keydown', onKey); wrapListeners.delete(checkAlready); document.body.style.overflow = ''; root.remove(); };
    document.addEventListener('keydown', onKey);
    root.querySelector('[data-cancel]').onclick = close;
    const $$ = i => root.querySelector('#' + i);

    const paintStars = () => $$('wr-stars').querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.r <= rating));
    $$('wr-stars').querySelectorAll('button').forEach(b => b.onclick = () => { rating = rating === +b.dataset.r ? 0 : +b.dataset.r; paintStars(); });
    const paintBook = () => {
      $$('wr-book').innerHTML = next
        ? `<span class="thumb">${next.coverId ? coverImg(next.coverId, next.title) : ''}<em>${initial(next.title)}</em></span><span class="bpt"><b>${esc(next.title)}</b><small>${esc(next.author)}${next.pages ? ` · ${next.pages} pages` : ''}</small></span><span class="chev">Change ›</span>`
        : `<span class="thumb empty">+</span><span class="bpt"><b>Choose the next book</b><small>From your list, suggestions, recommendations or search</small></span><span class="chev">›</span>`;
    };
    paintBook();
    $$('wr-book').onclick = () => openPicker(c, () => {}, { select: b => { next = { title: b.title, author: b.author, pages: b.pages, coverId: b.coverId, key: b.key }; paintBook(); } });
    $$('wr-later').onchange = e => { ['wr-date', 'wr-time'].forEach(i => { $$(i).disabled = e.target.checked; }); };

    // someone else in the club already finished the wrap-up: fill in what they chose, and only ask for your rating
    function checkAlready() {
      if (already || !(c.history || []).some(x => x.id === hid)) return;
      already = true;
      const nm = (c.meetings || []).find(x => x.id === nid);
      next = c.book ? { title: c.book.title, author: c.book.author, pages: c.book.pages, coverId: c.book.coverId, key: c.book.key || '' } : next;
      paintBook(); $$('wr-book').disabled = true;
      $$('wr-later').checked = !nm; $$('wr-later').disabled = true;
      if (nm) {
        const d = new Date(nm.date);
        $$('wr-date').value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        $$('wr-time').value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        $$('wr-place').value = nm.place && nm.place !== 'TBD' ? nm.place : '';
        $$('wr-addr').value = nm.address || '';
      }
      ['wr-date', 'wr-time', 'wr-place', 'wr-addr'].forEach(i => { $$(i).disabled = true; });
      if (!root.querySelector('.wr-already')) root.querySelector('.plan-scroll').insertAdjacentHTML('afterbegin', '<p class="wr-already">Someone in your club already set up the next book and meeting. Rate the book and tap Done.</p>');
    }
    wrapListeners.add(checkAlready);
    checkAlready();

    $$('wr-go').onclick = () => {
      if (already) {
        const h = (c.history || []).find(x => x.id === hid);
        if (h && rating) { h.ratings = h.ratings || {}; h.ratings[ME] = rating; }
        save(); close(); onDone();
        return;
      }
      if (!next) { toast('Choose the next book first'); return; }
      const later = $$('wr-later').checked;
      let when = null;
      if (!later) {
        when = new Date(`${$$('wr-date').value}T${$$('wr-time').value}`);
        if (isNaN(when)) { toast('Pick a date and time, or schedule it later'); return; }
      }
      // 1. archive this meeting as a previous meeting
      const bk = bookFor(c, meet);
      const quotes = (c.notes || []).filter(n => n.kind === 'quote').map(n => ({ id: n.id, author: n.author, text: n.text, page: n.page }));
      c.history = c.history || [];
      c.history = c.history.filter(x => x.id !== hid);
      c.history.push({
        id: hid, title: bk.title, author: bk.author, pages: bk.pages || null, coverId: bk.coverId, key: bk.key || '', subjects: bk.subjects,
        date: meet.date, place: meet.place || '', note: meet.note || '', going: [...meet.going], table: meet.table || null,
        ratings: rating ? { [ME]: rating } : {}, quotes, notes: (c.notes || []).filter(n => n.kind === 'note'), updates: c.updates || [], discussed: [...(c.discussed || [])],
      });
      c.meetings = c.meetings.filter(m => m !== meet);
      c.notes = []; c.updates = []; c.discussed = [];
      // 2. the next book becomes the club's current book
      const same = x => normTitle(x.title) === normTitle(next.title);
      c.book = { title: next.title, author: next.author || 'Unknown author', pages: next.pages || null, coverId: next.coverId || undefined, key: next.key || '' };
      c.wishlist = (c.wishlist || []).filter(x => !same(x));
      c.suggestions = (c.suggestions || []).filter(x => !same(x));
      c.upNext = null;
      // 3. the next meeting
      if (when) c.meetings.push({ id: nid, date: when.toISOString(), place: $$('wr-place').value.trim() || 'TBD', address: $$('wr-addr').value.trim(), note: '', going: [ME], out: [], table: null, createdAt: new Date().toISOString() });
      save(); fetchCovers(); close(); onDone();
    };
  }

  /* ---------- past reads ---------- */
  function pastBook(cid, hid) {
    const c = byId(cid);
    const h = c && (c.history || []).find(x => x.id === hid);
    if (!h) { location.hash = c ? `#/club/${cid}` : '#/'; return; }
    const idx = c.history.indexOf(h);
    const mine = (h.ratings || {})[ME] || 0;
    const quotes = h.quotes || [];
    const points = h.discussed || [];
    app.innerHTML = `
      ${clubBar(c, `#/club/${c.id}`, 'Previous meeting')}
      ${bookUI ? bookHero(c, h, 'past') : harkUI ? harkHero(c, h, 'past') : posterHero(c, h, 'past')}

      <div class="sec"><h2>Ratings</h2><span class="kicker">${pluralize(ratingVals(h).length, 'rating')}</span></div>
      <div class="rating-card">
        <div class="avg"><b>${avgText(h)}</b><div><div class="stars-s">${starSpans(avgOf(h))}</div><span class="kicker">Group average</span></div></div>
        <ul class="rate-list">
          ${c.members.map(m => {
            const r = (h.ratings || {})[m.id] || 0;
            return `<li class="rate-row">
              <span class="who">${avatar(m)}<b>${esc(m.id === ME ? 'You' : m.name)}</b></span>
              ${m.id === ME
                ? `<span class="stars" role="group" aria-label="Your rating">${[1, 2, 3, 4, 5].map(n => `<button data-r="${n}" class="${mine >= n ? 'on' : ''}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}</span>`
                : r ? `<span class="stars-s" aria-label="${r} out of 5">${starSpans(r)}</span>` : '<span class="kicker">Not rated</span>'}
            </li>`;
          }).join('')}
        </ul>
      </div>

      <div class="sec"><h2>Favorite quotes</h2><span class="kicker">${quotes.length}</span></div>
      ${quotes.length ? `<ul class="quotes">${quotes.map(q => `<li class="quote"><blockquote>“${esc(q.text)}”</blockquote><div class="by">— ${esc(memberName(c, q.author))}${q.page ? ` · p. ${q.page}` : ''}</div></li>`).join('')}</ul>` : '<p class="muted-line">No quotes were saved for this meeting.</p>'}

      <div class="sec"><h2>Discussion points</h2><span class="kicker">${points.length}</span></div>
      ${points.length ? `<ul class="points">${points.map(p => `<li><span class="tick" aria-hidden="true">✓</span><p>${esc(p)}</p></li>`).join('')}</ul>` : '<p class="muted-line">No discussion points were saved for this meeting.</p>'}
    `;
    app.querySelectorAll('.rate-row .stars button').forEach(btn => btn.onclick = () => {
      const r = +btn.dataset.r;
      h.ratings = h.ratings || {};
      if (h.ratings[ME] === r) delete h.ratings[ME]; else h.ratings[ME] = r;
      save(); pastBook(cid, hid);
    });
  }

  /* ---------- calendar ---------- */
  let cal = null;
  function calendar() {
    const now = new Date();
    if (!cal) cal = { y: now.getFullYear(), m: now.getMonth(), sel: dkey(now) };
    const all = [];
    state.clubs.forEach(c => {
      const hist = c.history || [];
      const hd = new Set(hist.map(h => dkey(new Date(h.date))));
      (c.meetings || []).forEach(m => { const d = new Date(m.date); if (d < now && hd.has(dkey(d))) return; all.push({ c, m, d, href: `#/club/${c.id}/meeting`, title: bookFor(c, m).title, bk: bookFor(c, m), key: coverKeyFor(c, m) }); });
      hist.forEach(h => all.push({ c, m: { date: h.date, place: h.place || '' }, d: new Date(h.date), href: `#/club/${c.id}/book/${h.id}`, title: h.title, bk: h, key: `${c.id}:${h.id}` }));
    });
    all.sort((a, b) => a.d - b.d);
    const byDay = {};
    all.forEach(e => (byDay[dkey(e.d)] = byDay[dkey(e.d)] || []).push(e));

    const start = new Date(cal.y, cal.m, 1).getDay();
    const dim = new Date(cal.y, cal.m + 1, 0).getDate();
    const title = new Date(cal.y, cal.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const todayKey = dkey(now);
    let cells = '';
    for (let i = 0; i < start; i++) cells += '<span class="day blank"></span>';
    for (let d = 1; d <= dim; d++) {
      const dt = new Date(cal.y, cal.m, d), k = dkey(dt), ev = byDay[k] || [];
      const past = dt < new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const cols = [...new Set(ev.map(e => clubColor(e.c.id)))];
      const bg = cols.length > 1 ? `linear-gradient(135deg, ${cols.map((c, i) => `${c} ${Math.round(i * 100 / cols.length)}% ${Math.round((i + 1) * 100 / cols.length)}%`).join(', ')})` : cols[0] || '';
      cells += `<button class="day ${ev.length ? 'has-ev' : ''} ${ev.length && past ? 'ev-past' : ''} ${k === todayKey ? 'today' : ''} ${k === cal.sel ? 'sel' : ''}" ${ev.length ? `style="--ev:${bg};--evx:${cols.length === 1 ? onColor(cols[0]) : '#fff'}"` : ''} data-key="${k}" aria-label="${fmtLong(dt)}${ev.length ? ', book club' : ''}">
        <span class="num">${d}</span>
        ${ev.length ? `<span class="day-cover">${coverHTML(ev[0].bk, ev[0].key)}</span>${ev.length > 1 ? `<b class="day-n">+${ev.length - 1}</b>` : ''}<span class="mark ${past ? 'past' : ''}">${ICON_BOOK}</span>` : ''}
      </button>`;
    }

    const sel = byDay[cal.sel] || [];
    const [sy, sm, sd] = cal.sel.split('-').map(Number);
    const selDate = new Date(sy, sm - 1, sd);
    const upcoming = all.filter(e => e.d >= now).slice(0, 4);
    const row = (e, showDate) => `
      <a class="event" href="${e.href}">
        <div class="date"><span>${e.d.toLocaleDateString(undefined, { month: 'short' })}</span><b>${e.d.getDate()}</b></div>
        <div><h2>${esc(e.title || e.c.name)}</h2><p class="ev-club" style="--cc:${clubColor(e.c.id)}">${esc(e.c.name)}</p><p>${showDate ? `${fmtShort(e.m.date)} · ` : ''}${fmtTime(e.m.date)}${e.m.place ? ` · ${esc(e.m.place)}` : ''}</p></div>
      </a>`;

    app.innerHTML = `
      <div class="cal-bar">
        <h1>${title}</h1>
        <div class="cal-nav">
          <button data-nav="-1" aria-label="Previous month">${ICON_PREV}</button>
          <button class="today-btn" data-nav="0">Today</button>
          <button data-nav="1" aria-label="Next month">${ICON_NEXT}</button>
        </div>
      </div>
      <div class="grid">
        ${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => `<span class="dow">${d}</span>`).join('')}
        ${cells}
      </div>
      <section class="detail">
        <div class="kicker">${fmtLong(selDate)}</div>
        <div class="panel">${sel.length ? sel.map(e => row(e)).join('') : '<p class="muted-line">No book club on this day.</p>'}</div>
      </section>
      <div class="sec"><h2>Coming up</h2></div>
      <div class="panel">${upcoming.map(e => row(e, true)).join('') || '<p class="muted-line">Nothing on the calendar.</p>'}</div>`;

    fetchCovers();
    app.querySelectorAll('[data-key]').forEach(b => b.onclick = () => { cal.sel = b.dataset.key; calendar(); });
    app.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => {
      const n = +b.dataset.nav;
      if (n === 0) { const t = new Date(); cal = { y: t.getFullYear(), m: t.getMonth(), sel: dkey(t) }; }
      else { const t = new Date(cal.y, cal.m + n, 1); cal.y = t.getFullYear(); cal.m = t.getMonth(); }
      calendar();
    });
  }

  /* ---------- notifications ---------- */
  // "You are bringing", "Maya is bringing", "Maya and Jo are bringing", "Everyone is bringing"
  // "On the table" rows in the create / plan forms: one row per person, with + Add another
  const tbRow = (list) => `<div class="frow tb-row"><label class="fl">Who is bringing food<input data-tb="who" maxlength="40" list="${list}" placeholder="Name"></label><label class="fl">What they're bringing<input data-tb="food" maxlength="60" placeholder="Food"></label></div>`;
  const tbBlock = list => `<div class="tb-rows">${tbRow(list)}</div><button type="button" class="hk-add tb-add" data-add-tb>+ Add another</button>`;
  const tbWire = (root, list) => { const b = root.querySelector('[data-add-tb]'); if (b) b.onclick = () => { const rows = root.querySelector('.tb-rows'); rows.insertAdjacentHTML('beforeend', tbRow(list)); const last = rows.lastElementChild.querySelector('input'); if (last) last.focus(); }; };
  // returns { table, bad } where bad is the input still missing its other half
  const tbRead = root => {
    const out = []; let bad = null;
    root.querySelectorAll('.tb-row').forEach(row => {
      const w = row.querySelector('[data-tb="who"]'), fd = row.querySelector('[data-tb="food"]');
      const who = w.value.trim(), food = fd.value.trim();
      if (!who && !food) return;
      if (!who || !food) { bad = bad || (who ? fd : w); return; }
      out.push({ name: who, food, at: new Date().toISOString() });
    });
    return { table: out.length ? out : null, bad };
  };
  const tableList = m => !m || !m.table ? [] : Array.isArray(m.table) ? m.table : [m.table];
  function whoBrings(name) {
    const n = String(name || '').trim();
    if (/^(you|me|i|myself)$/i.test(n) || (myName() && n.toLowerCase() === myName().toLowerCase())) return { who: myName() || 'You', verb: myName() ? 'is' : 'are' };
    if (/^(we|us|they|them)$/i.test(n) || /(\s&\s|\band\b|\s\+\s|,|\/)/i.test(n)) return { who: n, verb: 'are' };
    return { who: n, verb: 'is' };
  }
  function buildNotifs() {
    const upcoming = [], updates = [];
    const nf = (state.profile && state.profile.notif) || { created: true, half: true, before: true, food: true, chat: true, days: 2 };
    state.clubs.forEach(c => {
      const m = nextMeeting(c);
      if (m) {
        const n = dayDiff(m.date);
        const t0 = new Date(m.date).getTime();
        const when = `${fmtShort(m.date)} · ${fmtTime(m.date)}${m.place ? ` · ${m.place}` : ''}`;
        // meeting reminders: when it is created, halfway to the meeting, and two days before
        const made = m.createdAt ? new Date(m.createdAt).getTime() : t0 - 21 * 864e5;
        const bk = bookFor(c, m).title;
        [['created', made, 'Meeting scheduled', `${bk} · ${when}`],
         ['half', made + (t0 - made) / 2, `Halfway to ${bk}`, `${relPhrase(m.date)[0].toUpperCase() + relPhrase(m.date).slice(1)}: ${when}`],
         ['2d', t0 - nf.days * 864e5, `Meets in ${nf.days} ${nf.days === 1 ? 'day' : 'days'}`, `${bk} · ${when}`]].forEach(([k, at, title, body]) => {
          if (at > Date.now() || (k !== 'created' && at < made)) return;
          if ((k === 'created' && !nf.created) || (k === 'half' && !nf.half) || (k === '2d' && !nf.before)) return;
          upcoming.push({ id: `cm:${k}:${c.id}:${m.date}`, kind: 'Reminder', clubName: c.name, emoji: c.emoji, title, body, time: relDay(m.date), club: c.id, sort: t0, pri: 1, added: at });
        });
        if (n <= 7 && nf.food) {
          const tl = tableList(m);
          if (tl.length) {
            tl.forEach(t => {
              const mine = /^(you|me|i|myself)$/i.test(t.name.trim());
              upcoming.push({ id: `food:${c.id}:${m.date}:${t.name}:${t.food}`, kind: 'Reminder', clubName: c.name, emoji: c.emoji, title: mine ? `Bring ${t.food}` : `${whoBrings(t.name).who} ${whoBrings(t.name).verb} bringing ${t.food}`, body: mine ? `You're on food for ${fmtShort(m.date)}. Doors at ${fmtTime(m.date)}.` : `For ${fmtShort(m.date)} at ${fmtTime(m.date)}.`, time: relDay(m.date), club: c.id, sort: t0, pri: mine ? 0 : 1, added: t.at ? new Date(t.at).getTime() : Math.max(t0 - 7 * 864e5, m.createdAt ? new Date(m.createdAt).getTime() : 0) });
            });
          }
        }
      }
      (nf.chat ? (c.updates || []) : []).filter(u => u.author !== ME).forEach(u => updates.push({
        id: `up:${u.id}`, kind: 'Club update', clubName: c.name, emoji: c.emoji, author: u.author, title: `${memberName(c, u.author)} posted`, body: u.text, time: timeAgo(u.at), club: c.id, sort: new Date(u.at).getTime(), added: new Date(u.at).getTime(),
      }));
    });
    upcoming.sort((a, b) => a.sort - b.sort || a.pri - b.pri);
    updates.sort((a, b) => b.sort - a.sort);
    return { upcoming, updates };
  }
  const unreadCount = () => { const n = buildNotifs(); return [...n.upcoming, ...n.updates].filter(x => !state.read[x.id]).length; };

  let alertFilter = null;
  function notifications() {
    const all = buildNotifs();
    const keep = n => !alertFilter || n.club === alertFilter;
    const upcoming = all.upcoming.filter(keep), updates = all.updates.filter(keep);
    const everything = [...all.upcoming, ...all.updates];
    const item = n => `
      <li><a class="notif ${state.read[n.id] ? '' : 'unread'}" href="#/club/${n.club}/meeting" data-nid="${esc(n.id)}" style="--cc:${clubColor(n.club)};--cx:${onColor(clubColor(n.club))}">
        <div class="nhead"><span class="ctag">${clubMarkId(n.club, n.emoji)} ${esc(n.clubName)}</span><span class="nkind">${esc(n.kind)}</span><span class="time">${esc(n.time)}</span></div>
        <h3>${esc(n.title)}</h3>
        <p>${esc(n.body)}</p>
        ${state.read[n.id] ? '' : '<span class="pip" aria-label="Unread"></span>'}
      </a></li>`;
    const unread = everything.filter(x => !state.read[x.id]).length;
    const chip = (id, label, color) => {
      const n = everything.filter(x => (!id || x.club === id) && !state.read[x.id]).length;
      return `<button type="button" class="fchip2 ${alertFilter === id ? 'on' : ''}" data-filter="${id || ''}" style="--cc:${color}" aria-pressed="${alertFilter === id}">${id ? `<span class="chip-emoji">${clubMarkId(id)}</span>` : ''}${esc(label)}${n ? `<b>${n}</b>` : ''}</button>`;
    };
    if (harkUI) {
      const arow = n => {
        const ac = byId(n.club), am = ac && nextMeeting(ac), ab = ac && (am ? bookFor(ac, am) : ac.book);
        const pip = state.read[n.id] ? '' : '<span class="al-pip" aria-label="Unread"></span>';
        if (n.kind === 'Club update') {
          // a chat message: a round avatar and a speech bubble
          const who = String(n.title || '?').replace(/ posted$/, '');
          return `<a class="hk-row al-row al-chat" href="#/club/${n.club}/chat" data-nid="${esc(n.id)}" style="--cc:${clubColor(n.club)}"><span class="al-av2">${avatar({ id: n.author || who, name: who })}</span><span class="hk-rt"><span class="al-meta">${esc(who)} in ${esc(n.clubName)} · ${esc(n.time)}</span><span class="al-bubble">${esc(n.body)}</span></span>${pip}</a>`;
        }
        return `<a class="hk-row al-row al-meet" href="#/club/${n.club}" data-nid="${esc(n.id)}" style="--cc:${clubColor(n.club)}">${ab ? `<span class="hk-rc">${coverHTML(ab, am ? coverKeyFor(ac, am) : ac.id)}</span>` : '<span class="hk-dot"></span>'}<span class="hk-rt"><b>${esc(n.title)}</b><span>${esc(n.body)}</span><span class="al-meta">${esc(n.clubName)} · ${esc(n.kind)} · ${esc(timeAgo(new Date(n.added).toISOString()))}</span></span>${pip}</a>`;
      };
      app.innerHTML = `
        <section class="club-head"><h1>Alerts</h1></section>
        <p class="al-deck">${unread ? `${unread} unread` : 'All caught up'}${unread ? ' · <button class="linkbtn" id="read-all">Mark all as read</button>' : ''}</p>
        <div class="filters" role="group" aria-label="Filter by club">${chip(null, 'All clubs', '#a9bccd')}${state.clubs.map(c => chip(c.id, c.name, clubColor(c.id))).join('')}</div>
        ${(() => {
          const sorted = [...upcoming, ...updates].sort((x, y) => y.added - x.added);
          if (!sorted.length) return '<p class="muted-line">Nothing new.</p>';
          const un = sorted.filter(n => !state.read[n.id]), rd = sorted.filter(n => state.read[n.id]);
          return (un.length ? `<div class="hk-label hk-sugg-head"><span>Unread</span><span class="hk-count">${un.length}</span></div><div class="wg hk-list">${un.map(arow).join('')}</div>` : '')
            + (rd.length ? `<div class="hk-label hk-sugg-head"><span>Read</span><span class="hk-count">${rd.length}</span></div><div class="wg hk-list">${rd.map(arow).join('')}</div>` : '');
        })()}`;
    } else
    app.innerHTML = `
      <section class="page-head">
        <div class="kicker">Alerts</div>
        <h1>What's new</h1>
        <p class="deck">${unread ? `${unread} unread.` : 'You are all caught up.'} ${unread ? '<button class="linkbtn" id="read-all">Mark all as read</button>' : ''}</p>
      </section>
      <div class="filters" role="group" aria-label="Filter by club">${chip(null, 'All clubs', '#a9bccd')}${state.clubs.map(c => chip(c.id, c.name, clubColor(c.id))).join('')}</div>
      <div class="sec"><h2>Coming up</h2></div>
      <ul class="notifs">${upcoming.map(item).join('') || '<li class="muted-line">Nothing coming up.</li>'}</ul>
      <div class="sec"><h2>From your clubs</h2></div>
      <ul class="notifs">${updates.map(item).join('') || '<li class="muted-line">No updates yet.</li>'}</ul>`;

    app.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => { alertFilter = b.dataset.filter || null; notifications(); });
    app.querySelectorAll('[data-nid]').forEach(a => a.addEventListener('click', () => { state.read[a.dataset.nid] = true; save(); updateBadge(); }));
    const ra = $('#read-all');
    if (ra) ra.onclick = () => { [...upcoming, ...updates].forEach(n => state.read[n.id] = true); save(); notifications(); updateBadge(); };
  }

  /* ---------- stats ---------- */
  function readBooks() {
    const out = [];
    state.clubs.forEach(c => {
      (c.history || []).forEach(h => out.push({ ...h, club: c.name, cid: c.id, mine: (h.ratings || {})[ME] || 0, avg: avgOf(h), finishedAt: h.date, ref: h, key: `${c.id}:${h.id}` }));
    });
    return out.sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));
  }


  const SETTINGS_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 14.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
  const SETTINGS_LINK = `<a class="settings-btn" href="#/settings" aria-label="Settings">${SETTINGS_ICON}</a>`;
  const PROFILE_COLORS = ['', '#1f7f7c', '#4f7fa8', '#c8333a', '#d98a1c', '#5e8c61', '#8a3d5c', '#6d7279'];

  function clubSettings(id) {
    const c = byId(id);
    if (!c) { location.hash = '#/'; return; }
    c.defaults = c.defaults || { time: '', place: '' };
    const cur = THEME_OPTIONS[c.themeKey] ? c.themeKey : 0;
    app.innerHTML = `
      <div class="club-top"><a class="back" href="#/club/${id}">‹ ${esc(c.name)}</a></div>
      <section class="club-head"><h1>Club settings</h1></section>
      <div class="hk-label">Club color</div>
      <div class="wg st-card"><div class="cs-colors" role="group" aria-label="Club color">${[2, 3, 4, 5, 0, 1, 7, 6].map(i => [THEME_OPTIONS[i], i]).map(([o, i]) => `<button type="button" class="cs-sw ${i === cur ? 'on' : ''}" data-theme="${i}" style="--sw:${o.t[2]}" aria-label="${o.name}" aria-pressed="${i === cur}"><span></span><em>${o.name}</em></button>`).join('')}</div></div>
      ${c.inviteCode ? `<div class="hk-label">Invite code</div>
      <div class="wg st-card cs-code"><b class="cs-code-v">${esc(c.inviteCode)}</b><p class="fhint">Friends tap “Join a club” on their home page and enter this code. Or send them a text invite from the RSVP tab.</p><button type="button" class="btn ghost" data-copy-code="${esc(c.inviteCode)}">Copy code</button></div>` : ''}
      <div class="hk-label">Standard meeting</div>
      <form class="wg st-card" id="cs-form" novalidate>
        <label class="fl">Usual time<input type="time" name="time" value="${esc(c.defaults.time || '')}"></label>
        <label class="fl">Usual location<input name="place" maxlength="60" placeholder="Someone's living room" value="${esc(c.defaults.place || '')}"></label>
        <p class="fhint">New meetings you plan start with this time and place.</p>
        <button class="btn">Save</button>
      </form>`;
    app.querySelectorAll('[data-theme]').forEach(b => b.onclick = () => { c.themeKey = +b.dataset.theme; save(); route(); });
    $('#cs-form').onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.target);
      c.defaults = { time: (f.get('time') || '').trim(), place: (f.get('place') || '').trim() };
      save();
    };
  }

  function settingsPage() {
    const p = state.profile = state.profile || { name: '', email: '', phone: '', color: '', photo: '' };
    p.notif = Object.assign({ created: true, half: true, before: true, food: true, chat: true, days: 2 }, p.notif || {});
    const big = p.photo ? `background:url('${p.photo}') center/cover` : `background:${p.color || avColor(ME)};${p.color ? '' : 'color:#1f2328'}`;
    app.innerHTML = `
      <div class="club-top"><a class="back" href="#/stats">‹ Stats</a></div>
      <section class="club-head"><h1>Settings</h1></section>
      <div class="hk-label">Your icon</div>
      <div class="wg st-card">
        <div class="st-avatar" style="${big}">${p.photo ? '' : initial(p.name || 'You')}</div>
        <div class="st-swatches" role="group" aria-label="Icon color">${PROFILE_COLORS.map(c => `<button type="button" class="st-sw ${!p.photo && p.color === c ? 'on' : ''}" data-color="${c}" style="background:${c || 'conic-gradient(#8fb8e8, #7fd6a8, #f0c35a, #f0a1a1, #b0b9e8, #8fb8e8)'}" aria-label="${c ? 'Color ' + c : 'Automatic color'}"></button>`).join('')}</div>
        <div class="st-photo"><label class="mini-link st-up">Choose a photo<input type="file" id="st-file" accept="image/*" hidden></label>${p.photo ? '<button type="button" class="mini-link" id="st-rm">Remove photo</button>' : ''}</div>
      </div>
      <div class="hk-label">Notifications</div>
      <div class="wg st-card st-notif">
        ${[['created', 'Meeting scheduled', 'When a new meeting is created'], ['half', 'Halfway reminder', 'Halfway between scheduling and the meeting'], ['before', 'Day-before reminder', 'A reminder shortly before the meeting'], ['food', 'Food sign-ups', 'When someone says what they are bringing'], ['chat', 'Club chat', 'New messages from your clubs']].map(([k, t, d]) => `<label class="st-row"><span class="st-rt"><b>${t}</b><small>${d}</small></span><input type="checkbox" class="st-sw-in" data-notif="${k}" ${p.notif[k] ? 'checked' : ''}><i class="st-switch" aria-hidden="true"></i></label>`).join('')}
        <div class="st-row st-days"><span class="st-rt"><b>Day-before timing</b><small>How early the reminder arrives</small></span><div class="seg" role="radiogroup" aria-label="Days before">${[1, 2, 3, 7].map(n => `<label><input type="radio" name="days" value="${n}" ${p.notif.days === n ? 'checked' : ''}><span>${n === 7 ? '1 wk' : n + ' d'}</span></label>`).join('')}</div></div>
      </div>
      <div class="hk-label">Profile</div>
      <form class="wg st-card" id="st-form" novalidate>
        <label class="fl">Your name<input name="name" maxlength="40" autocomplete="name" placeholder="Visible to your clubs" value="${esc(p.name || '')}"></label>
        <label class="fl">Email<input type="email" name="email" inputmode="email" autocomplete="email" placeholder="you@example.com" value="${esc(p.email || '')}"></label>
        <label class="fl">Phone number<input type="tel" name="phone" inputmode="tel" autocomplete="tel" placeholder="(555) 123-4567" value="${esc(p.phone || '')}"></label>
        <button class="btn">Save</button>
      </form>
      ${BACKEND ? `<div class="hk-label">Account</div><div class="wg st-card"><p class="fhint" style="margin:0 0 10px">Signed in as ${esc(authEmail)}</p><button type="button" class="btn ghost" data-signout>Sign out</button></div>` : ''}`;
    app.querySelectorAll('[data-notif]').forEach(i => i.onchange = () => { p.notif[i.dataset.notif] = i.checked; save(); updateBadge(); });
    app.querySelectorAll('.st-days input[name=days]').forEach(i => i.onchange = () => { p.notif.days = +i.value; save(); updateBadge(); });
    app.querySelectorAll('[data-color]').forEach(b => b.onclick = () => { p.color = b.dataset.color; p.photo = ''; save(); settingsPage(); });
    const rm = $('#st-rm'); if (rm) rm.onclick = () => { p.photo = ''; save(); settingsPage(); };
    $('#st-file').onchange = e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      const img = new Image(), url = URL.createObjectURL(f);
      img.onload = () => {
        const s = 192, cv = document.createElement('canvas'); cv.width = cv.height = s;
        const m = Math.min(img.width, img.height);
        cv.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s);
        p.photo = cv.toDataURL('image/jpeg', .85); URL.revokeObjectURL(url); save(); settingsPage();
      };
      img.onerror = () => { URL.revokeObjectURL(url); toast('Could not read that image'); };
      img.src = url;
    };
    $('#st-form').onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.target), email = (f.get('email') || '').trim(), phone = (f.get('phone') || '').trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Enter a valid email'); return; }
      if (phone && phone.replace(/\D/g, '').length < 7) { toast('Enter a valid phone number'); return; }
      p.name = (f.get('name') || '').trim(); p.email = email; p.phone = phone; save(); settingsPage();
    };
  }


  /* ---------- a member's profile: the clubs and meetings you have shared ---------- */
  let personFilter = null;
  const personName = pid => {
    if (people[pid] && people[pid].name) return people[pid].name;
    for (const c of state.clubs) { const m = c.members.find(x => x.id === pid); if (m && m.name) return m.name; }
    return 'Member';
  };
  function personPage(pid) {
    if (pid === ME) { location.hash = '#/settings'; return; }
    const name = personName(pid);
    // the clubs you both belong to
    const shared = state.clubs.filter(c => c.members.some(m => m.id === pid));
    if (personFilter && !shared.some(c => c.id === personFilter)) personFilter = null;
    // every meeting you were both at (past) or both going to (upcoming)
    const meets = [];
    shared.forEach(c => {
      (c.history || []).forEach(h => { if ((h.going || []).includes(pid) && (h.going || []).includes(ME)) meets.push({ c, h, past: true, date: h.date, title: h.title, bk: h, key: `${c.id}:${h.id}`, href: `#/club/${c.id}/book/${h.id}` }); });
      (c.meetings || []).forEach(m => { if ((m.going || []).includes(pid) && (m.going || []).includes(ME)) { const b = bookFor(c, m); meets.push({ c, h: m, past: false, date: m.date, title: b.title, bk: b, key: coverKeyFor(c, m), href: `#/club/${c.id}` }); } });
    });
    meets.sort((a, b) => new Date(b.date) - new Date(a.date));
    const shown = personFilter ? meets.filter(x => x.c.id === personFilter) : meets;
    const first = meets.length ? [...meets].sort((a, b) => new Date(a.date) - new Date(b.date))[0] : null;
    const chip = (id, label, color) => `<button type="button" class="fchip2 ${(personFilter || '') === id ? 'on' : ''}" data-pfilter="${id}" style="--cc:${color}" aria-pressed="${(personFilter || '') === id}">${id ? `<span class="chip-emoji">${clubMarkId(id)}</span>` : ''}${esc(label)}<b>${id ? meets.filter(x => x.c.id === id).length : meets.length}</b></button>`;
    app.innerHTML = `
      <div class="club-top"><a class="back" href="#/">‹ All clubs</a></div>
      <section class="pp-head">
        <div class="pp-av">${avatar({ id: pid, name })}</div>
        <h1>${esc(name)}</h1>
        <p class="pp-sub">${meets.length ? `Together since ${fmtShort(first.date)}` : 'No shared meetings yet'}</p>
      </section>
      <div class="figures">
        <div class="figure"><b>${meets.length}</b><span>Meetings</span></div>
        <div class="figure"><b>${shared.length}</b><span>${shared.length === 1 ? 'Club' : 'Clubs'}</span></div>
        <div class="figure"><b>${new Set(meets.filter(x => x.past).map(x => x.title)).size}</b><span>Books read</span></div>
      </div>
      ${shared.length ? `<div class="filters" role="group" aria-label="Filter by club">${chip('', 'All clubs', '#a9bccd')}${shared.map(c => chip(c.id, c.name, clubColor(c.id))).join('')}</div>` : ''}
      <div class="hk-label">Meetings together</div>
      ${shown.length ? `<div class="wg hk-list">${shown.map(x => `<a class="hk-row hk-row-go pp-row" href="${x.href}" style="--cc:${clubColor(x.c.id)}"><span class="hk-rc">${coverHTML(x.bk, x.key)}</span><span class="hk-rt"><b>${esc(x.title)}</b><span>${esc(x.c.name)}</span><span class="al-meta">${fmtShort(x.date)}${x.past ? '' : ' · Upcoming'}</span></span></a>`).join('')}</div>`
        : `<div class="wg nm-empty"><div class="wg-val">Nothing here yet</div><div class="wg-sub">Meetings you both go to will show up here.</div></div>`}`;
    app.querySelectorAll('[data-pfilter]').forEach(b => b.onclick = () => { personFilter = b.dataset.pfilter || null; personPage(pid); });
    app.querySelectorAll('a.pp-row').forEach(a => a.addEventListener('click', () => markFwd()));
    fetchCovers();
  }

  let statFilter = null;
  function stats() {
    if (statFilter && !byId(statFilter)) statFilter = null;
    const allBooks = readBooks();
    const books = statFilter ? allBooks.filter(b => b.cid === statFilter) : allBooks;
    const wireStars = () => {
  app.querySelectorAll('.stars button').forEach(btn => btn.onclick = () => {
        const b = books.find(x => x.key === btn.dataset.key);
        const r = +btn.dataset.r;
        b.ref.ratings = b.ref.ratings || {};
        if (b.ref.ratings[ME] === r) delete b.ref.ratings[ME]; else b.ref.ratings[ME] = r;
        save(); stats();
      });
    };
    const pages = books.reduce((s, b) => s + b.pages, 0);
    const rated = books.filter(b => b.mine);
    const avg = rated.length ? (rated.reduce((s, b) => s + b.mine, 0) / rated.length).toFixed(1) : '—';
    const max = Math.max(1, ...books.map(b => b.pages));
    const byPages = [...books].sort((a, b) => b.pages - a.pages);

    if (harkUI) {
      app.innerHTML = `
        <section class="club-head club-head-row"><h1>Your stats</h1>${SETTINGS_LINK}</section>
        <div class="filters" role="group" aria-label="Filter by club">${[['', 'All clubs', '#a9bccd'], ...state.clubs.map(c => [c.id, c.name, clubColor(c.id)])].map(([id, label, color]) => `<button type="button" class="fchip2 ${(statFilter || '') === id ? 'on' : ''}" data-sfilter="${id}" style="--cc:${color}" aria-pressed="${(statFilter || '') === id}">${id ? `<span class="chip-emoji">${clubMarkId(id)}</span>` : ''}${esc(label)}</button>`).join('')}</div>
        <div class="figures">
          <div class="figure"><b>${books.length}</b><span>Books</span></div>
          <div class="figure"><b>${pages.toLocaleString()}</b><span>Pages</span></div>
          <div class="figure"><b>${avg}</b><span>Avg. rating</span></div>
        </div>
        <div class="hk-label">Books read</div>
        ${books.length ? `<div class="wg hk-list">${books.map(b => `<div class="hk-row hk-row-go" data-href="#/club/${b.cid}/book/${b.id}" style="--cc:${clubColor(b.cid)}"><a class="hk-rc" href="#/club/${b.cid}/book/${b.id}">${coverHTML(b.ref, `${b.cid}:${b.id}`)}</a><div class="hk-rt"><a class="hk-rl" href="#/club/${b.cid}/book/${b.id}"><b>${esc(b.title)}</b></a><span>${esc(b.author)}</span><span class="cn-s" style="--cc:${clubColor(b.cid)}">${esc(b.club)}</span><div class="stars" role="group" aria-label="Your rating for ${esc(b.title)}">${[1, 2, 3, 4, 5].map(n => `<button data-key="${esc(b.key)}" data-r="${n}" class="${b.mine >= n ? 'on' : ''}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}</div></div></div>`).join('')}</div>` : '<p class="muted-line">Finish a book to see it here.</p>'}`;
      app.querySelectorAll('[data-sfilter]').forEach(b => b.onclick = () => { statFilter = b.dataset.sfilter || null; stats(); });
      wireStars();
      // the whole row opens the meeting; only the stars rate
      app.querySelectorAll('.hk-row-go').forEach(r => r.addEventListener('click', e => { if (e.target.closest('.stars, a')) return; markFwd(); location.hash = r.dataset.href; }));
      return;
    }
    app.innerHTML = `
      <section class="page-head">
        ${SETTINGS_LINK}
        <div class="kicker">Your reading</div>
        <h1>By the numbers</h1>
        
      </section>
      <div class="figures">
        <div class="figure"><b>${books.length}</b><span>Books</span></div>
        <div class="figure"><b>${pages.toLocaleString()}</b><span>Pages</span></div>
        <div class="figure"><b>${avg}</b><span>Avg. rating</span></div>
      </div>


      <div class="sec"><h2>The shelf</h2><span class="kicker">Your ratings · tap to change</span></div>
      <ul class="shelf">
        ${books.map(b => `
          <li class="book">
            <div><h3><a href="#/club/${b.cid}/book/${b.id}">${esc(b.title)}</a></h3><div class="by">${esc(b.author)}</div></div>
            <div class="stars" role="group" aria-label="Rating for ${esc(b.title)}">
              ${[1, 2, 3, 4, 5].map(n => `<button data-key="${esc(b.key)}" data-r="${n}" class="${b.mine >= n ? 'on' : ''}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}
            </div>
            <div class="meta">${esc(b.club)} · ${b.pages} pages · ${fmt(b.finishedAt, { month: 'short', year: 'numeric' })}${b.avg ? ` · Club ★ ${b.avg.toFixed(1)}` : ''}</div>
          </li>`).join('') || '<li class="muted-line">Finish a book to see it here.</li>'}
      </ul>`;

    wireStars();
  }

  /* ---------- new club (page) ---------- */
  const pad = n => String(n).padStart(2, '0');
  const digitsOf = v => String(v).replace(/\D/g, '');
  function normPhone(raw) {
    const d = digitsOf(raw);
    if (d.length < 7 || d.length > 15) return null;
    const phone = String(raw).trim().startsWith('+') ? '+' + d : d.length === 10 ? '+1' + d : d.length === 11 && d[0] === '1' ? '+' + d : '+' + d;
    return { phone, digits: d };
  }
  function fmtPhone(p) {
    const d = digitsOf(p);
    if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    if (d.length === 11 && d[0] === '1') return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
    return '+' + d;
  }
  function smsHref(m, c, meet) {
    const when = meet ? ` We meet ${fmtLong(meet.date)} at ${fmtTime(meet.date)}.` : '';
    const link = location.href.split('#')[0] + (c.inviteCode ? `#/join/${c.inviteCode}` : '');
    const body = `Join ${c.name} on Booked Up. We're reading ${c.book.title}.${when} ${link}${c.inviteCode ? ` (club code ${c.inviteCode})` : ''}`;
    return `sms:${m.phone}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  }
  // time of your most recent meeting, else 7:30 PM
  function defaultTime() {
    const all = [];
    state.clubs.forEach(c => [...(c.meetings || []), ...(c.history || [])].forEach(m => all.push({ d: new Date(m.date), club: c.name })));
    const past = all.filter(x => x.d <= Date.now()).sort((a, b) => b.d - a.d)[0] || all.sort((a, b) => b.d - a.d)[0];
    return past ? { time: `${pad(past.d.getHours())}:${pad(past.d.getMinutes())}`, club: past.club } : { time: '19:30', club: null };
  }
  async function lookupBooks(q) {
    const u = new URLSearchParams({ q, limit: 5, fields: 'title,author_name,number_of_pages_median,cover_i,first_publish_year' });
    const r = await fetch('https://openlibrary.org/search.json?' + u);
    return ((await r.json()).docs) || [];
  }

  function newClub(opts = {}) {
    const dt = defaultTime();
    const soon = new Date(Date.now() + 7 * DAY);
    const dateVal = `${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}`;
    const selected = [];
    let emoji = '📚', themeKey = 0;
    const dirty = { author: false, pages: false };
    let coverId, seq = 0, debounce;

    app.innerHTML = `
      <a class="back" href="#/">‹ Cancel</a>
      <section class="page-head"><div class="kicker">New club</div><h1>Start a club</h1></section>
      <form class="fp" id="nc-form" novalidate>
        <section class="fcard">
          <div class="namerow">
            <button type="button" class="emoji-btn big" id="nc-emoji" aria-label="Pick an emoji for your club">📚</button>
            <label class="fl">Club name<input name="name" maxlength="40" placeholder="e.g. Plot Twist Society"></label>
          </div>
          <p class="fhint">Tap the emoji to pick one for your club.</p>
        </section>

        <section class="fcard">
          <div class="kicker">Club color</div>
          <div class="cs-colors" id="nc-colors" role="group" aria-label="Club color">${[2, 3, 4, 5, 0, 1, 7, 6].map(i => `<button type="button" class="cs-sw ${i === 0 ? 'on' : ''}" data-theme="${i}" style="--sw:${THEME_OPTIONS[i].t[2]}" aria-label="${THEME_OPTIONS[i].name}" aria-pressed="${i === 0}"><span></span><em>${THEME_OPTIONS[i].name}</em></button>`).join('')}</div>
          <p class="fhint">Used for accents across your club's pages. You can change it later in club settings.</p>
        </section>

        <section class="fcard">
          <label class="fl">Book title<span class="tt-wrap"><span class="tt-cover cover" id="tt-cover" hidden></span><input name="title" required autocomplete="off" placeholder="Start typing a title…" aria-label="Book title"></span></label>
          <ul class="suggest" id="suggest" hidden></ul>
          <div class="frow">
            <label class="fl">Author<input name="author" placeholder="Author"></label>
            <label class="fl">Pages<input name="pages" type="number" inputmode="numeric" min="1" max="5000" required placeholder="—"></label>
          </div>
          <p class="fhint" id="book-hint">We'll fill in the author and page count from the title.</p>
        </section>

        <section class="fcard">
          <div class="kicker">When</div>
          <div class="frow">
            <label class="fl">Date<input name="date" type="date" required value="${dateVal}"></label>
            <label class="fl">Time<input name="time" type="time" required value="${dt.time}"></label>
          </div>
          <p class="fhint">${dt.club ? `Same time as your last meeting (${esc(dt.club)}).` : 'Default time: 7:30 PM.'}</p>
          <label class="fl">Where<input name="place" maxlength="60" placeholder="Someone's living room"></label>
          <label class="fl">Address<input data-addr autocomplete="off" name="address" maxlength="120" placeholder="Street, city (opens in Maps)"></label>
        </section>

        <section class="fcard">
          <div class="kicker">On the table <span class="opt">optional</span></div>
          ${tbBlock('who-list')}
          <datalist id="who-list"></datalist>
        </section>

        <section class="fcard">
          <div class="kicker">Invite friends <span class="opt">by phone number</span></div>
          <div id="friends-wrap"></div>
          <div class="frow add-friend">
            <label class="fl">Name<input id="f-name" maxlength="40" placeholder="Optional"></label>
            <label class="fl">Phone<input id="f-phone" type="tel" inputmode="tel" autocomplete="off" placeholder="(555) 123-4567"></label>
          </div>
          <div class="form-actions"><button type="button" class="btn ghost" id="f-add">+ Add friend</button>${'contacts' in navigator && 'ContactsManager' in window ? '<button type="button" class="linkbtn" id="f-pick">Choose from contacts</button>' : ''}</div>
          <p class="fhint" id="f-hint">After you create the club, each friend gets a “Text invite” button that opens Messages with the invite filled in.</p>
        </section>

        <button class="btn big">Create club</button>
      </form>`;

    const form = $('#nc-form');
    tbWire(form, 'who-list');
    $('#nc-emoji').onclick = () => openEmojiPicker(emoji, e => { emoji = e; $('#nc-emoji').textContent = e; });
    form.querySelectorAll('#nc-colors [data-theme]').forEach(b => b.onclick = () => { themeKey = +b.dataset.theme; form.querySelectorAll('#nc-colors [data-theme]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); }); });
    const hint = $('#book-hint');
    const suggest = $('#suggest');
    const f = n => form.elements[n];

    f('author').addEventListener('input', () => { dirty.author = true; });
    f('pages').addEventListener('input', () => { dirty.pages = true; });

    /* book lookup: autofill author + pages */
    const ttCover = $('#tt-cover');
    const showCover = d => {
      if (!d) { ttCover.hidden = true; ttCover.innerHTML = ''; f('title').classList.remove('has-cover'); return; }
      ttCover.innerHTML = `${d.cover_i ? coverImg(d.cover_i, d.title) : ''}<em>${initial(d.title)}</em>`;
      ttCover.hidden = false; f('title').classList.add('has-cover');
    };
    const applyBook = (d, setTitle) => {
      if (setTitle) { f('title').value = d.title; showCover(d); }
      if (d.cover_i) coverId = d.cover_i;
      if (setTitle || !dirty.author) { f('author').value = (d.author_name || [])[0] || ''; dirty.author = false; }
      if ((setTitle || !dirty.pages) && d.number_of_pages_median) { f('pages').value = d.number_of_pages_median; dirty.pages = false; }
      hint.textContent = d.number_of_pages_median ? `Found: ${d.title}${d.author_name ? ' by ' + d.author_name[0] : ''}, ${d.number_of_pages_median} pages. Edit if it's a different edition.` : `Found ${d.title}, but not the page count. Enter it below.`;
    };
    f('title').addEventListener('input', () => {
      clearTimeout(debounce);
      const q = f('title').value.trim();
      coverId = undefined; showCover(null);
      if (q.length < 3) { suggest.hidden = true; return; }
      const mine = ++seq;
      debounce = setTimeout(async () => {
        try {
          const docs = (await lookupBooks(q)).filter(d => d.title);
          if (mine !== seq) return;
          if (!docs.length) { suggest.hidden = true; hint.textContent = "Couldn't find that title. Enter the pages yourself."; return; }
          applyBook(docs[0], false);
          suggest.innerHTML = docs.map((d, i) => `<li><button type="button" data-i="${i}"><span class="sg-cover cover">${d.cover_i ? coverImg(d.cover_i, d.title) : ''}<em>${initial(d.title)}</em></span><span class="sg-text"><b>${esc(d.title)}</b><span>${esc((d.author_name || ['Unknown author'])[0])}${d.number_of_pages_median ? ' · ' + d.number_of_pages_median + ' pages' : ''}${d.first_publish_year ? ' · ' + d.first_publish_year : ''}</span></span></button></li>`).join('');
          suggest.hidden = false;
          suggest.querySelectorAll('li').forEach(li => li.onclick = () => { const b = li.querySelector('button'); applyBook(docs[+b.dataset.i], true); suggest.hidden = true; f('author').focus(); });
        } catch (e) {
          if (mine === seq) hint.textContent = "Can't look up pages right now. Enter them yourself.";
        }
      }, 400);
    });
    f('title').addEventListener('blur', () => setTimeout(() => { suggest.hidden = true; }, 200));

    /* friends */
    const renderFriends = () => {
      $('#friends-wrap').innerHTML = state.friends.length
        ? `<div class="chips">${state.friends.map(fr => `<button type="button" class="fchip ${selected.includes(fr.id) ? 'on' : ''}" data-fid="${fr.id}" aria-pressed="${selected.includes(fr.id)}"><span class="av">${initial(fr.name)}</span><span>${esc(fr.name)}<small>${esc(fmtPhone(fr.phone))}</small></span></button>`).join('')}</div>`
        : '<p class="fhint">No friends yet. Add someone below.</p>';
      $('#friends-wrap').querySelectorAll('[data-fid]').forEach(b => b.onclick = () => {
        const i = selected.indexOf(b.dataset.fid);
        if (i >= 0) selected.splice(i, 1); else selected.push(b.dataset.fid);
        renderFriends();
      });
      $('#who-list').innerHTML = ['You', ...selected.map(id => (state.friends.find(x => x.id === id) || {}).name)].filter(Boolean).map(n => `<option value="${esc(n)}">`).join('');
    };
    const addFriend = (name, raw) => {
      const p = normPhone(raw);
      if (!p) return false;
      let fr = state.friends.find(x => x.digits === p.digits);
      if (!fr) { fr = { id: 'p' + p.digits, name: (name || '').trim() || fmtPhone(p.phone), phone: p.phone, digits: p.digits }; state.friends.push(fr); }
      else if (name && name.trim()) fr.name = name.trim();
      if (!selected.includes(fr.id)) selected.push(fr.id);
      save(); renderFriends();
      return true;
    };
    const doAdd = () => {
      if (addFriend($('#f-name').value, $('#f-phone').value)) { $('#f-name').value = ''; $('#f-phone').value = ''; $('#f-hint').textContent = 'Added. Tap a friend above to remove them from this club.'; }
      else $('#f-hint').textContent = 'Enter a valid phone number (at least 7 digits).';
    };
    $('#f-add').onclick = doAdd;
    $('#f-phone').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
    const pick = $('#f-pick');
    if (pick) pick.onclick = async () => {
      try {
        const cs = await navigator.contacts.select(['name', 'tel'], { multiple: true });
        cs.forEach(c => (c.tel || []).slice(0, 1).forEach(t => addFriend((c.name || [])[0], t)));
      } catch (e) {}
    };
    renderFriends();

    // Return moves to the next box (and selects what is in it) instead of submitting the form
    const fields = () => [...form.querySelectorAll('input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([disabled])')].filter(i => i.offsetParent);
    form.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.target.tagName !== 'INPUT' || e.target.id === 'f-phone') return;
      e.preventDefault();
      const list = fields(), nx = list[list.indexOf(e.target) + 1];
      if (nx) { nx.focus(); try { nx.select(); } catch (err) {} } else e.target.blur();
    });
    fields().forEach(i => { if (i.id !== 'f-phone') i.setAttribute('enterkeyhint', 'next'); });
    form.onsubmit = e => {
      e.preventDefault();
      const title = f('title').value.trim(), pages = +f('pages').value;
      if (!title) { toast('Add a book title'); f('title').focus(); return; }
      if (!pages || pages < 1) { toast('Add the page count'); f('pages').focus(); return; }
      if (!f('date').value || !f('time').value) { toast('Pick a date and time'); return; }
      const tb = tbRead(form);
      if (tb.bad) { toast('Add both a name and a food'); tb.bad.focus(); return; }
      const date = new Date(`${f('date').value}T${f('time').value}`);
      if (isNaN(date)) { toast('Check the date and time'); return; }
      const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const friends = selected.map(fid => state.friends.find(x => x.id === fid)).filter(Boolean).map(fr => ({ id: fr.id, name: fr.name, phone: fr.phone }));
      state.clubs.push({
        id, name: f('name').value.trim() || `${title} Club`,
        book: { title, author: f('author').value.trim() || 'Unknown author', pages, ...(coverId ? { coverId } : {}) },
        meetings: [{ date: date.toISOString(), place: f('place').value.trim() || 'TBD', address: f('address').value.trim(), note: '', going: [ME], out: [], table: tb.table, createdAt: new Date().toISOString() }],
        members: [{ id: ME, name: 'You' }, ...friends],
        history: [], updates: [], quotes: [], notes: [], discussed: [], wishlist: [], upNext: null, suggestions: [], emoji, themeKey, inviteCode: BU.code(),
      });
      save(); updateBadge(); fetchCovers();
      location.hash = `#/club/${id}`;
    };
    if (opts.title) {
      f('title').value = opts.title;
      f('author').value = opts.author || '';
      if (opts.pages) f('pages').value = opts.pages;
      hint.textContent = opts.pages ? `${opts.title}: ${opts.pages} pages. Edit if it's a different edition.` : 'Looking up the page count…';
      if (!opts.pages) f('title').dispatchEvent(new Event('input'));
      coverId = opts.cover ? +opts.cover : undefined;
    } else f('name').focus();
  }

  /* ---------- "add to list" pop-up (pick one or more clubs) ---------- */
  function openAddSheet(book, onDone) {
    if (!state.clubs.length) { toast('Create a club first'); return; }
    const idxIn = c => (c.wishlist || []).findIndex(w => normTitle(w.title) === normTitle(book.title));
    const root = document.createElement('div');
    root.className = 'sheet-backdrop';
    root.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Add ${esc(book.title)} to a list">
        <div class="kicker">Add to list</div>
        <h2>${esc(book.title)}</h2>
        ${book.author ? `<p class="by">${esc(book.author)}</p>` : ''}
        <p class="fhint">Choose one or more clubs.</p>
        <ul class="sheet-list">${state.clubs.map(c => `
          <li><label class="sheet-row">
            <input type="checkbox" value="${c.id}" ${idxIn(c) >= 0 ? 'checked' : ''}>
            <span class="box" aria-hidden="true"></span>
            <span class="sname">${clubMark(c)} ${esc(c.name)}<small>${pluralize((c.wishlist || []).length, 'book')} on the list</small></span>
          </label></li>`).join('')}</ul>
        <div class="form-actions end"><button type="button" class="btn ghost" data-cancel>Cancel</button><button type="button" class="btn" data-done>Done</button></div>
      </div>`;
    document.body.appendChild(root);
    const onKey = e => { if (e.key === 'Escape') close(); };
    const close = () => { document.removeEventListener('keydown', onKey); root.remove(); };
    document.addEventListener('keydown', onKey);
    root.addEventListener('click', e => { if (e.target === root) close(); });
    root.querySelector('[data-cancel]').onclick = close;
    root.querySelector('[data-done]').onclick = () => {
      const added = [], removed = [];
      root.querySelectorAll('input[type=checkbox]').forEach(cb => {
        const c = state.clubs.find(x => x.id === cb.value);
        c.wishlist = c.wishlist || [];
        const i = idxIn(c);
        if (cb.checked && i < 0) {
          c.wishlist.push({ id: 'w' + Date.now() + c.id, title: book.title, author: book.author || 'Unknown author', pages: book.pages || null, coverId: book.cover || undefined, key: book.key || '', addedAt: new Date().toISOString() });
          added.push(c.name);
        } else if (!cb.checked && i >= 0) { c.wishlist.splice(i, 1); removed.push(c.name); }
      });
      if (added.length || removed.length) {
        save();
        if (added.length) fetchCovers();
      }
      close();
      if (onDone) onDone();
    };
    root.querySelector('input').focus();
  }
  app.addEventListener('click', e => {
    const b = e.target.closest('[data-addlist]');
    if (!b) return;
    const d = b.dataset;
    openAddSheet({ title: d.title, author: d.author, pages: +d.pages || 0, cover: +d.cover || 0, key: d.key }, () => {
      const card = b.closest('.bcard');
      if (!card) return;
      const old = card.querySelector('.bflag');
      if (old) old.remove();
      const lists = onLists(d.title);
      if (lists.length) card.querySelector('.bpages').insertAdjacentHTML('afterend', `<div class="bflag">On ${lists.length === 1 ? esc(lists[0].name) + "'s" : 'a'} list</div>`);
    });
  });

  /* ---------- club emoji ---------- */
  const EMOJIS = ['📚', '📖', '🕵️', '🐉', '💌', '🔮', '🌙', '🍷', '🫖', '☕', '🌿', '🌊', '🦋', '🔥', '⭐', '🌸', '🍄', '🧙', '👻', '🚀', '🪐', '🌈', '🍂', '🎭', '🗡️', '🏰', '🐺', '🦉', '🐢', '🎧', '🍕', '🍜', '🥂', '🧶', '🕯️', '✨', '🌹', '🍒', '🎲', '🧩', '🏝️', '🎻', '🌻', '🦊'];
  const firstGrapheme = v => {
    const t = String(v).trim();
    if (!t) return '';
    return (typeof Intl !== 'undefined' && Intl.Segmenter) ? ([...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(t)][0] || {}).segment || '' : [...t][0];
  };
  function openEmojiPicker(current, onPick) {
    const root = document.createElement('div');
    root.className = 'sheet-backdrop';
    root.innerHTML = `
      <div class="sheet emojisheet" role="dialog" aria-modal="true" aria-label="Pick your club's emoji">
        <h2>Pick your club's emoji</h2>
        <div class="egrid">${EMOJIS.map(e => `<button type="button" class="ebtn ${e === current ? 'on' : ''}" data-e="${e}" aria-label="${e}">${e}</button>`).join('')}</div>
        <form class="ecustom" id="ecustom"><input id="e-in" maxlength="8" placeholder="Or type your own" aria-label="Type an emoji"><button class="btn small">Use</button></form>
        <div class="form-actions end"><button type="button" class="btn ghost" data-cancel>Cancel</button></div>
      </div>`;
    document.body.appendChild(root);
    const onKey = e => { if (e.key === 'Escape') close(); };
    const close = () => { document.removeEventListener('keydown', onKey); root.remove(); };
    document.addEventListener('keydown', onKey);
    root.addEventListener('click', e => { if (e.target === root) close(); });
    root.querySelector('[data-cancel]').onclick = close;
    root.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { close(); onPick(b.dataset.e); });
    root.querySelector('#ecustom').onsubmit = e => {
      e.preventDefault();
      const g = firstGrapheme(root.querySelector('#e-in').value);
      if (!g || !/\p{Extended_Pictographic}/u.test(g)) { toast('Type an emoji, like 🦉'); return; }
      close(); onPick(g);
    };
  }

  /* ---------- plan the next meeting (full-screen) ---------- */
  function clubTime(c) {
    if (c.defaults && c.defaults.time) return { time: c.defaults.time, own: true, std: true };
    const ms = [...(c.meetings || []), ...(c.history || [])].map(m => new Date(m.date)).sort((a, b) => b - a);
    return ms.length ? { time: `${pad(ms[0].getHours())}:${pad(ms[0].getMinutes())}`, own: true } : { time: defaultTime().time, own: false };
  }
  function openPlan(c, onDone) {
    const ct = clubTime(c);
    const lastMeeting = [...(c.meetings || [])].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    const base = lastMeeting && new Date(lastMeeting.date) > Date.now() ? new Date(lastMeeting.date) : new Date();
    const d0 = new Date(base.getTime() + 14 * DAY);
    const dateVal = `${d0.getFullYear()}-${pad(d0.getMonth() + 1)}-${pad(d0.getDate())}`;
    let book = c.upNext ? { title: c.upNext.title, author: c.upNext.author, pages: c.upNext.pages, coverId: c.upNext.coverId, key: c.upNext.key || '' } : null;

    const root = document.createElement('div');
    root.className = 'plan';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Plan the next meeting');
    root.innerHTML = `
      <div class="plan-bar"><button type="button" class="linkbtn" data-cancel>Cancel</button><strong>Plan the next meeting</strong><span></span></div>
      <div class="plan-scroll">
        <div id="pl-preview"></div>
        <section class="fcard">
          <div class="kicker">1 · The book</div>
          <button type="button" class="bookpick" id="pl-book"></button>
        </section>
        <section class="fcard">
          <div class="kicker">2 · When</div>
          <div class="frow">
            <label class="fl">Date<input id="pl-date" type="date" required value="${dateVal}"></label>
            <label class="fl">Time<input id="pl-time" type="time" required value="${ct.time}"></label>
          </div>
          <p class="fhint">${ct.std ? 'Your club\'s standard time.' : ct.own ? 'Same time as your last meeting.' : 'Default time: 7:30 PM.'} Two weeks after your latest meeting.</p>
        </section>
        <section class="fcard">
          <div class="kicker">3 · Where</div>
          <label class="fl">Place<input id="pl-place" maxlength="60" placeholder="Someone's living room" value="${esc((c.defaults && c.defaults.place) || (lastMeeting ? lastMeeting.place : ''))}"></label>
          <label class="fl">Address<input data-addr autocomplete="off" id="pl-addr" maxlength="120" placeholder="Street, city (opens in Maps)"></label>
          <label class="fl">A note for the group <span class="opt">optional</span><input id="pl-note" maxlength="80" placeholder="Bring a hot take and a pen"></label>
        </section>
        <section class="fcard">
          <div class="kicker">4 · On the table <span class="opt">optional</span></div>
          ${tbBlock('pl-who-list')}
          <datalist id="pl-who-list">${['You', ...c.members.filter(m => m.id !== ME).map(m => m.name)].map(n => `<option value="${esc(n)}">`).join('')}</datalist>
        </section>
      </div>
      <div class="plan-foot"><button type="button" class="btn big" id="pl-go">Schedule meeting</button></div>`;
    document.body.appendChild(root);
    document.body.style.overflow = 'hidden';
    const onKey = e => { if (e.key === 'Escape' && !document.querySelector('.sheet-backdrop')) close(); };
    const close = () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; root.remove(); };
    document.addEventListener('keydown', onKey);
    root.querySelector('[data-cancel]').onclick = close;
    const $$ = id => root.querySelector('#' + id);
    tbWire(root, 'pl-who-list');

    const when = () => { const d = new Date(`${$$('pl-date').value}T${$$('pl-time').value}`); return isNaN(d) ? null : d; };
    const renderBook = () => {
      $$('pl-book').innerHTML = book
        ? `<span class="thumb">${book.coverId ? coverImg(book.coverId, book.title) : ''}<em>${initial(book.title)}</em></span><span class="bpt"><b>${esc(book.title)}</b><small>${esc(book.author)}${book.pages ? ` · ${book.pages} pages` : ''}</small></span><span class="chev">Change ›</span>`
        : `<span class="thumb empty">+</span><span class="bpt"><b>Choose a book</b><small>From your list, suggestions, recommendations or search</small></span><span class="chev">›</span>`;
    };
    const renderPreview = () => {
      const d = when();
      $$('pl-preview').innerHTML = `
        <section class="poster feature session preview">
          <div class="sband" style="background:${clubGrad(c)}">
            <div class="sline"><span class="sname">${clubMark(c)} ${esc(c.name)}</span><span class="schip">${d ? relDay(d.toISOString()) : 'Pick a date'}</span></div>
            <div class="sdate">${d ? `${fmtLong(d.toISOString())} · ${fmtTime(d.toISOString())}` : 'Date and time'}</div>
            <div class="swhere">${esc($$('pl-place').value.trim() || 'Add a place')}</div>
          </div>
          <div class="sbody"><div class="p-main">
            <div class="p-text"><div class="clabel">Reading</div><h2>${book ? esc(book.title) : 'Pick a book'}</h2><div class="when">${book ? `by ${esc(book.author)}${book.pages ? ` · ${book.pages} pages` : ''}` : 'Your invite preview'}</div></div>
            ${book ? `<span class="cover">${book.coverId ? coverImg(book.coverId, book.title) : ''}<em>${esc(book.title)}</em></span>` : '<span class="cover ghost"><em>?</em></span>'}
          </div></div>
        </section>`;
    };
    $$('pl-book').onclick = () => openPicker(c, () => {}, { select: b => { book = { title: b.title, author: b.author, pages: b.pages, coverId: b.coverId, key: b.key }; renderBook(); renderPreview(); } });
    ['pl-date', 'pl-time', 'pl-place'].forEach(id => $$(id).addEventListener('input', renderPreview));
    renderBook(); renderPreview();

    $$('pl-go').onclick = () => {
      if (!book) { toast('Choose a book first'); $$('pl-book').focus(); return; }
      const d = when();
      if (!d) { toast('Pick a date and time'); return; }
      const tb = tbRead(root);
      if (tb.bad) { toast('Add both a name and a food'); tb.bad.focus(); return; }
      const same = x => normTitle(x.title) === normTitle(book.title);
      c.meetings.push({ date: d.toISOString(), place: $$('pl-place').value.trim() || 'TBD', address: $$('pl-addr').value.trim(), note: $$('pl-note').value.trim(), going: [ME], out: [], table: tb.table, createdAt: new Date().toISOString(), book: { title: book.title, author: book.author || 'Unknown author', pages: book.pages || null, coverId: book.coverId || undefined, key: book.key || '' } });
      c.wishlist = (c.wishlist || []).filter(x => !same(x));
      c.suggestions = (c.suggestions || []).filter(x => !same(x));
      if (c.upNext && same(c.upNext)) c.upNext = null;
      save(); fetchCovers(); close(); confetti(); onDone();
    };
  }

  /* ---------- pick / suggest the next book ---------- */
  function setNextBook(c, b) {
    c.upNext = { title: b.title, author: b.author || 'Unknown author', pages: b.pages || null, coverId: b.coverId || undefined, key: b.key || '', by: ME, at: new Date().toISOString() };
    // keep it in the suggestions: clearing the pick returns it to the list.
    // It only leaves when it becomes the book for a meeting (wrap up / plan).
    const same = x => normTitle(x.title) === normTitle(b.title);
    c.suggestions = c.suggestions || [];
    if (!c.suggestions.some(same)) c.suggestions.push({ id: 's' + Date.now(), title: b.title, author: b.author || 'Unknown author', pages: b.pages || null, coverId: b.coverId || undefined, key: b.key || '', by: ME, votes: [ME] });
    save(); fetchCovers();
  }
  // confetti, only when a book is picked
  function celebrate() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#8fb8e8', '#5ed0d4', '#7fd6a8', '#b0b9e8', '#f0c35a', '#ffffff'];
    for (let i = 0; i < 46; i++) {
      const p = document.createElement('i');
      p.className = 'confetti';
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--d', (1.6 + Math.random() * 1.4).toFixed(2) + 's');
      p.style.setProperty('--dl', (Math.random() * .25).toFixed(2) + 's');
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 3400);
    }
  }

  function openPicker(c, onChange, opts = {}) {
    const root = document.createElement('div');
    root.className = 'sheet-backdrop';
    root.innerHTML = `
      <div class="sheet picker" role="dialog" aria-modal="true" aria-label="Choose the next book">
        <div class="kicker">${esc(c.name)}</div>
        <h2>${opts.suggestOnly ? 'Suggest a book' : opts.select ? 'Choose the book' : 'Choose the next book'}</h2>
        <div class="tabs" role="tablist">
          <button type="button" class="tab2" data-tab="search">Search</button>
          <button type="button" class="tab2 on" data-tab="rec">Recommended</button>
        </div>
        <div id="pk-body"></div>
        <div class="form-actions end"><button type="button" class="btn ghost" data-cancel>Close</button></div>
      </div>`;
    document.body.appendChild(root);
    const onKey = e => { if (e.key === 'Escape') close(); };
    const close = () => { document.removeEventListener('keydown', onKey); root.remove(); };
    document.addEventListener('keydown', onKey);
    root.addEventListener('click', e => { if (e.target === root) close(); });
    root.querySelector('[data-cancel]').onclick = close;

    const body = root.querySelector('#pk-body');
    let items = [], tok = 0;
    const norm = d => ({ title: d.title, author: (d.author_name || [])[0] || d.author || 'Unknown author', pages: d.number_of_pages_median || d.pages || null, coverId: d.cover_i || d.coverId || undefined, key: d.key || '' });
    const suggested = b => (c.suggestions || []).some(s => normTitle(s.title) === normTitle(b.title));
    const listed = b => (c.wishlist || []).some(w => normTitle(w.title) === normTitle(b.title)) && suggested(b);
    const row = (b, i) => `
      <li class="prow">
        <span class="thumb">${b.coverId ? coverImg(b.coverId, b.title) : ''}<em>${initial(b.title)}</em></span>
        <div class="winfo"><div class="wtitle">${esc(b.title)}</div><div class="by">${esc(b.author)}${b.pages ? ` · ${b.pages} pages` : ''}</div></div>
        <div class="sact">${opts.select ? `<button type="button" class="mini-link" data-list="${i}" ${listed(b) ? 'disabled' : ''}>${listed(b) ? '✓ Listed' : '+ List'}</button>` : `<button type="button" class="mini-link" data-list="${i}" ${listed(b) ? 'disabled' : ''}>${listed(b) ? '✓ Listed' : '+ List'}</button>`}${opts.suggestOnly ? '' : `<button type="button" class="btn small" data-choose="${i}">${opts.select ? 'Select' : 'Pick'}</button>`}</div>
      </li>`;
    const show = (list, note, into = body) => {
      items = list;
      into.innerHTML = (note ? `<p class="fhint">${note}</p>` : '') + (list.length ? `<ul class="plist">${list.map(row).join('')}</ul>` : '<p class="muted-line">Nothing to show here yet.</p>');
    };
    body.addEventListener('click', e => {
      const sg = e.target.closest('[data-suggest]'), pk = e.target.closest('[data-choose]'), ls = e.target.closest('[data-list]');
      if (ls && !ls.disabled) {
        const b = items[+ls.dataset.list];
        if (!listed(b)) (c.wishlist = c.wishlist || []).push({ id: 'w' + Date.now(), title: b.title, author: b.author, pages: b.pages || null, coverId: b.coverId, key: b.key || '', addedAt: new Date().toISOString() });
        if (!suggested(b)) (c.suggestions = c.suggestions || []).push({ id: 's' + Date.now(), title: b.title, author: b.author, pages: b.pages, coverId: b.coverId, key: b.key, by: ME, votes: [ME] });
        save(); fetchCovers();
        ls.disabled = true; ls.textContent = '✓ Listed';
 onChange();
      }
      if (sg && !sg.disabled) {
        const b = items[+sg.dataset.suggest];
        (c.suggestions = c.suggestions || []).push({ id: 's' + Date.now(), title: b.title, author: b.author, pages: b.pages, coverId: b.coverId, key: b.key, by: ME, votes: [ME] });
        // a suggested book also joins Our list
        if (!listed(b)) (c.wishlist = c.wishlist || []).push({ id: 'w' + Date.now(), title: b.title, author: b.author, pages: b.pages || null, coverId: b.coverId, key: b.key || '', addedAt: new Date().toISOString() });
        save(); fetchCovers();
        sg.disabled = true; sg.textContent = 'Suggested ✓';
 onChange();
      }
      if (pk) {
        const b = items[+pk.dataset.choose];
        if (opts.select) { close(); opts.select(b); return; }
        setNextBook(c, b); close(); onChange(); confetti();
      }
    });

    async function render(tab) {
      const mine = ++tok;
      if (tab === 'list') {
        const shared = isOpen(c, nextMeeting(c));
        let pool = [...(c.suggestions || [])].filter(x => shared || x.by === ME).sort((x, y) => y.votes.length - x.votes.length).map(x => ({ ...x }));
        if (opts.select && c.upNext) pool = [{ ...c.upNext }, ...pool];
        const seen = new Set();
        const list = pool.filter(b => { const k = normTitle(b.title); if (seen.has(k)) return false; seen.add(k); return true; }).map(w => norm({ ...w }));
        show(list, list.length ? (shared ? 'Your club\'s book suggestions.' : 'Your suggestions. Others see them when the meeting starts.') : '');
        if (!list.length) body.innerHTML = '<p class="muted-line">No suggestions yet. Search for a book and tap + List to add one.</p>';
      } else if (tab === 'rec') {
        body.innerHTML = '<p class="muted-line">Finding books your club might like…</p>';
        try {
          const own = [c.book, ...(c.history || [])];
          await Promise.all(own.map(ensureSubjects));
          const freq = {};
          own.forEach(b => (b.subjects || []).forEach(t => { freq[t] = (freq[t] || 0) + 1; }));
          const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);
          const read = new Set(own.map(b => normTitle(b.title)));
          let docs = [];
          for (const t of top) {
            docs = (await searchBooks(`subject:"${t.toLowerCase()}"`)).filter(d => !read.has(normTitle(d.title)));
            if (docs.length >= 6) break;
          }
          if (mine !== tok) return;
          show(docs.slice(0, 8).map(norm), top.length ? `Based on themes from your past reads: ${esc(top.join(', '))}.` : '');
        } catch (e) { if (mine === tok) body.innerHTML = '<p class="muted-line">Can’t load recommendations right now.</p>'; }
      } else {
        body.innerHTML = `
          <form class="bsearch" id="pk-form" role="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg><input id="pk-q" type="search" placeholder="Search title or author" aria-label="Search books" enterkeyhint="search"></form>
          <div id="pk-res"></div>`;
        const res = body.querySelector('#pk-res');
        body.querySelector('#pk-form').onsubmit = async e => {
          e.preventDefault();
          const q = body.querySelector('#pk-q').value.trim();
          if (!q) return;
          res.innerHTML = '<p class="muted-line">Searching…</p>';
          try { show((await searchBooks(q)).map(norm), '', res); } catch (err) { res.innerHTML = '<p class="muted-line">Can’t search right now.</p>'; }
        };
        // suggest books as you type
        let sTok = 0, sTimer = null;
        const live = async () => {
          const q = body.querySelector('#pk-q').value.trim();
          const my = ++sTok;
          if (q.length < 2) { if (!q) res.innerHTML = ''; return; }
          res.innerHTML = '<p class="muted-line">Searching…</p>';
          try { const docs = (await searchBooks(q)).map(norm); if (my === sTok) show(docs, '', res); } catch (err) { if (my === sTok) res.innerHTML = '<p class="muted-line">Can’t search right now.</p>'; }
        };
        body.querySelector('#pk-q').addEventListener('input', () => { clearTimeout(sTimer); sTimer = setTimeout(live, 280); });
        body.querySelector('#pk-form').addEventListener('submit', () => { clearTimeout(sTimer); sTok++; });
        body.querySelector('#pk-q').focus();
      }
    }
    root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
      root.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b));
      render(b.dataset.tab);
    });
    const start = opts.startTab === 'search' ? 'search' : 'rec';
    root.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x.dataset.tab === start));
    render(start);
  }

  /* ---------- browse ---------- */
  const SHELVES = [['Popular', 'subject:fiction'], ['Mystery', 'subject:mystery'], ['Fantasy', 'subject:fantasy'], ['Sci-fi', 'subject:science_fiction'], ['Historical', 'subject:historical_fiction'], ['Romance', 'subject:romance'], ['Classics', 'subject:classics'], ['Nonfiction', 'subject:nonfiction']];
  const PICKS = [['Piranesi', 'Susanna Clarke'], ['Circe', 'Madeline Miller'], ['Rebecca', 'Daphne du Maurier'], ['The Secret History', 'Donna Tartt'], ["Giovanni's Room", 'James Baldwin'], ['Normal People', 'Sally Rooney'], ['Gone Girl', 'Gillian Flynn'], ['The Thursday Murder Club', 'Richard Osman']];
  const browseState = { shelf: 0, q: '' };
  const browseCache = {};
  const normTitle = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const OL = 'https://openlibrary.org';
  const FIELDS = 'key,title,author_name,cover_i,number_of_pages_median,first_publish_year,ratings_average,ratings_count';

  async function searchBooks(query) {
    const u = new URLSearchParams({ q: query, limit: 20, fields: FIELDS, language: 'eng' });
    if (query.startsWith('subject:')) u.set('sort', 'rating');
    const r = await fetch(`${OL}/search.json?` + u);
    const docs = ((await r.json()).docs || []).filter(d => d.title);
    return docs.sort((a, b) => !!b.cover_i - !!a.cover_i).slice(0, 18);
  }
  function bookParams(b) {
    const p = new URLSearchParams({ title: b.title });
    if (b.author) p.set('author', b.author);
    if (b.pages) p.set('pages', b.pages);
    if (b.cover) p.set('cover', b.cover);
    if (b.key) p.set('key', b.key);
    if (b.year) p.set('year', b.year);
    if (b.rating) { p.set('rating', b.rating); p.set('rcount', b.rcount || 0); }
    return p;
  }
  const wishParams = w => bookParams({ title: w.title, author: w.author, pages: w.pages, cover: w.coverId, key: w.key });
  const onLists = title => state.clubs.filter(c => (c.wishlist || []).some(w => normTitle(w.title) === normTitle(title)));
  function bookCard(d) {
    const au = (d.author_name || [])[0] || '';
    const base = { title: d.title, author: au, pages: d.number_of_pages_median, cover: d.cover_i };
    const detail = bookParams({ ...base, key: d.key, year: d.first_publish_year, rating: d.ratings_average ? d.ratings_average.toFixed(2) : '', rcount: d.ratings_count });
    const lists = onLists(d.title);
    return `<li class="bcard">
      <a class="bcover" href="#/browse/book?${detail}" aria-label="Details for ${esc(d.title)}">${d.cover_i ? coverImg(d.cover_i, d.title) : ''}<em>${esc(d.title)}</em></a>
      <a class="btitle" href="#/browse/book?${detail}">${esc(d.title)}</a>
      <div class="bauthor">${esc(au || 'Unknown author')}</div>
      ${d.ratings_average ? `<div class="brate">${ratingLine(d.ratings_average, 0)}</div>` : ''}
      <div class="bpages">${d.number_of_pages_median ? `${d.number_of_pages_median} pages` : ''}</div>
      ${lists.length ? `<div class="bflag">On ${lists.length === 1 ? esc(lists[0].name) + "'s" : 'a'} list</div>` : ''}
      <button type="button" class="mini-link" data-addlist data-title="${esc(d.title)}" data-author="${esc(au)}" data-pages="${d.number_of_pages_median || ''}" data-cover="${d.cover_i || ''}" data-key="${esc(d.key || '')}">Add to list</button>
    </li>`;
  }
  function browse() {
    const bs = browseState;
    app.innerHTML = `
      <section class="page-head"><div class="kicker">Discover</div><h1>Browse</h1></section>
      <form class="bsearch" id="bsearch" role="search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>
        <input id="bq" type="search" placeholder="Search title, author or subject" value="${esc(bs.q)}" aria-label="Search books" enterkeyhint="search">
      </form>
      <div class="shelves">${SHELVES.map(([n], i) => `<button type="button" class="shelf-chip ${!bs.q && bs.shelf === i ? 'on' : ''}" data-shelf="${i}">${n}</button>`).join('')}</div>
      <div id="bresults"></div>`;
    const out = $('#bresults');
    const show = (docs, note) => {
      out.innerHTML = (note ? `<p class="muted-line">${note}</p>` : '') + (docs.length ? `<ul class="bgrid">${docs.map(bookCard).join('')}</ul>` : '<p class="muted-line">No matches. Try another search.</p>');
    };
    let token = 0;
    const load = async () => {
      const query = bs.q || SHELVES[bs.shelf][1];
      if (browseCache[query]) { show(browseCache[query]); return; }
      const mine = ++token;
      out.innerHTML = '<p class="muted-line">Loading…</p>';
      try {
        const docs = await searchBooks(query);
        browseCache[query] = docs;
        if (mine === token) show(docs);
      } catch (e) {
        if (mine === token) show(PICKS.map(([title, a]) => ({ title, author_name: [a] })), 'Can’t reach the library right now. Here are some club favorites.');
      }
    };
    $('#bsearch').onsubmit = e => { e.preventDefault(); bs.q = $('#bq').value.trim(); browse(); };
    // results update as you type, without redrawing the page (so the keyboard stays open)
    let bTimer = null;
    $('#bq').addEventListener('input', e => {
      clearTimeout(bTimer);
      bTimer = setTimeout(() => {
        const v = e.target.value.trim();
        if (v.length === 1) return;
        bs.q = v;
        app.querySelectorAll('[data-shelf]').forEach(s => s.classList.toggle('on', !v && +s.dataset.shelf === bs.shelf));
        load();
      }, 300);
    });
    app.querySelectorAll('[data-shelf]').forEach(b => b.onclick = () => { bs.shelf = +b.dataset.shelf; bs.q = ''; browse(); });
    load();
  }

  /* ---------- book detail ---------- */
  const NOISE = /(accessible|protected daisy|in library|large type|large print|reading level|nyt|new york times|open library|lending|overdrive|internet archive|translation|^fiction$|^general$|juvenile|textbook|^english|^american|^british|specimen|bestseller|award|^reading |^books and)/i;
  function cleanSubjects(list) {
    const out = [], seen = new Set();
    (list || []).forEach(raw => {
      const t = String(raw).trim(), k = t.toLowerCase();
      if (!t || t.length > 32 || /[,:;()\d]|--/.test(t) || t.split(/\s+/).length > 3 || NOISE.test(t) || seen.has(k)) return;
      seen.add(k);
      out.push(t.charAt(0).toUpperCase() + t.slice(1));
    });
    return out;
  }
  const STOP = new Set(['fiction', 'novel', 'novels', 'stories', 'story', 'general', 'literature', 'books', 'with', 'from', 'that', 'this', 'their']);
  const themeWords = list => new Set(list.flatMap(t => t.toLowerCase().split(/[^a-z]+/)).filter(w => w.length >= 4 && !STOP.has(w)));
  function cleanDescription(raw) {
    let t = String(raw || '');
    t = t.split(/\r?\n-{3,}|\r?\n\r?\n\*\*|Also contained in|\n\[\d+\]:/)[0];
    t = t.replace(/\(\[[^\]]*\]\[\d+\]\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\[\d+\]/g, '$1').replace(/<[^>]+>/g, '').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
    if (t.length > 420) {
      const cut = t.slice(0, 420);
      const i = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
      t = i > 120 ? cut.slice(0, i + 1) : cut.replace(/\s+\S*$/, '') + '…';
    }
    return t;
  }
  async function fetchWork(book) {
    let key = book.key, subjects = [], pages = 0, year = '';
    if (!key) {
      const q = new URLSearchParams({ title: book.title, author: book.author, limit: 1, fields: 'key,subject,number_of_pages_median,first_publish_year' });
      const d = ((await (await fetch(`${OL}/search.json?` + q)).json()).docs || [])[0];
      if (d) { key = d.key; subjects = d.subject || []; pages = d.number_of_pages_median || 0; year = d.first_publish_year || ''; }
    }
    let description = '';
    if (key) {
      const w = await (await fetch(`${OL}${key}.json`)).json();
      description = cleanDescription(typeof w.description === 'string' ? w.description : (w.description || {}).value);
      if (w.subjects && w.subjects.length) subjects = w.subjects;
    }
    return { description, subjects, pages, year };
  }
  // themes of a book your club has read (cached on the book)
  async function ensureSubjects(b) {
    if (Array.isArray(b.subjects)) return b.subjects;
    try {
      const q = new URLSearchParams({ title: b.title, author: b.author, limit: 1, fields: 'subject' });
      const d = ((await (await fetch(`${OL}/search.json?` + q)).json()).docs || [])[0];
      b.subjects = cleanSubjects((d && d.subject) || []).slice(0, 15);
      save();
    } catch (e) { return []; }
    return b.subjects;
  }

  const pagesHTML = n => n ? `<b>${n}</b> pages` : 'Page count not listed';
  let detailToken = 0;
  function bookDetail(p) {
    const tok = ++detailToken;
    const alive = () => tok === detailToken && location.hash.startsWith('#/browse/book');
    const book = { key: p.key || '', title: p.title || 'Untitled', author: p.author || 'Unknown author', pages: +p.pages || 0, cover: +p.cover || 0, year: p.year || '' };

    app.innerHTML = `
      <a class="back" href="#/browse">‹ Browse</a>
      <section class="poster feature">
        <span class="chip" id="bk-chip">${book.year ? `First published ${esc(book.year)}` : 'Book'}</span>
        <div class="p-main">
          <div class="p-text">
            <h2>${esc(book.title)}</h2>
            <div class="when">by ${esc(book.author)}</div>
            ${p.rating ? `<div class="brate">${ratingLine(p.rating, p.rcount)}</div>` : ''}
            <div class="bk-pages" id="bk-pages">${pagesHTML(book.pages)}</div>
          </div>
          <span class="cover">${book.cover ? coverImg(book.cover, book.title) : ''}<em>${esc(book.title)}</em></span>
        </div>
      </section>

      <div class="sec"><h2>Add to a reading list</h2></div>
      <div id="listpick"></div>

      <div class="sec"><h2>About this book</h2></div>
      <div id="about" class="about"><p class="muted-line">Loading…</p></div>

      <div class="sec"><h2>Similar to</h2></div>
      <div id="similar"><p class="muted-line">Looking for matches…</p></div>

      <div class="sec"><h2>You might also like</h2></div>
      <div id="suggested"><p class="muted-line">Loading…</p></div>`;

    const renderList = () => {
      const el = $('#listpick');
      if (!el) return;
      el.innerHTML = state.clubs.length ? `<ul class="panel pick">${state.clubs.map(c => {
        const on = (c.wishlist || []).some(w => normTitle(w.title) === normTitle(book.title));
        return `<li class="lp-row"><span><b>${clubMark(c)} ${esc(c.name)}</b><small>${pluralize((c.wishlist || []).length, 'book')} on the list</small></span><button type="button" class="lp-btn ${on ? 'on' : ''}" data-club="${c.id}" aria-pressed="${on}">${on ? '✓ On the list' : '+ Add to list'}</button></li>`;
      }).join('')}</ul>` : '<p class="muted-line">Create a club first to keep a reading list.</p>';
      el.querySelectorAll('[data-club]').forEach(b => b.onclick = () => {
        const c = state.clubs.find(x => x.id === b.dataset.club);
        c.wishlist = c.wishlist || [];
        const i = c.wishlist.findIndex(w => normTitle(w.title) === normTitle(book.title));
        if (i >= 0) { c.wishlist.splice(i, 1); }
        else {
          c.wishlist.push({ id: 'w' + Date.now(), title: book.title, author: book.author, pages: book.pages || null, coverId: book.cover || undefined, key: book.key || '', addedAt: new Date().toISOString() });

          fetchCovers();
        }
        save(); renderList();
      });
    };
    renderList();

    (async () => {
      let info = { description: '', subjects: [], pages: 0, year: '' };
      try { info = await fetchWork(book); } catch (e) { /* offline */ }
      if (!alive()) return;
      if (info.pages && !book.pages) { book.pages = info.pages; $('#bk-pages').innerHTML = pagesHTML(info.pages); }
      if (info.year && !book.year) { book.year = info.year; $('#bk-chip').textContent = `First published ${info.year}`; }
      const themes = cleanSubjects(info.subjects);
      $('#about').innerHTML = (info.description ? `<p>${esc(info.description)}</p>` : '<p class="muted-line">No description is available for this book yet.</p>')
        + (themes.length ? `<div class="kicker" style="margin:18px 0 8px">Major themes</div><div class="tchips">${themes.slice(0, 6).map(t => `<span class="tchip">${esc(t)}</span>`).join('')}</div>` : '');

      // similar to books your clubs have read
      const mine = [];
      state.clubs.forEach(c => {
        mine.push({ b: c.book, club: c.name, href: `#/club/${c.id}`, tag: 'reading now' });
        (c.history || []).forEach(h => mine.push({ b: h, club: c.name, href: `#/club/${c.id}/book/${h.id}`, tag: 'read' }));
      });
      await Promise.all(mine.map(m => ensureSubjects(m.b)));
      if (!alive()) return;
      const words = themeWords(themes);
      const matches = mine
        .filter(m => normTitle(m.b.title) !== normTitle(book.title))
        .map(m => ({ m, shared: (m.b.subjects || []).filter(t => [...themeWords([t])].some(w => words.has(w))) }))
        .filter(x => x.shared.length)
        .sort((a, b) => b.shared.length - a.shared.length)
        .slice(0, 3);
      $('#similar').innerHTML = matches.length
        ? `<ul class="panel sim">${matches.map(({ m, shared }) => `<li><a class="sim-row" href="${m.href}"><div class="kicker">${esc(m.club)} · ${m.tag}</div><div class="sim-title">${esc(m.b.title)}</div><div class="by">Shared themes: ${esc(shared.slice(0, 3).join(', '))}</div></a></li>`).join('')}</ul>`
        : `<p class="muted-line">${themes.length ? 'None of your clubs’ reads share much with this one yet.' : 'We need themes for this book to compare it.'}</p>`;

      // suggestions
      const read = new Set(mine.map(m => normTitle(m.b.title)));
      let sugg = [];
      const queries = [...themes.slice(0, 2).map(t => `subject:"${t.toLowerCase()}"`), ...(book.author !== 'Unknown author' ? [`author:"${book.author}"`] : [])];
      for (const q of queries) {
        try { sugg = (await searchBooks(q)).filter(d => normTitle(d.title) !== normTitle(book.title) && !read.has(normTitle(d.title))); } catch (e) { break; }
        if (!alive()) return;
        if (sugg.length >= 4) break;
      }
      $('#suggested').innerHTML = sugg.length ? `<ul class="bgrid">${sugg.slice(0, 6).map(bookCard).join('')}</ul>` : '<p class="muted-line">No suggestions right now.</p>';
    })();
  }

  /* ---------- chrome ---------- */
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('show'), 2000);
  }
  function confetti() { /* motion removed: no falling confetti */ }
  function updateBadge() {
    const n = unreadCount(), b = $('#badge');
    b.textContent = n > 9 ? '9+' : n;
    b.hidden = !n;
  }

  /* ---------- router ---------- */
  const navStack = [];
  let navFwd = false; // set when the user taps a link, so a forward move is never mistaken for going back
  const markFwd = () => { navFwd = true; setTimeout(() => { navFwd = false; }, 500); };
  document.addEventListener('click', e => { if (e.target.closest('a[href^="#"]')) markFwd(); }, true);
  function trackNav() {
    const h = location.hash || '#/';
    if (navFwd) { navFwd = false; if (navStack[navStack.length - 1] !== h) navStack.push(h); return; }
    if (navStack.length >= 2 && navStack[navStack.length - 2] === h) navStack.pop();
    else if (navStack[navStack.length - 1] !== h) navStack.push(h);
  }
  // back links return to the page you came from
  document.addEventListener('click', e => {
    const a = e.target.closest('a.back, a.clubbar');
    if (!a || a.classList.contains('hist-link') || navStack.length < 2) return;
    e.preventDefault(); navFwd = false; history.back();
  }, true);
  // back links name the page they return to
  function backLabel(h) {
    const path = (h || '#/').replace(/^#\/?/, '').split('?')[0];
    if (!path) return 'All clubs';
    if (path === 'notifications') return 'Alerts';
    if (path === 'stats') return 'Stats';
    if (path === 'settings') return 'Settings';
    if (path === 'calendar') return 'Calendar';
    if (path === 'browse') return 'Browse';
    if (path === 'browse/book') return 'Book';
    if (path === 'new') return 'New club';
    if (/^person\/[^/]+$/.test(path)) { const pid = decodeURIComponent(path.split('/')[1]); return personName(pid); }
    const m = path.match(/^club\/([^/]+)(?:\/(history|meeting|discussion|next|settings|chat|live)|\/book\/([^/]+))?$/);
    if (m) {
      const c = byId(m[1]);
      if (!c) return null;
      if (m[2] === 'history') return 'Previous meetings';
      if (m[2] === 'live') return 'Meeting';
      if (m[2] === 'settings') return 'Settings';
      if (m[2] === 'discussion') return 'Discussion';
      if (m[2] === 'next') return 'Suggestions';
      if (m[3]) { const b = (c.history || []).find(x => x.id === m[3]); return b ? b.title : c.name; }
      return c.name;
    }
    return null;
  }
  function applyBackLabels() {
    if (navStack.length < 2) return;
    const label = backLabel(navStack[navStack.length - 2]);
    if (!label) return;
    app.querySelectorAll('a.back:not(.hist-link)').forEach(a => { a.textContent = '‹ ' + label; });
    app.querySelectorAll('a.clubbar .cb-back').forEach(s => { s.textContent = '‹ ' + label; s.classList.add('cb-back-t'); });
  }
  new MutationObserver(applyBackLabels).observe(app, { childList: true });
  function route(keepUI) {
    trackNav();
    if (!keepUI) ui = { table: false, dq: 'all', qall: false, mtab: 'details' };
    const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
    let tab = 'home';
    const cm = path.match(/^club\/([^/]+)(?:\/(meeting|discussion|next|history|settings|chat|live)|\/book\/([^/]+))?$/);
    if (cm) {
      if (cm[3]) pastBook(cm[1], cm[3]);
      else if (cm[2] === 'meeting') club(cm[1]);
      else if (cm[2] === 'discussion') discussionPage(cm[1]);
      else if (cm[2] === 'next') nextBookPage(cm[1]);
      else if (cm[2] === 'history') clubHistory(cm[1]);
      else if (cm[2] === 'settings') clubSettings(cm[1]);
      else if (cm[2] === 'chat') { ui.mtab = 'chat'; club(cm[1]); }
      else if (cm[2] === 'live') { const lc = byId(cm[1]), lm = lc && nextMeeting(lc); if (lc && lm && isOpen(lc, lm)) { ui.mtab = 'meeting'; meetingPage(cm[1], true, true); } else location.hash = `#/club/${cm[1]}`; }
      else club(cm[1]);
    }
    else if (/^person\/[^/]+$/.test(path)) personPage(decodeURIComponent(path.split('/')[1]));
    else if (path === 'calendar') { tab = 'calendar'; calendar(); }
    else if (path === 'notifications') { tab = 'notifications'; notifications(); }
    else if (path === 'stats') { tab = 'stats'; stats(); }
    else if (path === 'settings') { tab = 'stats'; settingsPage(); }
    else if (path === 'browse/book') { tab = 'browse'; bookDetail(Object.fromEntries(new URLSearchParams(qs || ''))); }
    else if (path === 'browse') { tab = 'browse'; browse(); }
    else if (path === 'new') newClub(Object.fromEntries(new URLSearchParams(qs || '')));
    else home();
    document.body.classList.toggle('club-ctx', /^club\//.test(path));
    document.body.classList.toggle('hist-ctx', /^club\/[^/]+\/history$/.test(path));
    const cm2 = path.match(/^club\/([^/]+)/);
    clubTheme(cm2 ? cm2[1] : '').forEach((v, i) => document.documentElement.style.setProperty('--k' + i, v));
    { const oc = cm2 && byId(cm2[1]); document.documentElement.style.setProperty('--ac', oc && THEME_OPTIONS[oc.themeKey] ? THEME_OPTIONS[oc.themeKey].t[2] : '#1f7f7c'); }
    document.querySelectorAll('.tab').forEach(a => {
      if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    updateBadge();
    scrollTo(0, 0);
  }

  // swipe a bottom sheet down from its top to dismiss it
  new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
    if (!(n instanceof HTMLElement) || !n.classList.contains('sheet-backdrop') || n._swipe) return;
    n._swipe = true;
    const sheet = n.querySelector('.sheet'); if (!sheet) return;
    let y0 = null, dy = 0, t0 = 0;
    sheet.addEventListener('touchstart', e => { const r = sheet.getBoundingClientRect(), y = e.touches[0].clientY; if (y - r.top > 120) { y0 = null; return; } y0 = y; dy = 0; t0 = Date.now(); sheet.style.transition = 'none'; }, { passive: true });
    sheet.addEventListener('touchmove', e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sheet.style.transform = `translateY(${dy}px)`; n.style.background = `rgba(10, 30, 30, ${Math.max(0, .45 - dy / 900)})`; if (dy > 0 && e.cancelable) e.preventDefault(); }, { passive: false });
    const end = () => { if (y0 == null) return; const fast = dy / Math.max(1, Date.now() - t0) > .5; y0 = null; sheet.style.transition = 'transform .22s ease-out'; if (dy > 100 || (fast && dy > 40)) { sheet.style.transform = 'translateY(105%)'; setTimeout(() => n.click(), 180); } else { sheet.style.transform = ''; n.style.background = ''; } };
    sheet.addEventListener('touchend', end); sheet.addEventListener('touchcancel', end);
  })) ).observe(document.body, { childList: true });
  // keep sheets inside the visible area when the keyboard opens (iOS moves the visual viewport)
  const fitSheets = () => {
    const vv = window.visualViewport, bds = document.querySelectorAll('.sheet-backdrop');
    document.body.classList.toggle('sheet-open', bds.length > 0);
    bds.forEach(b => {
      b.style.setProperty('--vvt', (vv ? vv.offsetTop : 0) + 'px');
      b.style.setProperty('--vvh', (vv ? vv.height : window.innerHeight) + 'px');
    });
  };
  if (window.visualViewport) { visualViewport.addEventListener('resize', fitSheets); visualViewport.addEventListener('scroll', fitSheets); }
  addEventListener('focusin', e => { if (e.target.closest && e.target.closest('.sheet')) { fitSheets(); setTimeout(fitSheets, 120); setTimeout(fitSheets, 400); } });
  new MutationObserver(fitSheets).observe(document.body, { childList: true });
  // no pinch or double-tap zoom
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(t => document.addEventListener(t, e => e.preventDefault()));
  addEventListener('hashchange', route);
  const applyUI = () => {
    document.body.classList.toggle('ui-book', bookUI);
    document.body.classList.toggle('ui-hark', harkUI);
    document.body.classList.toggle('ui-main', mainUI);
    document.body.classList.toggle('th-2', theme === 2);
    const wm = $('.wordmark'); if (wm) wm.innerHTML = (mainUI || harkUI) ? cutout('Booked Up') : 'Booked Up';
  };
  { const t = $('#ui-toggle'), th = $('#theme-toggle'); if (t) t.remove(); if (th) th.remove(); }
  { const jm = location.hash.match(/^#\/join\/([A-Za-z0-9]+)/); if (jm) { try { sessionStorage.setItem('bu_join', jm[1]); } catch (e) {} } }
  // opening the app always starts on the clubs home page
  if (location.hash && location.hash !== '#/' && location.hash !== '#') history.replaceState(null, '', location.pathname + location.search + '#/');
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > 5 * 60 * 1000 && location.hash && location.hash !== '#/') { location.hash = '#/'; }
    hiddenAt = 0;
  });
  addEventListener('pageshow', e => { if (e.persisted && location.hash && location.hash !== '#/') location.hash = '#/'; });

  /* ---------- first-time welcome: name, phone, icon ---------- */
  function welcome() {
    const pr = state.profile = state.profile || { name: '', email: '', phone: '', color: '', photo: '' };
    if (pr.onboarded) return;
    const root = document.createElement('div');
    root.className = 'welcome';
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Welcome to Booked Up');
    root.innerHTML = `
      <form class="wl-card" id="wl-form" novalidate>
        <div class="wordmark wl-mark">${cutout('Booked Up')}</div>
        <h1>Welcome</h1>
        <p class="wl-deck">Tell your clubs who you are.</p>
        <div class="st-avatar wl-av" id="wl-av"></div>
        <div class="st-swatches" id="wl-sw" role="group" aria-label="Icon color">${PROFILE_COLORS.map(c => `<button type="button" class="st-sw" data-color="${c}" style="background:${c || 'conic-gradient(#8fb8e8, #7fd6a8, #f0c35a, #f0a1a1, #b0b9e8, #8fb8e8)'}" aria-label="${c ? 'Color ' + c : 'Default color'}"></button>`).join('')}</div>
        <div class="st-photo"><label class="mini-link st-up">Choose a photo<input type="file" id="wl-file" accept="image/*" hidden></label><button type="button" class="mini-link" id="wl-rm" hidden>Remove photo</button></div>
        <label class="fl">Your name<input name="name" maxlength="40" autocomplete="name" placeholder="Visible to your clubs"></label>
        <label class="fl">Phone number<input type="tel" name="phone" inputmode="tel" autocomplete="tel" placeholder="(555) 123-4567"></label>
        <p class="wl-err" id="wl-err" role="alert" hidden></p>
        <button class="btn big" type="submit">Get started</button>
      </form>`;
    document.body.appendChild(root);
    document.body.style.overflow = 'hidden';
    const f = root.querySelector('#wl-form'), err = root.querySelector('#wl-err');
    const paint = () => {
      const av = root.querySelector('#wl-av'), nm = f.elements.name.value.trim();
      av.style.cssText = pr.photo ? `background:url('${pr.photo}') center/cover` : `background:${pr.color || avColor(ME)};${pr.color ? '' : 'color:#1f2328'}`;
      av.textContent = pr.photo ? '' : initial(nm || 'You');
      av.toggleAttribute('data-default', !pr.photo && !pr.color); err.hidden = true;
      root.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('on', !pr.photo && b.dataset.color === (pr.color || '')));
      root.querySelector('#wl-rm').hidden = !pr.photo;
    };
    f.elements.name.addEventListener('input', paint);
    root.querySelectorAll('[data-color]').forEach(b => b.onclick = () => { pr.color = b.dataset.color; pr.photo = ''; paint(); });
    root.querySelector('#wl-rm').onclick = () => { pr.photo = ''; paint(); };
    root.querySelector('#wl-file').onchange = e => {
      const file = e.target.files && e.target.files[0]; if (!file) return;
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const sz = 192, cv = document.createElement('canvas'); cv.width = cv.height = sz;
        const m = Math.min(img.width, img.height);
        cv.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, sz, sz);
        pr.photo = cv.toDataURL('image/jpeg', .85); URL.revokeObjectURL(url); paint();
      };
      img.onerror = () => { URL.revokeObjectURL(url); err.textContent = 'Could not read that image'; err.hidden = false; };
      img.src = url;
    };
    f.onsubmit = e => {
      e.preventDefault();
      const name = f.elements.name.value.trim(), phone = f.elements.phone.value.trim();
      if (!name) { err.textContent = 'Add your name'; err.hidden = false; f.elements.name.focus(); return; }
      if (!phone || phone.replace(/\D/g, '').length < 7) { err.textContent = 'Add a valid phone number'; err.hidden = false; f.elements.phone.focus(); return; }
      pr.name = name; pr.phone = phone; pr.onboarded = true;
      save(); document.body.style.overflow = ''; root.remove(); updateBadge(); route();
    };
    paint();
    setTimeout(() => { try { f.elements.name.focus(); } catch (e) {} }, 50);
  }

  /* ---------- backend: accounts and shared clubs (Supabase) ---------- */
  // Each club is one shared document. Saves are merged with whatever someone else saved first (see sync.js).
  let sb = null, uid = null, authEmail = '';
  let bases = {};            // the last version of each club that matched the server
  const known = new Set();   // clubs that exist on the server
  const wrapListeners = new Set();
  let queue = Promise.resolve(), pushTimer = null, lastProfile = '';
  const run = fn => (queue = queue.then(fn, fn));
  const toRemote = c => { const d = BU.swap(BU.clone(c), ME, uid); (d.members || []).forEach(m => { if (m.id === uid) m.name = myName() || (state.profile && state.profile.name) || m.name; }); return d; };
  const fromRemote = d => BU.swap(BU.clone(d), uid, ME);
  const saveBases = () => { try { localStorage.setItem('booked_up_b_' + uid, JSON.stringify(bases)); } catch (e) {} };
  const writeCache = () => { try { localStorage.setItem(storeKey, JSON.stringify(state)); } catch (e) {} };
  const emptyState = () => migrate({ clubs: [] });
  const ensureIds = c => { (c.meetings || []).forEach(m => { m.id = m.id || 'm' + Math.random().toString(36).slice(2, 9); }); c.inviteCode = c.inviteCode || BU.code(); };

  function afterSave() {
    if (!BACKEND || !uid) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => run(pushAll), 500);
  }

  // redraw the page after a change from someone else, unless you are in the middle of typing
  function refreshView(force) {
    wrapListeners.forEach(f => f());
    const busy = document.querySelector('.sheet-backdrop, .plan, .welcome') || (document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName));
    if (busy && !force) return;
    const y = window.scrollY; route(true); window.scrollTo(0, y); updateBadge();
  }

  async function pushProfile() {
    const pr = state.profile || {};
    const row = { id: uid, name: pr.name || '', email: authEmail, phone: pr.phone || '', color: pr.color || '', photo: pr.photo || '' };
    const j = JSON.stringify(row);
    if (j === lastProfile) return;
    const { error } = await sb.from('profiles').upsert(row);
    if (!error) lastProfile = j;
  }

  async function createRemote(c) {
    ensureIds(c);
    const doc = toRemote(c);
    let r1 = await sb.from('clubs').insert({ id: c.id, name: c.name, invite_code: c.inviteCode, owner: uid });
    if (r1.error) throw r1.error;
    r1 = await sb.from('members').insert({ club_id: c.id, user_id: uid });
    if (r1.error) throw r1.error;
    r1 = await sb.from('club_docs').insert({ club_id: c.id, doc, rev: 1 });
    if (r1.error) throw r1.error;
    bases[c.id] = doc; known.add(c.id); saveBases();
  }

  // bring one club in line with the server: merge, then save the merged version if it changed
  async function syncClub(cid, row) {
    let changed = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (!row || attempt) {
        const r1 = await sb.from('club_docs').select('club_id,doc,rev').eq('club_id', cid).maybeSingle();
        if (r1.error) throw r1.error;
        row = r1.data;
      }
      if (!row) return changed;
      const c = byId(cid);
      if (c) ensureIds(c);
      const local = c ? toRemote(c) : undefined;
      const merged = c ? BU.merge3(bases[cid], local, row.doc) : row.doc;
      if (!BU.eq(merged, row.doc)) {
        const up = await sb.from('club_docs').update({ doc: merged, rev: row.rev + 1, updated_at: new Date().toISOString() }).eq('club_id', cid).eq('rev', row.rev).select('rev');
        if (up.error) throw up.error;
        if (!up.data || !up.data.length) { row = null; continue; }   // someone saved in between: fetch and merge again
      }
      bases[cid] = merged; known.add(cid); saveBases();
      const next = fromRemote(merged);
      if (!c) { state.clubs.push(next); changed = true; }
      else if (!BU.eq(next, c)) { Object.keys(c).forEach(k => delete c[k]); Object.assign(c, next); changed = true; }   // update in place so open screens keep working
      if (changed) writeCache();
      return changed;
    }
    return changed;
  }

  // who is in each club, and their names, colors and photos
  async function loadPeople(ids) {
    if (!ids.length) return;
    const mem = await sb.from('members').select('club_id,user_id').in('club_id', ids);
    if (mem.error) return;
    const uids = [...new Set((mem.data || []).map(x => x.user_id))];
    const pr = uids.length ? await sb.from('profiles').select('id,name,color,photo,phone').in('id', uids) : { data: [] };
    (pr.data || []).forEach(x => { if (x.id !== uid) people[x.id] = { name: x.name || 'Someone', color: x.color || '', photo: x.photo || '' }; });
    ids.forEach(cid => {
      const c = byId(cid); if (!c) return;
      (mem.data || []).filter(x => x.club_id === cid).forEach(x => {
        const id = x.user_id === uid ? ME : x.user_id;
        const pf = (pr.data || []).find(y => y.id === x.user_id) || {};
        const ex = c.members.find(m => m.id === id);
        if (!ex) c.members.push({ id, name: id === ME ? 'You' : pf.name || 'Someone' });
        else if (id !== ME && pf.name) ex.name = pf.name;
      });
    });
  }

  async function pullAll() {
    const mine = await sb.from('members').select('club_id').eq('user_id', uid);
    if (mine.error) throw mine.error;
    const ids = (mine.data || []).map(x => x.club_id);
    const docs = ids.length ? await sb.from('club_docs').select('club_id,doc,rev').in('club_id', ids) : { data: [] };
    let changed = false;
    for (const row of docs.data || []) { if (await syncClub(row.club_id, row)) changed = true; }
    // clubs you are no longer in
    const gone = state.clubs.filter(c => known.has(c.id) && !ids.includes(c.id));
    if (gone.length) { state.clubs = state.clubs.filter(c => !gone.includes(c)); gone.forEach(c => { known.delete(c.id); delete bases[c.id]; }); saveBases(); changed = true; }
    await loadPeople(ids);
    writeCache();
    return changed;
  }

  async function pushAll() {
    try {
      await pushProfile();
      for (const c of [...state.clubs]) {
        if (!known.has(c.id)) { await createRemote(c); writeCache(); continue; }
        ensureIds(c);
        if (!BU.eq(toRemote(c), bases[c.id])) { if (await syncClub(c.id)) refreshView(); }
      }
    } catch (e) { /* offline or a hiccup: the next save or refresh tries again */ }
  }

  const freshClub = cid => BACKEND && uid ? run(async () => { try { await syncClub(cid); } catch (e) {} }) : Promise.resolve();
  const syncAndRefresh = cid => run(async () => { try { if (await syncClub(cid)) refreshView(); else wrapListeners.forEach(f => f()); } catch (e) {} });

  async function joinClub(code) {
    const r1 = await sb.rpc('join_club', { p_code: code });
    if (r1.error) throw r1.error;
    await run(async () => { await pullAll(); });
    const c = byId(r1.data);
    if (c && !c.members.some(m => m.id === ME)) { c.members.push({ id: ME, name: 'You' }); }
    save();
    return r1.data;
  }

  function openJoin(prefill) {
    const root = document.createElement('div');
    root.className = 'sheet-backdrop';
    root.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Join a club">
        <div class="kicker">Join a club</div>
        <h2>Enter the club code</h2>
        <label class="fl">Club code<input id="jn-code" maxlength="12" autocapitalize="characters" autocomplete="off" placeholder="e.g. K7M2QX" value="${esc(prefill || '')}"></label>
        <p class="wl-err" id="jn-err" role="alert" hidden></p>
        <div class="form-actions end"><button type="button" class="btn ghost" data-cancel>Cancel</button><button type="button" class="btn" id="jn-go">Join</button></div>
      </div>`;
    document.body.appendChild(root);
    const close = () => root.remove();
    root.addEventListener('click', e => { if (e.target === root) close(); });
    root.querySelector('[data-cancel]').onclick = close;
    const go = async () => {
      const err = root.querySelector('#jn-err'), v = root.querySelector('#jn-code').value.trim();
      if (!v) { err.textContent = 'Enter the code your friend sent you'; err.hidden = false; return; }
      root.querySelector('#jn-go').disabled = true;
      try { const cid = await joinClub(v); close(); location.hash = `#/club/${cid}`; }
      catch (e) { err.textContent = /no club/i.test(e.message || '') ? 'No club has that code' : 'Could not join. Check your connection and try again'; err.hidden = false; root.querySelector('#jn-go').disabled = false; }
    };
    root.querySelector('#jn-go').onclick = go;
    root.querySelector('#jn-code').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    setTimeout(() => { const i = root.querySelector('#jn-code'); if (i) i.focus(); }, 50);
  }
  document.addEventListener('click', e => {
    const j = e.target.closest && e.target.closest('[data-join]'); if (j) { e.preventDefault(); openJoin(); return; }
    const cc = e.target.closest && e.target.closest('[data-copy-code]'); if (cc) { try { navigator.clipboard.writeText(cc.dataset.copyCode); } catch (err) {} return; }
    const so = e.target.closest && e.target.closest('[data-signout]'); if (so) { e.preventDefault(); signOut(); }
  });

  async function signOut() {
    try { await sb.auth.signOut(); } catch (e) {}
    try { localStorage.removeItem('booked_up_b_' + uid); } catch (e) {}
    location.hash = '#/'; location.reload();
  }

  // sign up or sign in
  function authScreen(mode) {
    mode = mode || 'up';
    const pr = { color: '', photo: '' };
    const old = document.querySelector('.welcome'); if (old) old.remove();
    const root = document.createElement('div');
    root.className = 'welcome';
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Sign in to Booked Up');
    const up = mode === 'up';
    root.innerHTML = `
      <form class="wl-card" id="wl-form" novalidate>
        <div class="wordmark wl-mark">${cutout('Booked Up')}</div>
        <h1>${up ? 'Welcome' : 'Welcome back'}</h1>
        <p class="wl-deck">${up ? 'Tell your clubs who you are.' : 'Sign in to see your clubs.'}</p>
        ${up ? `<div class="st-avatar wl-av" id="wl-av"></div>
        <div class="st-swatches" id="wl-sw" role="group" aria-label="Icon color">${PROFILE_COLORS.map(c => `<button type="button" class="st-sw" data-color="${c}" style="background:${c || 'conic-gradient(#8fb8e8, #7fd6a8, #f0c35a, #f0a1a1, #b0b9e8, #8fb8e8)'}" aria-label="${c ? 'Color ' + c : 'Default color'}"></button>`).join('')}</div>
        <div class="st-photo"><label class="mini-link st-up">Choose a photo<input type="file" id="wl-file" accept="image/*" hidden></label><button type="button" class="mini-link" id="wl-rm" hidden>Remove photo</button></div>
        <label class="fl">Your name<input name="name" maxlength="40" autocomplete="name" placeholder="Visible to your clubs"></label>
        <label class="fl">Phone number<input type="tel" name="phone" inputmode="tel" autocomplete="tel" placeholder="(555) 123-4567"></label>` : ''}
        <label class="fl">Email<input type="email" name="email" inputmode="email" autocomplete="email" placeholder="you@example.com"></label>
        <label class="fl">Password<input type="password" name="password" autocomplete="${up ? 'new-password' : 'current-password'}" placeholder="${up ? 'At least 6 characters' : 'Your password'}"></label>
        <p class="wl-err" id="wl-err" role="alert" hidden></p>
        <button class="btn big" type="submit">${up ? 'Create account' : 'Sign in'}</button>
        <button type="button" class="linkbtn wl-switch" id="wl-switch">${up ? 'I already have an account' : 'New here? Create an account'}</button>
      </form>`;
    document.body.appendChild(root);
    document.body.style.overflow = 'hidden';
    const f = root.querySelector('#wl-form'), err = root.querySelector('#wl-err');
    const say = t => { err.textContent = t; err.hidden = !t; };
    const paint = () => {
      if (!up) return;
      const av = root.querySelector('#wl-av'), nm = f.elements.name.value.trim();
      av.style.cssText = pr.photo ? `background:url('${pr.photo}') center/cover` : `background:${pr.color || avColor(ME)};${pr.color ? '' : 'color:#1f2328'}`;
      av.textContent = pr.photo ? '' : initial(nm || 'You');
      av.toggleAttribute('data-default', !pr.photo && !pr.color);
      root.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('on', !pr.photo && b.dataset.color === (pr.color || '')));
      root.querySelector('#wl-rm').hidden = !pr.photo;
    };
    if (up) {
      f.elements.name.addEventListener('input', paint);
      root.querySelectorAll('[data-color]').forEach(b => b.onclick = () => { pr.color = b.dataset.color; pr.photo = ''; paint(); });
      root.querySelector('#wl-rm').onclick = () => { pr.photo = ''; paint(); };
      root.querySelector('#wl-file').onchange = e => {
        const file = e.target.files && e.target.files[0]; if (!file) return;
        const img = new Image(), url = URL.createObjectURL(file);
        img.onload = () => {
          const sz = 192, cv = document.createElement('canvas'); cv.width = cv.height = sz;
          const m = Math.min(img.width, img.height);
          cv.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, sz, sz);
          pr.photo = cv.toDataURL('image/jpeg', .85); URL.revokeObjectURL(url); paint();
        };
        img.onerror = () => { URL.revokeObjectURL(url); say('Could not read that image'); };
        img.src = url;
      };
    }
    root.querySelector('#wl-switch').onclick = () => { document.body.style.overflow = ''; authScreen(up ? 'in' : 'up'); };
    f.onsubmit = async e => {
      e.preventDefault(); say('');
      const email = f.elements.email.value.trim(), password = f.elements.password.value;
      const name = up ? f.elements.name.value.trim() : '', phone = up ? f.elements.phone.value.trim() : '';
      if (up && !name) { say('Add your name'); f.elements.name.focus(); return; }
      if (up && (!phone || phone.replace(/\D/g, '').length < 7)) { say('Add a valid phone number'); f.elements.phone.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say('Enter a valid email'); f.elements.email.focus(); return; }
      if (password.length < 6) { say(up ? 'Choose a password with at least 6 characters' : 'Enter your password'); f.elements.password.focus(); return; }
      const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
      try {
        let res;
        if (up) {
          try { localStorage.setItem('bu_pending_profile', JSON.stringify({ name, phone, color: pr.color, photo: pr.photo })); } catch (x) {}
          res = await sb.auth.signUp({ email, password });
        } else res = await sb.auth.signInWithPassword({ email, password });
        if (res.error) throw res.error;
        if (!res.data || !res.data.session) { btn.disabled = false; authScreen('in'); const e2 = document.querySelector('#wl-err'); if (e2) { e2.textContent = 'Check your email to confirm your account, then sign in.'; e2.hidden = false; } return; }
        document.body.style.overflow = ''; root.remove();
        await enter(res.data.session);
      } catch (x) {
        btn.disabled = false;
        const m = String((x && x.message) || '');
        say(/already registered|already been/i.test(m) ? 'That email already has an account. Tap “I already have an account”.' : /invalid login/i.test(m) ? 'Wrong email or password' : /rate|too many/i.test(m) ? 'Too many tries. Wait a minute and try again.' : 'Could not sign in. Check your connection and try again.');
      }
    };
    paint();
  }

  // start the signed-in session
  async function enter(session) {
    uid = session.user.id; authEmail = session.user.email || '';
    storeKey = 'booked_up_u_' + uid;
    try { const cached = JSON.parse(localStorage.getItem(storeKey)); state = cached && cached.clubs ? migrate(cached) : emptyState(); } catch (e) { state = emptyState(); }
    try { bases = JSON.parse(localStorage.getItem('booked_up_b_' + uid)) || {}; } catch (e) { bases = {}; }
    Object.keys(bases).forEach(k => known.add(k));
    // your profile follows you between phones
    try {
      const pr = await sb.from('profiles').select('name,phone,color,photo').eq('id', uid).maybeSingle();
      const d = pr.data;
      if (d && d.name) Object.assign(state.profile, { name: d.name, phone: d.phone || '', color: d.color || '', photo: d.photo || '' });
      else { const pend = JSON.parse(localStorage.getItem('bu_pending_profile') || 'null'); if (pend) Object.assign(state.profile, pend); }
    } catch (e) {}
    state.profile.email = authEmail; state.profile.onboarded = true;
    save();
    applyUI(); route(); introBounce();
    try { await run(pullAll); refreshView(); fetchCovers(); } catch (e) {}
    run(pushAll);
    sb.channel('club-docs').on('postgres_changes', { event: '*', schema: 'public', table: 'club_docs' }, p => {
      const id = (p.new && p.new.club_id) || (p.old && p.old.club_id); if (id) syncAndRefresh(id);
    }).subscribe();
    setInterval(() => { if (!document.hidden) run(async () => { try { if (await pullAll()) refreshView(); } catch (e) {} }); }, 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) run(async () => { try { if (await pullAll()) refreshView(); } catch (e) {} }); });
    const jc = sessionStorage.getItem('bu_join');
    if (jc) { sessionStorage.removeItem('bu_join'); openJoin(jc); }
  }

  function introBounce() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const els = [...app.querySelectorAll('.hk-sug-card, .wg, .ps-wrap, .hk-label')];
    els.forEach((el, i) => el.style.setProperty('--d', Math.min(i, 9) * 55 + 'ms'));
    document.body.classList.add('intro');
    setTimeout(() => document.body.classList.remove('intro'), 1400);
  }

  async function boot() {
    if (!window.supabase) { app.innerHTML = '<p style="padding:24px 0">Could not reach the server. Check your connection and reload.</p>'; return; }
    sb = window.supabase.createClient(SB_URL, SB_KEY);
    let session = null;
    try { const g = await sb.auth.getSession(); session = g.data && g.data.session; } catch (e) {}
    if (session) await enter(session); else authScreen('up');
  }

  applyUI();
  if (BACKEND) boot();
  else { route(); welcome(); introBounce(); }
  fetchCovers();
})();
