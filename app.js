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

  // hand-picked, slightly dusty jewel tones (white text stays readable on all)
  const GRADS = [
    'linear-gradient(150deg,#4a56b0,#8a63c2)',  // indigo to orchid
    'linear-gradient(150deg,#2f67a6,#3f9bb0)',  // ocean to seafoam
    'linear-gradient(150deg,#7c4ca6,#c0699b)',  // plum to rose
    'linear-gradient(150deg,#2b7a86,#4aa28d)',  // lagoon to mint
    'linear-gradient(150deg,#a9507a,#d27a62)',  // berry to coral
    'linear-gradient(150deg,#3b4f9f,#6b8fd0)',  // twilight to sky
  ];
  const gradFor = i => GRADS[((i % GRADS.length) + GRADS.length) % GRADS.length];
  const clubGrad = c => gradFor(state.clubs.indexOf(c));
  const pastGrad = (c, i) => gradFor(state.clubs.indexOf(c) + 1 + i);
  /* book covers via Open Library, with a typographic fallback */
  const coverImg = (id, title) => `<img src="https://covers.openlibrary.org/b/id/${id}-M.jpg" alt="Cover of ${esc(title)}" onerror="this.remove()">`;
  const coverHTML = (b, key) => `<span class="cover" data-cover="${esc(key)}">${b.coverId ? coverImg(b.coverId, b.title) : ''}<em>${esc(b.title)}</em></span>`;
  async function fetchCovers() {
    const items = [];
    state.clubs.forEach(c => { items.push({ b: c.book, key: c.id }); (c.history || []).forEach(h => items.push({ b: h, key: `${c.id}:${h.id}` })); });
    for (const { b, key } of items) {
      try {
        if (b.coverId === undefined) {
          const q = new URLSearchParams({ title: b.title, author: b.author, limit: 1, fields: 'cover_i' });
          const r = await fetch('https://openlibrary.org/search.json?' + q);
          const d = await r.json();
          b.coverId = (d.docs && d.docs[0] && d.docs[0].cover_i) || 0;
          save();
          if (b.coverId) document.querySelectorAll(`.cover[data-cover="${key}"]`).forEach(el => { if (!el.querySelector('img')) el.insertAdjacentHTML('afterbegin', coverImg(b.coverId, b.title)); });
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
    return seed();
  }
  function migrate(s) {
    s.read = s.read || {};
    s.friends = s.friends || [];
    s.clubs.forEach(c => {
      c.quotes = c.quotes || [];
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
  const avatar = (m, i) => `<span class="av ${m.id === ME ? 'you' : ''}">${initial(m.name)}</span>`;
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

  const nextMeeting = c => (c.meetings || []).filter(m => new Date(m.date) >= Date.now()).sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  const nextTime = c => { const m = nextMeeting(c); return m ? new Date(m.date).getTime() : Infinity; };

  /* ---------- home ---------- */
  function home() {
    const clubs = [...state.clubs].sort((a, b) => nextTime(a) - nextTime(b));
    const first = clubs[0] && nextMeeting(clubs[0]);
    app.innerHTML = `
      <section class="page-head head-row">
        <div><div class="kicker">${pluralize(clubs.length, 'club')}</div><h1>Your clubs</h1></div>
        <a class="newclub" href="#/new">+ New club</a>
      </section>
      <div class="stories">
        ${clubs.map(c => {
          const m = nextMeeting(c);
          return `
          <a class="poster" href="#/club/${c.id}" style="background:${clubGrad(c)}">
            <div class="p-top"><span class="p-club">${esc(c.name)}</span><span class="chip">${m ? relDay(m.date) : 'Unscheduled'}</span></div>
            <div class="p-main">
              <div class="p-text">
                <h2>${esc(c.book.title)}</h2>
                <div class="p-date">${m ? `${fmtShort(m.date)} · ${fmtTime(m.date)}` : 'No meeting yet'}</div>
              </div>
              ${coverHTML(c.book, c.id)}
            </div>
            <div class="p-foot">
              <span class="stack">${c.members.map(avatar).join('')}</span>
              ${(c.history || []).length ? `<span class="p-hist">${pluralize(c.history.length, 'past read')} ›</span>` : ''}
            </div>
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

    app.innerHTML = `
      <a class="back" href="#/">‹ All clubs</a>
      <section class="club-head">
        <div class="kicker">Book club</div>
        <h1>${esc(c.name)}</h1>
        <p class="deck" style="margin-top:0">${esc(c.book.author)} · ${c.book.pages} pages</p>
      </section>

      ${meet ? `
      <section class="poster feature" aria-label="Next meeting" style="background:${clubGrad(c)}">
        <span class="chip">Next meeting · ${relDay(meet.date)}</span>
        <div class="p-main">
          <div class="p-text">
            <h2>${esc(c.book.title)}</h2>
            <div class="when">${fmtLong(meet.date)} · ${fmtTime(meet.date)}<br>${esc(meet.place)}</div>
          </div>
          ${coverHTML(c.book, c.id)}
        </div>
        ${meet.note ? `<p class="note">${esc(meet.note)}</p>` : ''}
        <div class="rsvp">
          <button data-rsvp="yes" class="${rsvp === 'yes' ? 'on' : ''}">Going</button>
          <button data-rsvp="no" class="${rsvp === 'no' ? 'on' : ''}">Can't make it</button>
        </div>
        <div class="going">
          <div class="kicker">Who's going · ${going.length}</div>
          <ul class="going-list">${going.map(g => `<li>${avatar({ id: g, name: memberName(c, g) })}${esc(memberName(c, g))}</li>`).join('') || '<li class="none">No one yet</li>'}</ul>
        </div>
        <div class="potluck">
          <div class="kicker">On the table</div>
          ${tableHTML}
        </div>
      </section>` : `<section class="poster feature" style="background:${clubGrad(c)}"><span class="chip">Next meeting</span><h2>Nothing scheduled</h2></section>`}

      ${invited.length ? `
      <div class="sec"><h2>Invited friends</h2><span class="kicker">${invited.length}</span></div>
      <ul class="invites">${invited.map(m => `
        <li><span class="who">${avatar(m)}<b>${esc(m.name)}</b>${m.name !== fmtPhone(m.phone) ? `<small>${esc(fmtPhone(m.phone))}</small>` : ''}</span><a class="mini-link" href="${smsHref(m, c, meet)}">Text invite</a></li>`).join('')}</ul>` : ''}

      <div class="sec"><h2>Favorite quotes</h2><span class="kicker">${quotes.length}</span></div>
      ${quoteForm}
      ${quotes.length ? `<ul class="quotes">${quotes.map(q => `
        <li class="quote">
          <blockquote>“${esc(q.text)}”</blockquote>
          <div class="by">— ${esc(memberName(c, q.author))}${q.author === ME && !ui.quote ? ' <button class="linkbtn" data-edit-quote>Edit</button>' : ''}</div>
        </li>`).join('')}</ul>` : ''}

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

      <div class="sec"><h2>Past reads</h2><span class="kicker">${hist.length ? `${pluralize(hist.length, 'book')} · avg ★ ${(hist.reduce((a, h) => a + avgOf(h), 0) / hist.length).toFixed(1)}` : '0 books'}</span></div>
      ${hist.length ? `<div class="stories">${hist.map((h, i) => pastPoster(c, h, i)).join('')}</div>` : '<p class="muted-line">Books you finish together will show up here.</p>'}`;

    const rerender = () => club(id);

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
  function pastPoster(c, h, i) {
    const raters = c.members.filter(m => (h.ratings || {})[m.id] > 0);
    return `
      <a class="poster past" href="#/club/${c.id}/book/${h.id}" style="background:${pastGrad(c, i)}">
        <div class="p-top"><span class="p-club">${fmt(h.date, { month: 'long', year: 'numeric' })}</span><span class="chip">★ ${avgText(h)} club avg</span></div>
        <div class="p-main">
          <div class="p-text"><h2>${esc(h.title)}</h2><div class="p-date">${esc(h.author)}</div></div>
          ${coverHTML(h, `${c.id}:${h.id}`)}
        </div>
        <div class="p-foot">
          <span class="rchips">${raters.map(m => `<span class="rchip">${avatar(m)}<b>★ ${h.ratings[m.id]}</b></span>`).join('') || '<span class="p-hist">No ratings yet</span>'}</span>
        </div>
      </a>`;
  }

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
        <p class="deck" style="margin-top:0">${esc(h.author)} · ${h.pages} pages</p>
      </section>

      <section class="poster feature" style="background:${pastGrad(c, idx)}">
        <span class="chip">Met ${fmtShort(h.date)}</span>
        <div class="p-main">
          <div class="p-text">
            <h2>${esc(h.title)}</h2>
            <div class="when">${fmtLong(h.date)} · ${fmtTime(h.date)}${h.place ? `<br>${esc(h.place)}` : ''}</div>
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
      (c.meetings || []).forEach(m => { const d = new Date(m.date); if (d < now && hd.has(dkey(d))) return; all.push({ c, m, d, href: `#/club/${c.id}` }); });
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
        <div><h2>${esc(e.c.name)}</h2><p>${e.title ? `${esc(e.title)} · ` : ''}${showDate ? `${fmtShort(e.m.date)} · ` : ''}${fmtTime(e.m.date)}${e.m.place ? ` · ${esc(e.m.place)}` : ''}</p></div>
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
        if (n <= 21) upcoming.push({ id: `cd:${c.id}:${m.date}`, kicker: 'Countdown', title: `${c.name} meets ${relPhrase(m.date)}`, body: when, time: relDay(m.date), club: c.id, sort: t0, pri: 1 });
        if (n <= 7) {
          const t = m.table;
          if (t) {
            const mine = /^(you|me)$/i.test(t.name.trim());
            upcoming.push({ id: `food:${c.id}:${m.date}:${t.name}:${t.food}`, kicker: 'Reminder', title: mine ? `Bring ${t.food} to ${c.name}` : `${t.name} is bringing ${t.food}`, body: mine ? `You're on food for ${fmtShort(m.date)}. Doors at ${fmtTime(m.date)}.` : `For ${c.name} on ${fmtShort(m.date)}.`, time: relDay(m.date), club: c.id, sort: t0, pri: 0 });
          } else {
            upcoming.push({ id: `food:${c.id}:${m.date}:none`, kicker: 'Reminder', title: `No one is bringing food to ${c.name} yet`, body: 'Add who is bringing something on the club page.', time: relDay(m.date), club: c.id, sort: t0, pri: 0 });
          }
        }
      }
      (c.updates || []).filter(u => u.author !== ME).forEach(u => updates.push({
        id: `up:${u.id}`, kicker: `Club update · ${c.name}`, title: `${memberName(c, u.author)} posted`, body: u.text, time: timeAgo(u.at), club: c.id, sort: new Date(u.at).getTime(),
      }));
    });
    upcoming.sort((a, b) => a.sort - b.sort || a.pri - b.pri);
    updates.sort((a, b) => b.sort - a.sort);
    return { upcoming, updates };
  }
  const unreadCount = () => { const n = buildNotifs(); return [...n.upcoming, ...n.updates].filter(x => !state.read[x.id]).length; };

  function notifications() {
    const { upcoming, updates } = buildNotifs();
    const item = n => `
      <li><a class="notif ${state.read[n.id] ? '' : 'unread'}" href="#/club/${n.club}" data-nid="${esc(n.id)}">
        <span class="pip"></span>
        <div><div class="kicker">${esc(n.kicker)}</div><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p></div>
        <span class="time">${esc(n.time)}</span>
      </a></li>`;
    const unread = unreadCount();
    app.innerHTML = `
      <section class="page-head">
        <div class="kicker">Alerts</div>
        <h1>What's new</h1>
        <p class="deck">${unread ? `${unread} unread.` : 'You are all caught up.'} ${unread ? '<button class="linkbtn" id="read-all">Mark all as read</button>' : ''}</p>
      </section>
      <div class="sec"><h2>Coming up</h2></div>
      <ul class="notifs">${upcoming.map(item).join('') || '<li class="muted-line">Nothing coming up.</li>'}</ul>
      <div class="sec"><h2>From your clubs</h2></div>
      <ul class="notifs">${updates.map(item).join('') || '<li class="muted-line">No updates yet.</li>'}</ul>`;

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
        <h1>By the numbers</h1>
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
          <label class="fl">Club name<input name="name" maxlength="40" placeholder="e.g. Plot Twist Society"></label>
        </section>
        <button class="btn big">Create club</button>
      </form>`;

    const form = $('#nc-form');
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
        history: [], updates: [], quotes: [],
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

  /* ---------- browse ---------- */
  const SHELVES = [['Popular', 'subject:fiction'], ['Mystery', 'subject:mystery'], ['Fantasy', 'subject:fantasy'], ['Sci-fi', 'subject:science_fiction'], ['Historical', 'subject:historical_fiction'], ['Romance', 'subject:romance'], ['Classics', 'subject:classics'], ['Nonfiction', 'subject:nonfiction']];
  const PICKS = [['Piranesi', 'Susanna Clarke'], ['Circe', 'Madeline Miller'], ['Rebecca', 'Daphne du Maurier'], ['The Secret History', 'Donna Tartt'], ['Giovanni\'s Room', 'James Baldwin'], ['Normal People', 'Sally Rooney'], ['Gone Girl', 'Gillian Flynn'], ['The Thursday Murder Club', 'Richard Osman']];
  const browseState = { shelf: 0, q: '' };
  const browseCache = {};
  async function searchBooks(query) {
    const u = new URLSearchParams({ q: query, limit: 20, fields: 'title,author_name,cover_i,number_of_pages_median', language: 'eng' });
    if (query.startsWith('subject:')) u.set('sort', 'rating');
    const r = await fetch('https://openlibrary.org/search.json?' + u);
    const docs = ((await r.json()).docs || []).filter(d => d.title);
    return docs.sort((a, b) => !!b.cover_i - !!a.cover_i).slice(0, 18);
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
    const card = d => {
      const p = new URLSearchParams({ title: d.title });
      const au = (d.author_name || [])[0];
      if (au) p.set('author', au);
      if (d.number_of_pages_median) p.set('pages', d.number_of_pages_median);
      if (d.cover_i) p.set('cover', d.cover_i);
      return `<li class="bcard">
        <div class="bcover">${d.cover_i ? coverImg(d.cover_i, d.title) : ''}<em>${esc(d.title)}</em></div>
        <div class="btitle">${esc(d.title)}</div>
        <div class="bauthor">${esc(au || 'Unknown author')}${d.number_of_pages_median ? ` · ${d.number_of_pages_median} pp` : ''}</div>
        <a class="mini-link" href="#/new?${p}">Start a club</a>
      </li>`;
    };
    const show = (docs, note) => {
      out.innerHTML = (note ? `<p class="muted-line">${note}</p>` : '') + (docs.length ? `<ul class="bgrid">${docs.map(card).join('')}</ul>` : '<p class="muted-line">No matches. Try another search.</p>');
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

  /* ---------- chrome ---------- */
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('show'), 2000);
  }
  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#9aa7f0', '#c4a3ec', '#f2a7c3', '#ffd49a', '#9ad9d0'];
    for (let i = 0; i < 56; i++) {
      const p = document.createElement('i');
      p.className = 'confetti';
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = 1.5 + Math.random() * 1.5 + 's';
      p.style.animationDelay = Math.random() * .25 + 's';
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 3500);
    }
  }
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
