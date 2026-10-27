(() => {
  'use strict';

  // If anything throws, say so on screen instead of leaving a blank page.
  addEventListener('error', e => {
    const m = document.getElementById('app');
    if (m && !m.children.length) m.innerHTML = '<p style="padding:24px 0">Something went wrong loading the app: ' + String(e.message).replace(/[<>&]/g, '') + '. Try reloading.</p>';
  });

  const STORE = 'booked_up_v2';
  const ME = 'me';
  const DAY = 864e5;

  const at = (d, h = 19) => { const t = new Date(); t.setDate(t.getDate() + d); t.setHours(h, 0, 0, 0); return t.toISOString(); };
  const ago = h => new Date(Date.now() - h * 36e5).toISOString();
  const meeting = (d, h, place, note, going = [], table = null) => ({ date: at(d, h), place, note, going, out: [], table });

  // session bands: ocean, slate and deep blues with sea green
  const GRADS = [
    'linear-gradient(135deg,#0b3f70,#1b629a)',  // deep blue
    'linear-gradient(135deg,#45308a,#7448b8)',  // purple
    'linear-gradient(135deg,#b04a16,#de772c)',  // orange
    'linear-gradient(135deg,#165a4d,#2a7468)',  // deep green
    'linear-gradient(135deg,#a4306a,#d0507f)',  // pink
    'linear-gradient(135deg,#3b5880,#1c3860)',  // slate blue
    'linear-gradient(135deg,#175f88,#17807f)',  // ocean to teal
    'linear-gradient(135deg,#102a4c,#245f8c)',  // midnight to ocean
  ];
  const CLUB_COLORS = ['#0b3f70', '#45308a', '#b04a16', '#165a4d', '#a4306a', '#3b5880', '#175f88', '#102a4c'];
  const clubGradById = cid => gradFor(state.clubs.findIndex(c => c.id === cid));
  const clubColor = cid => CLUB_COLORS[((state.clubs.findIndex(c => c.id === cid) % CLUB_COLORS.length) + CLUB_COLORS.length) % CLUB_COLORS.length];
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
          meeting(3, 19, "Maya's rooftop", 'Bring a hot take and a pen.', ['me', 'maya', 'jo'], { name: 'Maya', food: 'Cheese board' }),
          meeting(31, 19, 'Dev\'s apartment', '', []),
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
          meeting(34, 18, 'Rae\'s place', '', []),
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
    s.clubs.forEach(c => {
      c.quotes = c.quotes || [];
      if (!c.wishlist) c.wishlist = seedWish(c.id);
      if (c.upNext === undefined) {
        c.upNext = seedNext(c.id);
        if (c.upNext) c.wishlist = c.wishlist.filter(w => w.title.toLowerCase() !== c.upNext.title.toLowerCase());
      }
      if (!c.suggestions) c.suggestions = seedSugg(c.id);
      if (!c.emoji) c.emoji = ({ c1: '🕵️', c2: '🐉', c3: '💌' })[c.id] || '📚';
      c.updates = c.updates || [];
      c.history = c.history || [];
      const sh = ['c1', 'c2', 'c3'].includes(c.id) && (!c.history.length || !c.history[0].ratings) ? seedHistory(c.id) : null;
      if (sh) { c.history = sh; c.meetings = (c.meetings || []).filter(m => new Date(m.date) >= Date.now()); }
      c.history.forEach((h, i) => {
        h.id = h.id || 'h' + Date.now().toString(36) + i;
        h.date = h.date || h.finishedAt;
        h.ratings = h.ratings || (h.rating ? { [ME]: h.rating } : {});
        h.going = h.going || Object.keys(h.ratings);
        h.quotes = h.quotes || []; h.updates = h.updates || []; h.place = h.place || '';
        if (!('table' in h)) h.table = null;
      });
      (c.meetings || []).forEach(m => {
        m.out = m.out || [];
        if (!('table' in m)) {
          const e = Object.entries(m.potluck || {})[0];
          m.table = e ? { name: e[0] === ME ? 'You' : ((c.members.find(x => x.id === e[0]) || {}).name || e[0]), food: e[1] } : null;
        }
        delete m.potluck; delete m.maybe;
      });
    });
    return s;
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} }

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const app = $('#app');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initial = n => esc(((n || '?').match(/[A-Za-z0-9]/) || ['?'])[0].toUpperCase());
  const AV_COLORS = ['#7448b8', '#c2406f', '#cf6a1f', '#17808a', '#2a6cb0', '#2a8a58'];
  const avColor = id => id === ME ? '#1f7aa8' : AV_COLORS[[...String(id)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % AV_COLORS.length];
  const avatar = (m, i) => `<span class="av ${m.id === ME ? 'you' : ''}" style="--mc:${avColor(m.id)}">${initial(m.name)}</span>`;
  const memberName = (c, id) => id === ME ? 'You' : (c.members.find(m => m.id === id) || { name: 'Someone' }).name;
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

  const nextMeeting = c => (c.meetings || []).filter(m => new Date(m.date) >= Date.now()).sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  const nextTime = c => { const m = nextMeeting(c); return m ? new Date(m.date).getTime() : Infinity; };

  /* ---------- home ---------- */
  function home() {
    const clubs = [...state.clubs].sort((a, b) => nextTime(a) - nextTime(b));
    const first = clubs[0] && nextMeeting(clubs[0]);
    app.innerHTML = `
      <section class="page-head head-row">
        <div><h1>Your clubs 📚</h1></div>
        <a class="newclub" href="#/new">+ New club</a>
      </section>
      <div class="gposters">
        ${clubs.map(c => {
          const m = nextMeeting(c);
          const bk = bookFor(c, m);
          return `
          <a class="gposter" href="#/club/${c.id}" style="background:${clubGrad(c)}">
            <div class="gp-top"><span class="gp-club"><span class="gp-emoji">${esc(c.emoji || '📚')}</span>${esc(c.name)}</span><span class="gp-chip">${m ? relDay(m.date) : 'Unscheduled'}</span></div>
            <div class="gp-main">
              <div class="gp-text">
                <div class="gp-label">Reading now</div>
                <h2>${esc(bk.title)}</h2>
                <div class="gp-author">${esc(bk.author)}</div>
                <div class="gp-date">${m ? `${fmtShort(m.date)} · ${fmtTime(m.date)}` : 'No meeting yet'}</div>
              </div>
              ${coverHTML(bk, coverKeyFor(c, m))}
            </div>
            <div class="gp-foot"><span class="stack">${c.members.map(avatar).join('')}</span><span class="gp-count">${c.members.length} members</span></div>
          </a>`;
        }).join('') || '<p class="muted-line">No clubs yet. Start one with “New club”.</p>'}
      </div>`;
  }

  /* ---------- club ---------- */
  let ui = { table: false, quote: false };
  function club(id) {
    const c = state.clubs.find(x => x.id === id);
    if (!c) { location.hash = '#/'; return; }
    const meet = nextMeeting(c);
    if (meet) meet.out = meet.out || [];
    const going = meet ? meet.going : [];
    const rsvp = meet ? (going.includes(ME) ? 'yes' : meet.out.includes(ME) ? 'no' : '') : '';
    const table = meet && meet.table;
    const updates = [...(c.updates || [])].sort((a, b) => new Date(b.at) - new Date(a.at));
    const quotes = [...(c.quotes || [])].sort((a, b) => (b.author === ME) - (a.author === ME));
    const myQuote = quotes.find(q => q.author === ME);
    const invited = c.members.filter(m => m.phone);
    const wl = c.wishlist || [];
    const sugg = [...(c.suggestions || [])].sort((a, b) => b.votes.length - a.votes.length);
    const hist = [...(c.history || [])].sort((a, b) => new Date(b.date) - new Date(a.date));

    const tableHTML = !meet ? '' : ui.table ? `
          <form class="table-form" id="table-form">
            <input name="who" maxlength="40" required placeholder="Who is bringing food?" value="${esc(table ? table.name : '')}" aria-label="Name">
            <input name="food" maxlength="60" required placeholder="What are they bringing?" value="${esc(table ? table.food : '')}" aria-label="Food">
            <div class="form-actions"><button class="btn">Save</button><button type="button" class="linkbtn" data-cancel-table>Cancel</button>${table ? '<button type="button" class="linkbtn" data-clear-table>Remove</button>' : ''}</div>
          </form>` : table ? `
          <div class="table-row"><div><b>${esc(table.name)}</b> is bringing <span class="food">${esc(table.food)}</span></div><button class="mini-btn" data-edit-table>Edit</button></div>` : `
          <button class="plus" data-edit-table aria-label="Add who is bringing food"><span>+</span>Add who's bringing food</button>`;

    const quoteForm = (!myQuote || ui.quote) ? `
      <form class="note-form" id="quote-form">
        <textarea name="text" maxlength="300" required placeholder="Your favorite line from the book…" aria-label="Your favorite quote">${esc(myQuote ? myQuote.text : '')}</textarea>
        <div class="form-actions end">${myQuote ? '<button type="button" class="linkbtn" data-clear-quote>Remove</button><button type="button" class="linkbtn" data-cancel-quote>Cancel</button>' : ''}<button class="btn">${myQuote ? 'Update' : 'Save quote'}</button></div>
      </form>` : '';

    const cur = bookFor(c, meet);
    const tab = ui.tab || 'meeting';
    const goingHTML = going.map(g => `<li>${avatar({ id: g, name: memberName(c, g) })}${esc(memberName(c, g))}</li>`).join('') || '<li class="none">No one yet. Be the first!</li>';

    app.innerHTML = `
      <a class="back" href="#/">‹ All clubs</a>
      <section class="club-head">
        <h1><button type="button" class="emoji-btn" data-emoji aria-label="Change club emoji">${esc(c.emoji || '📚')}</button>${esc(c.name)}</h1>
        <p class="deck" style="margin-top:2px">${pluralize(c.members.length, 'member')} · ${pluralize(hist.length, 'book')} read together</p>
      </section>

      ${meet ? `
      <section class="poster feature session hero" aria-label="Next meeting">
        <div class="sband" style="background:${clubGrad(c)}">
          <div class="sline"><span class="sname">Next meeting</span><span class="schip">${relDay(meet.date)}</span></div>
          <div class="sdate">${fmtLong(meet.date)} · ${fmtTime(meet.date)}</div>
          <div class="swhere">${esc(meet.place)}</div>
        </div>
        <div class="sbody">
          <div class="p-main">
            <div class="p-text">
              <div class="clabel">Reading</div>
              <h2>${esc(cur.title)}</h2>
              <div class="when">by ${esc(cur.author)}${cur.pages ? ` · ${cur.pages} pages` : ''}</div>
            </div>
            ${coverHTML(cur, coverKeyFor(c, meet))}
          </div>
          ${meet.note ? `<p class="note">${esc(meet.note)}</p>` : ''}
          <div class="rsvp">
            <button data-rsvp="yes" class="${rsvp === 'yes' ? 'on' : ''}">🎉 I'm going</button>
            <button data-rsvp="no" class="${rsvp === 'no' ? 'on' : ''}">Can't make it</button>
            <span class="count"><span class="stack">${going.slice(0, 4).map(g => avatar({ id: g, name: memberName(c, g) })).join('')}</span>${going.length} going</span>
          </div>
        </div>
      </section>` : `
      <section class="poster feature session hero">
        <div class="sband" style="background:${clubGrad(c)}"><div class="sline"><span class="sname">Next meeting</span></div><div class="sdate">Nothing scheduled</div><div class="swhere">Plan one below</div></div>
      </section>`}

      <button type="button" class="plan-cta" data-plan>${SPARK}<span>Plan the next meeting</span></button>

      <div class="ctabs" role="tablist">
        <button type="button" class="ctab ${tab === 'meeting' ? 'on' : ''}" data-ctab="meeting" role="tab">Meeting</button>
        <button type="button" class="ctab ${tab === 'books' ? 'on' : ''}" data-ctab="books" role="tab">Books</button>
        <button type="button" class="ctab ${tab === 'chat' ? 'on' : ''}" data-ctab="chat" role="tab">Chat</button>
      </div>

      <div class="cpanel" data-panel="meeting" ${tab === 'meeting' ? '' : 'hidden'}>
        ${meet ? `
        <div class="sec"><h2>Who's going</h2><span class="kicker">${going.length}</span></div>
        <ul class="going-list">${goingHTML}</ul>
        <div class="sec"><h2>On the table</h2></div>
        <div class="panel tablebox">${tableHTML}</div>` : '<p class="muted-line">Plan a meeting to start collecting RSVPs.</p>'}
        ${invited.length ? `
        <div class="sec"><h2>Invited friends</h2><span class="kicker">${invited.length}</span></div>
        <ul class="invites">${invited.map(m => `
          <li><span class="who">${avatar(m)}<b>${esc(m.name)}</b>${m.name !== fmtPhone(m.phone) ? `<small>${esc(fmtPhone(m.phone))}</small>` : ''}</span><a class="mini-link" href="${smsHref(m, c, meet)}">Text invite</a></li>`).join('')}</ul>` : ''}
      </div>

      <div class="cpanel" data-panel="books" ${tab === 'books' ? '' : 'hidden'}>
        <div class="sec"><h2>Next book</h2><span class="kicker">for the next meeting</span></div>
        ${c.upNext ? `<div class="panel upnext"><div class="srow">
            ${coverHTML(c.upNext, c.id + ':next')}
            <div class="cbody">
              <div class="clabel">Up next · picked by ${esc(memberName(c, c.upNext.by))}</div>
              <h3 class="ctitle">${esc(c.upNext.title)}</h3>
              <div class="cauthor">by ${esc(c.upNext.author)}</div>
              ${c.upNext.pages ? `<div class="bpages">${c.upNext.pages} pages</div>` : ''}
              <div class="form-actions"><button type="button" class="mini-link" data-pick>Change</button><button type="button" class="rmlink" data-clear-next>Clear</button></div>
            </div></div></div>`
          : `<div class="panel emptynext"><p>No book picked for the next meeting yet.</p><button type="button" class="btn" data-pick>Pick the next book</button></div>`}
        <div class="subhead"><span class="kicker">Suggestions · ${sugg.length}</span><button type="button" class="mini-link" data-pick>+ Suggest a book</button></div>
        ${sugg.length ? `<ul class="panel sugg">${sugg.map(x => `
          <li class="srow2">
            <span class="thumb" data-cover="${c.id}:s:${x.id}">${x.coverId ? coverImg(x.coverId, x.title) : ''}<em>${initial(x.title)}</em></span>
            <div class="winfo"><a class="wtitle" href="#/browse/book?${wishParams(x)}">${esc(x.title)}</a><div class="by">${esc(x.author)}${x.pages ? ` · ${x.pages} pages` : ''}<br>Suggested by ${esc(memberName(c, x.by))}</div></div>
            <div class="sact"><button type="button" class="vote ${x.votes.includes(ME) ? 'on' : ''}" data-vote="${x.id}" aria-pressed="${x.votes.includes(ME)}" aria-label="Vote for ${esc(x.title)}">▲ ${x.votes.length}</button><button type="button" class="mini-link" data-pick-sugg="${x.id}">Pick</button></div>
          </li>`).join('')}</ul>` : '<p class="muted-line">No suggestions yet. Suggest a book from your list, from recommendations, or search for one.</p>'}

        <div class="sec"><h2>Want to read</h2><span class="kicker">${wl.length}</span></div>
        ${wl.length ? `<div class="hshelf">${wl.map(w => `
          <div class="tile">
            <a href="#/browse/book?${wishParams(w)}"><span class="cover" data-cover="${c.id}:w:${w.id}">${w.coverId ? coverImg(w.coverId, w.title) : ''}<em>${esc(w.title)}</em></span></a>
            <a class="ttitle" href="#/browse/book?${wishParams(w)}">${esc(w.title)}</a>
            <div class="tmeta">${esc(w.author)}${w.pages ? ` · ${w.pages} pp` : ''}</div>
            <button type="button" class="rmlink" data-rm-wish="${w.id}">Remove</button>
          </div>`).join('')}</div>` : '<p class="muted-line">Nothing on the list yet. Find a book in <a class="inl" href="#/browse">Browse</a> and tap “Add to list”.</p>'}

        <div class="sec"><h2>Past reads</h2><span class="kicker">${hist.length ? `${pluralize(hist.length, 'book')} · avg ★ ${(hist.reduce((a, h) => a + avgOf(h), 0) / hist.length).toFixed(1)}` : '0 books'}</span></div>
        ${hist.length ? `<div class="hshelf">${hist.map(h => shelfTile(c, h)).join('')}</div>` : '<p class="muted-line">Books you finish together will show up here.</p>'}
      </div>

      <div class="cpanel" data-panel="chat" ${tab === 'chat' ? '' : 'hidden'}>
        <div class="sec"><h2>Club notes</h2><span class="kicker">${pluralize(updates.length, 'post')}</span></div>
        <form class="note-form" id="note-form">
          <textarea name="text" maxlength="400" placeholder="Share an update with the club…" aria-label="Post an update" required></textarea>
          <button class="btn">Post</button>
        </form>
        <ul class="feed">
          ${updates.map(u => `
            <li class="post">
              ${avatar({ id: u.author, name: memberName(c, u.author) })}
              <div><div class="meta">${esc(memberName(c, u.author))}<span>${timeAgo(u.at)}</span></div><p>${esc(u.text)}</p></div>
            </li>`).join('') || '<li class="muted-line">No posts yet.</li>'}
        </ul>

        <div class="sec"><h2>Favorite quotes</h2><span class="kicker">${quotes.length}</span></div>
        ${quoteForm}
        ${quotes.length ? `<ul class="quotes">${quotes.map(q => `
          <li class="quote">
            <blockquote>“${esc(q.text)}”</blockquote>
            <div class="by">— ${esc(memberName(c, q.author))}${q.author === ME && !ui.quote ? ' <button class="linkbtn" data-edit-quote>Edit</button>' : ''}</div>
          </li>`).join('')}</ul>` : ''}
      </div>`;

    const rerender = () => club(id);

    app.querySelectorAll('[data-ctab]').forEach(b => b.onclick = () => {
      ui.tab = b.dataset.ctab;
      app.querySelectorAll('[data-ctab]').forEach(x => x.classList.toggle('on', x === b));
      app.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== ui.tab; });
    });
    $('[data-plan]').onclick = () => openPlan(c, rerender);
    $('[data-emoji]').onclick = () => openEmojiPicker(c.emoji, e => { c.emoji = e; save(); rerender(); toast('Emoji updated'); });

    app.querySelectorAll('[data-rsvp]').forEach(b => b.onclick = () => {
      const yes = b.dataset.rsvp === 'yes';
      meet.going = meet.going.filter(x => x !== ME);
      meet.out = meet.out.filter(x => x !== ME);
      (yes ? meet.going : meet.out).push(ME);
      save(); rerender();
      if (yes) confetti();
      toast(yes ? "You're on the list" : 'Response saved');
    });

    app.querySelectorAll('[data-edit-table]').forEach(b => b.onclick = () => { ui.table = true; rerender(); const i = $('#table-form input'); if (i) i.focus(); });
    const cancelT = $('[data-cancel-table]'); if (cancelT) cancelT.onclick = () => { ui.table = false; rerender(); };
    const clearT = $('[data-clear-table]'); if (clearT) clearT.onclick = () => { meet.table = null; ui.table = false; save(); rerender(); toast('Removed'); };
    const tf = $('#table-form');
    if (tf) tf.onsubmit = e => {
      e.preventDefault();
      const f = new FormData(tf);
      meet.table = { name: f.get('who').trim(), food: f.get('food').trim() };
      ui.table = false; save(); rerender(); toast('On the table');
    };

    app.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => openPicker(c, rerender));
    app.querySelectorAll('[data-vote]').forEach(b => b.onclick = () => {
      const x = c.suggestions.find(y => y.id === b.dataset.vote), i = x.votes.indexOf(ME);
      if (i >= 0) x.votes.splice(i, 1); else x.votes.push(ME);
      save(); rerender();
    });
    app.querySelectorAll('[data-pick-sugg]').forEach(b => b.onclick = () => {
      const x = c.suggestions.find(y => y.id === b.dataset.pickSugg);
      setNextBook(c, x); rerender(); toast(`Up next: ${x.title}`);
    });
    const clearNext = $('[data-clear-next]');
    if (clearNext) clearNext.onclick = () => { c.upNext = null; save(); rerender(); toast('Cleared'); };

    app.querySelectorAll('[data-rm-wish]').forEach(b => b.onclick = () => { c.wishlist = wl.filter(w => w.id !== b.dataset.rmWish); save(); rerender(); toast('Removed from the list'); });

    app.querySelectorAll('[data-edit-quote]').forEach(b => b.onclick = () => { ui.quote = true; rerender(); });
    const cancelQ = $('[data-cancel-quote]'); if (cancelQ) cancelQ.onclick = () => { ui.quote = false; rerender(); };
    const clearQ = $('[data-clear-quote]'); if (clearQ) clearQ.onclick = () => { c.quotes = c.quotes.filter(q => q.author !== ME); ui.quote = false; save(); rerender(); toast('Removed'); };
    const qf = $('#quote-form');
    if (qf) qf.onsubmit = e => {
      e.preventDefault();
      const text = new FormData(qf).get('text').trim();
      if (!text) return;
      const mine = (c.quotes || []).find(q => q.author === ME);
      if (mine) mine.text = text; else (c.quotes = c.quotes || []).push({ id: 'q' + Date.now(), author: ME, text });
      ui.quote = false; save(); rerender(); toast('Quote saved');
    };

    $('#note-form').onsubmit = e => {
      e.preventDefault();
      const text = new FormData(e.target).get('text').trim();
      if (!text) return;
      (c.updates = c.updates || []).push({ id: 'u' + Date.now(), author: ME, text, at: new Date().toISOString() });
      save(); rerender(); toast('Posted');
    };
  }

  /* ---------- past reads ---------- */
  function pastBook(cid, hid) {
    const c = state.clubs.find(x => x.id === cid);
    const h = c && (c.history || []).find(x => x.id === hid);
    if (!h) { location.hash = c ? `#/club/${cid}` : '#/'; return; }
    const idx = c.history.indexOf(h);
    const going = h.going || [];
    const updates = [...(h.updates || [])].sort((a, b) => new Date(b.at) - new Date(a.at));
    const mine = (h.ratings || {})[ME] || 0;
    app.innerHTML = `
      <a class="back" href="#/club/${c.id}">‹ ${esc(c.name)}</a>
      <section class="club-head">
        <div class="kicker">Past read</div>
        <h1>${esc(c.name)}</h1>
        <p class="deck" style="margin-top:0">${esc(h.title)}</p>
      </section>

      <section class="poster feature session">
        <div class="sband" style="background:${pastGrad(c, idx)}">
          <div class="sline"><span class="sname">Met</span><span class="schip">${fmt(h.date, { month: 'short', year: 'numeric' })}</span></div>
          <div class="sdate">${fmtLong(h.date)} · ${fmtTime(h.date)}</div>
          ${h.place ? `<div class="swhere">${esc(h.place)}</div>` : ''}
        </div>
        <div class="sbody">
        <div class="p-main">
          <div class="p-text">
            <div class="clabel">Read together</div>
            <h2>${esc(h.title)}</h2>
            <div class="when">by ${esc(h.author)} · ${h.pages} pages</div>
          </div>
          ${coverHTML(h, `${c.id}:${h.id}`)}
        </div>
        ${h.note ? `<p class="note">${esc(h.note)}</p>` : ''}
        <div class="going">
          <div class="kicker">Who was there · ${going.length}</div>
          <ul class="going-list">${going.map(g => `<li>${avatar({ id: g, name: memberName(c, g) })}${esc(memberName(c, g))}</li>`).join('') || '<li class="none">No one recorded</li>'}</ul>
        </div>
        <div class="potluck">
          <div class="kicker">On the table</div>
          ${h.table ? `<div class="table-row"><div><b>${esc(h.table.name)}</b> brought <span class="food">${esc(h.table.food)}</span></div></div>` : '<p class="none-line">No one signed up.</p>'}
        </div>
        </div>
      </section>

      <div class="sec"><h2>Ratings</h2><span class="kicker">${pluralize(ratingVals(h).length, 'rating')}</span></div>
      <div class="rating-card">
        <div class="avg"><b>${avgText(h)}</b><div><div class="stars-s">${starSpans(avgOf(h))}</div><span class="kicker">Club average</span></div></div>
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

      <div class="sec"><h2>Favorite quotes</h2><span class="kicker">${(h.quotes || []).length}</span></div>
      ${(h.quotes || []).length ? `<ul class="quotes">${h.quotes.map(q => `<li class="quote"><blockquote>“${esc(q.text)}”</blockquote><div class="by">— ${esc(memberName(c, q.author))}</div></li>`).join('')}</ul>` : '<p class="muted-line">No quotes were saved for this book.</p>'}

      <div class="sec"><h2>Club notes</h2><span class="kicker">${pluralize(updates.length, 'post')}</span></div>
      <ul class="feed">
        ${updates.map(u => `
          <li class="post">
            ${avatar({ id: u.author, name: memberName(c, u.author) })}
            <div><div class="meta">${esc(memberName(c, u.author))}<span>${fmtShort(u.at)}</span></div><p>${esc(u.text)}</p></div>
          </li>`).join('') || '<li class="muted-line">No posts for this book.</li>'}
      </ul>`;

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
      (c.meetings || []).forEach(m => { const d = new Date(m.date); if (d < now && hd.has(dkey(d))) return; all.push({ c, m, d, href: `#/club/${c.id}`, title: m.book && m.book.title }); });
      hist.forEach(h => all.push({ c, m: { date: h.date, place: h.place || '' }, d: new Date(h.date), href: `#/club/${c.id}/book/${h.id}`, title: h.title }));
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
      cells += `<button class="day ${k === todayKey ? 'today' : ''} ${k === cal.sel ? 'sel' : ''}" data-key="${k}" aria-label="${fmtLong(dt)}${ev.length ? ', book club' : ''}">
        <span class="num">${d}</span>
        ${ev.length ? `<span class="mark ${past ? 'past' : ''}">${ICON_BOOK}${ev.length > 1 ? `<b>${ev.length}</b>` : ''}</span>` : ''}
      </button>`;
    }

    const sel = byDay[cal.sel] || [];
    const [sy, sm, sd] = cal.sel.split('-').map(Number);
    const selDate = new Date(sy, sm - 1, sd);
    const upcoming = all.filter(e => e.d >= now).slice(0, 4);
    const row = (e, showDate) => `
      <a class="event" href="${e.href}">
        <div class="date"><span>${e.d.toLocaleDateString(undefined, { month: 'short' })}</span><b>${e.d.getDate()}</b></div>
        <div><h2>${esc(e.c.emoji || '📚')} ${esc(e.c.name)}</h2><p>${e.title ? `${esc(e.title)} · ` : ''}${showDate ? `${fmtShort(e.m.date)} · ` : ''}${fmtTime(e.m.date)}${e.m.place ? ` · ${esc(e.m.place)}` : ''}</p></div>
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

    app.querySelectorAll('[data-key]').forEach(b => b.onclick = () => { cal.sel = b.dataset.key; calendar(); });
    app.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => {
      const n = +b.dataset.nav;
      if (n === 0) { const t = new Date(); cal = { y: t.getFullYear(), m: t.getMonth(), sel: dkey(t) }; }
      else { const t = new Date(cal.y, cal.m + n, 1); cal.y = t.getFullYear(); cal.m = t.getMonth(); }
      calendar();
    });
  }

  /* ---------- notifications ---------- */
  function buildNotifs() {
    const upcoming = [], updates = [];
    state.clubs.forEach(c => {
      const m = nextMeeting(c);
      if (m) {
        const n = dayDiff(m.date);
        const t0 = new Date(m.date).getTime();
        const when = `${fmtLong(m.date)} at ${fmtTime(m.date)} · ${m.place}`;
        if (n <= 21) upcoming.push({ id: `cd:${c.id}:${m.date}`, kind: 'Countdown', clubName: c.name, emoji: c.emoji, title: `Meets ${relPhrase(m.date)}`, body: when, time: relDay(m.date), club: c.id, sort: t0, pri: 1 });
        if (n <= 7) {
          const t = m.table;
          if (t) {
            const mine = /^(you|me)$/i.test(t.name.trim());
            upcoming.push({ id: `food:${c.id}:${m.date}:${t.name}:${t.food}`, kind: 'Reminder', clubName: c.name, emoji: c.emoji, title: mine ? `Bring ${t.food}` : `${t.name} is bringing ${t.food}`, body: mine ? `You're on food for ${fmtShort(m.date)}. Doors at ${fmtTime(m.date)}.` : `For ${fmtShort(m.date)} at ${fmtTime(m.date)}.`, time: relDay(m.date), club: c.id, sort: t0, pri: 0 });
          } else {
            upcoming.push({ id: `food:${c.id}:${m.date}:none`, kind: 'Reminder', clubName: c.name, emoji: c.emoji, title: 'No one is bringing food yet', body: 'Add who is bringing something on the club page.', time: relDay(m.date), club: c.id, sort: t0, pri: 0 });
          }
        }
      }
      (c.updates || []).filter(u => u.author !== ME).forEach(u => updates.push({
        id: `up:${u.id}`, kind: 'Club update', clubName: c.name, emoji: c.emoji, title: `${memberName(c, u.author)} posted`, body: u.text, time: timeAgo(u.at), club: c.id, sort: new Date(u.at).getTime(),
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
      <li><a class="notif ${state.read[n.id] ? '' : 'unread'}" href="#/club/${n.club}" data-nid="${esc(n.id)}" style="background:${clubGradById(n.club)}">
        <div class="nhead"><span class="ctag">${esc(n.emoji || '📚')} ${esc(n.clubName)}</span><span class="nkind">${esc(n.kind)}</span><span class="time">${esc(n.time)}</span></div>
        <h3>${esc(n.title)}</h3>
        <p>${esc(n.body)}</p>
        ${state.read[n.id] ? '' : '<span class="pip" aria-label="Unread"></span>'}
      </a></li>`;
    const unread = everything.filter(x => !state.read[x.id]).length;
    const chip = (id, label, color) => {
      const n = everything.filter(x => (!id || x.club === id) && !state.read[x.id]).length;
      return `<button type="button" class="fchip2 ${alertFilter === id ? 'on' : ''}" data-filter="${id || ''}" style="--cc:${color}" aria-pressed="${alertFilter === id}">${id ? `<span class="chip-emoji">${esc((state.clubs.find(x => x.id === id) || {}).emoji || '📚')}</span>` : ''}${esc(label)}${n ? `<b>${n}</b>` : ''}</button>`;
    };
    app.innerHTML = `
      <section class="page-head">
        <div class="kicker">Alerts</div>
        <h1>What's new ✨</h1>
        <p class="deck">${unread ? `${unread} unread.` : 'You are all caught up.'} ${unread ? '<button class="linkbtn" id="read-all">Mark all as read</button>' : ''}</p>
      </section>
      <div class="filters" role="group" aria-label="Filter by club">${chip(null, 'All clubs', '#14263a')}${state.clubs.map(c => chip(c.id, c.name, clubColor(c.id))).join('')}</div>
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

  function stats() {
    const books = readBooks();
    const pages = books.reduce((s, b) => s + b.pages, 0);
    const rated = books.filter(b => b.mine);
    const avg = rated.length ? (rated.reduce((s, b) => s + b.mine, 0) / rated.length).toFixed(1) : '—';
    const max = Math.max(1, ...books.map(b => b.pages));
    const byPages = [...books].sort((a, b) => b.pages - a.pages);

    app.innerHTML = `
      <section class="page-head">
        <div class="kicker">Your reading</div>
        <h1>By the numbers 🏆</h1>
        <p class="deck">Every book you've finished with a club.</p>
      </section>
      <div class="figures">
        <div class="figure"><b>${books.length}</b><span>Books</span></div>
        <div class="figure"><b>${pages.toLocaleString()}</b><span>Pages</span></div>
        <div class="figure"><b>${avg}</b><span>Avg. rating</span></div>
      </div>

      <div class="sec"><h2>Pages per book</h2></div>
      <div class="pb">
        ${byPages.map(b => `<div class="pb-row"><span class="t">${esc(b.title)}</span><span class="bar"><i style="width:${Math.round(b.pages / max * 100)}%"></i></span><span class="n">${b.pages}</span></div>`).join('') || '<p class="muted-line">No finished books yet.</p>'}
      </div>

      <div class="sec"><h2>The shelf</h2><span class="kicker">Your ratings · tap to change</span></div>
      <ul class="shelf">
        ${books.map(b => `
          <li class="book">
            <div><h3><a href="#/club/${b.cid}/book/${b.id}">${esc(b.title)}</a></h3><div class="by">${esc(b.author)}</div></div>
            <div class="stars" role="group" aria-label="Rating for ${esc(b.title)}">
              ${[1, 2, 3, 4, 5].map(n => `<button data-key="${esc(b.key)}" data-r="${n}" class="${b.mine >= n ? 'on' : ''}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}
            </div>
            <div class="meta">${esc(b.club)} · ${b.pages} pp · ${fmt(b.finishedAt, { month: 'short', year: 'numeric' })}${b.avg ? ` · Club ★ ${b.avg.toFixed(1)}` : ''}</div>
          </li>`).join('') || '<li class="muted-line">Finish a book to see it here.</li>'}
      </ul>`;

    app.querySelectorAll('.stars button').forEach(btn => btn.onclick = () => {
      const b = books.find(x => x.key === btn.dataset.key);
      const r = +btn.dataset.r;
      b.ref.ratings = b.ref.ratings || {};
      if (b.ref.ratings[ME] === r) delete b.ref.ratings[ME]; else b.ref.ratings[ME] = r;
      save(); stats();
    });
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
    const body = `Join ${c.name} on Booked Up. We're reading ${c.book.title}.${when} ${location.href.split('#')[0]}`;
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
    let emoji = '📚';
    const dirty = { author: false, pages: false };
    let coverId, seq = 0, debounce;

    app.innerHTML = `
      <a class="back" href="#/">‹ Cancel</a>
      <section class="page-head"><div class="kicker">New club</div><h1>Start a club</h1></section>
      <form class="fp" id="nc-form" novalidate>
        <section class="fcard">
          <label class="fl">Book title<input name="title" required autocomplete="off" placeholder="Start typing a title…" aria-label="Book title"></label>
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
        </section>

        <section class="fcard">
          <div class="kicker">On the table <span class="opt">optional</span></div>
          <div class="frow">
            <label class="fl">Who is bringing food<input name="who" maxlength="40" list="who-list" placeholder="Name"></label>
            <label class="fl">What they're bringing<input name="food" maxlength="60" placeholder="Food"></label>
          </div>
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

        <section class="fcard">
          <div class="namerow">
            <button type="button" class="emoji-btn big" id="nc-emoji" aria-label="Pick an emoji for your club">📚</button>
            <label class="fl">Club name<input name="name" maxlength="40" placeholder="e.g. Plot Twist Society"></label>
          </div>
          <p class="fhint">Tap the emoji to pick one for your club.</p>
        </section>
        <button class="btn big">Create club</button>
      </form>`;

    const form = $('#nc-form');
    $('#nc-emoji').onclick = () => openEmojiPicker(emoji, e => { emoji = e; $('#nc-emoji').textContent = e; });
    const hint = $('#book-hint');
    const suggest = $('#suggest');
    const f = n => form.elements[n];

    f('author').addEventListener('input', () => { dirty.author = true; });
    f('pages').addEventListener('input', () => { dirty.pages = true; });

    /* book lookup: autofill author + pages */
    const applyBook = (d, setTitle) => {
      if (setTitle) f('title').value = d.title;
      if (d.cover_i) coverId = d.cover_i;
      if (setTitle || !dirty.author) { f('author').value = (d.author_name || [])[0] || ''; dirty.author = false; }
      if ((setTitle || !dirty.pages) && d.number_of_pages_median) { f('pages').value = d.number_of_pages_median; dirty.pages = false; }
      hint.textContent = d.number_of_pages_median ? `Found: ${d.title}${d.author_name ? ' by ' + d.author_name[0] : ''}, ${d.number_of_pages_median} pages. Edit if it's a different edition.` : `Found ${d.title}, but not the page count. Enter it below.`;
    };
    f('title').addEventListener('input', () => {
      clearTimeout(debounce);
      const q = f('title').value.trim();
      coverId = undefined;
      if (q.length < 3) { suggest.hidden = true; return; }
      const mine = ++seq;
      debounce = setTimeout(async () => {
        try {
          const docs = (await lookupBooks(q)).filter(d => d.title);
          if (mine !== seq) return;
          if (!docs.length) { suggest.hidden = true; hint.textContent = "Couldn't find that title. Enter the pages yourself."; return; }
          applyBook(docs[0], false);
          suggest.innerHTML = docs.map((d, i) => `<li><button type="button" data-i="${i}"><b>${esc(d.title)}</b><span>${esc((d.author_name || ['Unknown author'])[0])}${d.number_of_pages_median ? ' · ' + d.number_of_pages_median + ' pages' : ''}${d.first_publish_year ? ' · ' + d.first_publish_year : ''}</span></button></li>`).join('');
          suggest.hidden = false;
          suggest.querySelectorAll('button').forEach(b => b.onclick = () => { applyBook(docs[+b.dataset.i], true); suggest.hidden = true; });
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

    form.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.id !== 'f-phone') { if (e.target.name === 'title') e.preventDefault(); } });
    form.onsubmit = e => {
      e.preventDefault();
      const title = f('title').value.trim(), pages = +f('pages').value;
      if (!title) { toast('Add a book title'); f('title').focus(); return; }
      if (!pages || pages < 1) { toast('Add the page count'); f('pages').focus(); return; }
      if (!f('date').value || !f('time').value) { toast('Pick a date and time'); return; }
      const who = f('who').value.trim(), food = f('food').value.trim();
      if (!!who !== !!food) { toast('Add both a name and a food'); (who ? f('food') : f('who')).focus(); return; }
      const date = new Date(`${f('date').value}T${f('time').value}`);
      if (isNaN(date)) { toast('Check the date and time'); return; }
      const id = 'c' + Date.now();
      const friends = selected.map(fid => state.friends.find(x => x.id === fid)).filter(Boolean).map(fr => ({ id: fr.id, name: fr.name, phone: fr.phone }));
      state.clubs.push({
        id, name: f('name').value.trim() || `${title} Club`,
        book: { title, author: f('author').value.trim() || 'Unknown author', pages, ...(coverId ? { coverId } : {}) },
        meetings: [{ date: date.toISOString(), place: f('place').value.trim() || 'TBD', note: '', going: [ME], out: [], table: who ? { name: who, food } : null }],
        members: [{ id: ME, name: 'You' }, ...friends],
        history: [], updates: [], quotes: [], wishlist: [], upNext: null, suggestions: [], emoji,
      });
      save(); updateBadge(); fetchCovers();
      location.hash = `#/club/${id}`;
      toast('Club created');
    };
    if (opts.title) {
      f('title').value = opts.title;
      f('author').value = opts.author || '';
      if (opts.pages) f('pages').value = opts.pages;
      hint.textContent = opts.pages ? `${opts.title}: ${opts.pages} pages. Edit if it's a different edition.` : 'Looking up the page count…';
      if (!opts.pages) f('title').dispatchEvent(new Event('input'));
      coverId = opts.cover ? +opts.cover : undefined;
    } else f('title').focus();
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
            <span class="sname">${esc(c.emoji || '📚')} ${esc(c.name)}<small>${pluralize((c.wishlist || []).length, 'book')} on the list</small></span>
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
        toast(added.length ? `Added to ${added.join(', ')}` : `Removed from ${removed.join(', ')}`);
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
          <p class="fhint">${ct.own ? 'Same time as your last meeting.' : 'Default time: 7:30 PM.'} Two weeks after your latest meeting.</p>
        </section>
        <section class="fcard">
          <div class="kicker">3 · Where</div>
          <label class="fl">Place<input id="pl-place" maxlength="60" placeholder="Someone's living room" value="${esc(lastMeeting ? lastMeeting.place : '')}"></label>
          <label class="fl">A note for the group <span class="opt">optional</span><input id="pl-note" maxlength="80" placeholder="Bring a hot take and a pen"></label>
        </section>
        <section class="fcard">
          <div class="kicker">4 · On the table <span class="opt">optional</span></div>
          <div class="frow">
            <label class="fl">Who is bringing food<input id="pl-who" maxlength="40" list="pl-who-list" placeholder="Name"></label>
            <label class="fl">What they're bringing<input id="pl-food" maxlength="60" placeholder="Food"></label>
          </div>
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
            <div class="sline"><span class="sname">${esc(c.emoji || '📚')} ${esc(c.name)}</span><span class="schip">${d ? relDay(d.toISOString()) : 'Pick a date'}</span></div>
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
      const who = $$('pl-who').value.trim(), food = $$('pl-food').value.trim();
      if (!!who !== !!food) { toast('Add both a name and a food'); return; }
      const same = x => normTitle(x.title) === normTitle(book.title);
      c.meetings.push({ date: d.toISOString(), place: $$('pl-place').value.trim() || 'TBD', note: $$('pl-note').value.trim(), going: [ME], out: [], table: who ? { name: who, food } : null, book: { title: book.title, author: book.author || 'Unknown author', pages: book.pages || null, coverId: book.coverId || undefined, key: book.key || '' } });
      c.wishlist = (c.wishlist || []).filter(x => !same(x));
      c.suggestions = (c.suggestions || []).filter(x => !same(x));
      if (c.upNext && same(c.upNext)) c.upNext = null;
      save(); fetchCovers(); close(); confetti(); toast('Meeting scheduled 🎉'); onDone();
    };
  }

  /* ---------- pick / suggest the next book ---------- */
  function setNextBook(c, b) {
    c.upNext = { title: b.title, author: b.author || 'Unknown author', pages: b.pages || null, coverId: b.coverId || undefined, key: b.key || '', by: ME, at: new Date().toISOString() };
    const same = x => normTitle(x.title) === normTitle(b.title);
    c.wishlist = (c.wishlist || []).filter(x => !same(x));
    c.suggestions = (c.suggestions || []).filter(x => !same(x));
    save(); fetchCovers();
  }
  function openPicker(c, onChange, opts = {}) {
    const root = document.createElement('div');
    root.className = 'sheet-backdrop';
    root.innerHTML = `
      <div class="sheet picker" role="dialog" aria-modal="true" aria-label="Choose the next book">
        <div class="kicker">${esc(c.name)}</div>
        <h2>${opts.select ? 'Choose the book' : 'Choose the next book'}</h2>
        <div class="tabs" role="tablist">
          <button type="button" class="tab2 on" data-tab="list">Our list</button>
          <button type="button" class="tab2" data-tab="rec">Recommended</button>
          <button type="button" class="tab2" data-tab="search">Search</button>
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
    const row = (b, i) => `
      <li class="prow">
        <span class="thumb">${b.coverId ? coverImg(b.coverId, b.title) : ''}<em>${initial(b.title)}</em></span>
        <div class="winfo"><div class="wtitle">${esc(b.title)}</div><div class="by">${esc(b.author)}${b.pages ? ` · ${b.pages} pages` : ''}</div></div>
        <div class="sact">${opts.select ? '' : `<button type="button" class="mini-link" data-suggest="${i}" ${suggested(b) ? 'disabled' : ''}>${suggested(b) ? 'Suggested ✓' : 'Suggest'}</button>`}<button type="button" class="btn small" data-choose="${i}">${opts.select ? 'Select' : 'Pick'}</button></div>
      </li>`;
    const show = (list, note, into = body) => {
      items = list;
      into.innerHTML = (note ? `<p class="fhint">${note}</p>` : '') + (list.length ? `<ul class="plist">${list.map(row).join('')}</ul>` : '<p class="muted-line">Nothing to show here yet.</p>');
    };
    body.addEventListener('click', e => {
      const sg = e.target.closest('[data-suggest]'), pk = e.target.closest('[data-choose]');
      if (sg && !sg.disabled) {
        const b = items[+sg.dataset.suggest];
        (c.suggestions = c.suggestions || []).push({ id: 's' + Date.now(), title: b.title, author: b.author, pages: b.pages, coverId: b.coverId, key: b.key, by: ME, votes: [ME] });
        save(); fetchCovers();
        sg.disabled = true; sg.textContent = 'Suggested ✓';
        toast(`Suggested ${b.title}`); onChange();
      }
      if (pk) {
        const b = items[+pk.dataset.choose];
        if (opts.select) { close(); opts.select(b); return; }
        setNextBook(c, b); close(); onChange(); confetti(); toast(`Up next: ${b.title}`);
      }
    });

    async function render(tab) {
      const mine = ++tok;
      if (tab === 'list') {
        let pool = (c.wishlist || []).map(w => ({ ...w }));
        if (opts.select) pool = [...(c.upNext ? [c.upNext] : []), ...[...(c.suggestions || [])].sort((a, b) => b.votes.length - a.votes.length), ...pool];
        const seen = new Set();
        const list = pool.filter(b => { const k = normTitle(b.title); if (seen.has(k)) return false; seen.add(k); return true; }).map(w => norm({ ...w }));
        show(list, list.length ? (opts.select ? 'Your up-next pick, suggestions and Want to read list.' : 'From your Want to read list.') : '');
        if (!list.length) body.innerHTML = '<p class="muted-line">Your list is empty. Add books from Browse, then pick one here.</p>';
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
        body.querySelector('#pk-q').focus();
      }
    }
    root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
      root.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b));
      render(b.dataset.tab);
    });
    render('list');
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
      ${d.ratings_average ? `<div class="brate">${ratingLine(d.ratings_average, d.ratings_count)}</div>` : ''}
      <div class="bpages">${d.number_of_pages_median ? `${d.number_of_pages_median} pages` : 'Page count not listed'}</div>
      ${lists.length ? `<div class="bflag">On ${lists.length === 1 ? esc(lists[0].name) + "'s" : 'a'} list</div>` : ''}
      <button type="button" class="mini-link" data-addlist data-title="${esc(d.title)}" data-author="${esc(au)}" data-pages="${d.number_of_pages_median || ''}" data-cover="${d.cover_i || ''}" data-key="${esc(d.key || '')}">Add to list</button>
    </li>`;
  }
  function browse() {
    const bs = browseState;
    app.innerHTML = `
      <section class="page-head"><div class="kicker">Discover</div><h1>Find a book 🔎</h1></section>
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
        return `<li class="lp-row"><span><b>${esc(c.emoji || '📚')} ${esc(c.name)}</b><small>${pluralize((c.wishlist || []).length, 'book')} on the list</small></span><button type="button" class="lp-btn ${on ? 'on' : ''}" data-club="${c.id}" aria-pressed="${on}">${on ? '✓ On the list' : '+ Add to list'}</button></li>`;
      }).join('')}</ul>` : '<p class="muted-line">Create a club first to keep a reading list.</p>';
      el.querySelectorAll('[data-club]').forEach(b => b.onclick = () => {
        const c = state.clubs.find(x => x.id === b.dataset.club);
        c.wishlist = c.wishlist || [];
        const i = c.wishlist.findIndex(w => normTitle(w.title) === normTitle(book.title));
        if (i >= 0) { c.wishlist.splice(i, 1); toast(`Removed from ${c.name}'s list`); }
        else {
          c.wishlist.push({ id: 'w' + Date.now(), title: book.title, author: book.author, pages: book.pages || null, coverId: book.cover || undefined, key: book.key || '', addedAt: new Date().toISOString() });
          toast(`Added to ${c.name}'s list`);
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
  function route() {
    ui = { table: false, quote: false };
    const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
    let tab = 'home';
    const cm = path.match(/^club\/([^/]+)(?:\/book\/([^/]+))?$/);
    if (cm) { if (cm[2]) pastBook(cm[1], cm[2]); else club(cm[1]); }
    else if (path === 'calendar') { tab = 'calendar'; calendar(); }
    else if (path === 'notifications') { tab = 'notifications'; notifications(); }
    else if (path === 'stats') { tab = 'stats'; stats(); }
    else if (path === 'browse/book') { tab = 'browse'; bookDetail(Object.fromEntries(new URLSearchParams(qs || ''))); }
    else if (path === 'browse') { tab = 'browse'; browse(); }
    else if (path === 'new') newClub(Object.fromEntries(new URLSearchParams(qs || '')));
    else home();
    document.querySelectorAll('.tab').forEach(a => {
      if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    updateBadge();
    scrollTo(0, 0);
  }
  addEventListener('hashchange', route);
  route();
  fetchCovers();
})();
