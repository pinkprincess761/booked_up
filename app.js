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
  const meeting = (d, h, place, note, going = [], potluck = {}) => ({ date: at(d, h), place, note, going, maybe: [], potluck });

  const GRADS = [
    'linear-gradient(145deg,#4b1fd1,#c2287f 60%,#ff6a3d)',
    'linear-gradient(145deg,#0f4cdb,#7b4dff 55%,#ff3d8b)',
    'linear-gradient(145deg,#0b5f73,#1d8f6e 60%,#e0a11b)',
    'linear-gradient(145deg,#b3261e,#e8542f 55%,#ff9f1c)',
  ];
  const grad = c => GRADS[Math.max(0, state.clubs.indexOf(c)) % GRADS.length];
  /* book covers via Open Library, with a typographic fallback */
  const coverImg = (id, title) => `<img src="https://covers.openlibrary.org/b/id/${id}-M.jpg" alt="Cover of ${esc(title)}" onerror="this.remove()">`;
  const coverHTML = c => `<span class="cover" data-club="${c.id}">${c.book.coverId ? coverImg(c.book.coverId, c.book.title) : ''}<em>${esc(c.book.title)}</em></span>`;
  async function fetchCovers() {
    for (const c of state.clubs) {
      if (c.book.coverId !== undefined) continue;
      try {
        const q = new URLSearchParams({ title: c.book.title, author: c.book.author, limit: 1, fields: 'cover_i' });
        const r = await fetch('https://openlibrary.org/search.json?' + q);
        const d = await r.json();
        c.book.coverId = (d.docs && d.docs[0] && d.docs[0].cover_i) || 0;
        save();
        if (c.book.coverId) document.querySelectorAll(`.cover[data-club="${c.id}"]`).forEach(el => { if (!el.querySelector('img')) el.insertAdjacentHTML('afterbegin', coverImg(c.book.coverId, c.book.title)); });
      } catch (e) { /* offline: try again next load */ }
    }
  }
  const ICON_BOOK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5C10.5 5.3 8 5 4 5v13c4 0 6.5.3 8 1.5 1.5-1.2 4-1.5 8-1.5V5c-4 0-6.5.3-8 1.5z"/><path d="M12 6.5v13"/></svg>';
  const ICON_PREV = '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>';
  const ICON_NEXT = '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>';

  const seed = () => ({
    read: {},
    clubs: [
      {
        id: 'c1', name: 'Plot Twist Society',
        book: { title: 'The Secret History', author: 'Donna Tartt', pages: 559 },
        meetings: [
          meeting(-25, 19, "Maya's rooftop", '', ['me', 'maya', 'jo', 'dev']),
          meeting(3, 19, "Maya's rooftop", 'Bring a hot take and a pen.', ['me', 'maya', 'jo'], { maya: 'Cheese board', jo: 'Sparkling water' }),
          meeting(31, 19, 'Dev\'s apartment', '', []),
        ],
        members: [
          { id: 'me', name: 'You', page: 312 }, { id: 'maya', name: 'Maya', page: 480 },
          { id: 'jo', name: 'Jo', page: 205 }, { id: 'dev', name: 'Dev', page: 559 }, { id: 'sam', name: 'Sam', page: 90 },
        ],
        history: [
          { title: 'Rebecca', author: 'Daphne du Maurier', pages: 449, rating: 5, finishedAt: at(-60) },
          { title: 'Gone Girl', author: 'Gillian Flynn', pages: 432, rating: 3, finishedAt: at(-95) },
          { title: 'The Thursday Murder Club', author: 'Richard Osman', pages: 382, rating: 4, finishedAt: at(-130) },
        ],
        updates: [
          { id: 'u1', author: 'maya', text: 'Moving the start to 7:30. I am picking up the wine. Please read through Part Two.', at: ago(2) },
          { id: 'u2', author: 'jo', text: 'No spoilers about the ending in the group chat. I am begging.', at: ago(26) },
        ],
      },
      {
        id: 'c2', name: 'Dragons & Dumplings',
        book: { title: 'Piranesi', author: 'Susanna Clarke', pages: 272 },
        meetings: [
          meeting(-20, 18, 'Lucky Dumpling House', '', ['ali', 'rae']),
          meeting(6, 18, 'Lucky Dumpling House', 'Dinner first, discussion after.', ['ali'], { me: 'Sesame noodles', ali: 'Pork dumplings' }),
          meeting(34, 18, 'Rae\'s place', '', []),
        ],
        members: [
          { id: 'me', name: 'You', page: 120 }, { id: 'ali', name: 'Ali', page: 272 },
          { id: 'rae', name: 'Rae', page: 198 }, { id: 'tom', name: 'Tom', page: 44 },
        ],
        history: [
          { title: 'Circe', author: 'Madeline Miller', pages: 393, rating: 5, finishedAt: at(-50) },
          { title: 'Mexican Gothic', author: 'Silvia Moreno-Garcia', pages: 301, rating: 3, finishedAt: at(-85) },
          { title: 'The Ocean at the End of the Lane', author: 'Neil Gaiman', pages: 181, rating: 4, finishedAt: at(-120) },
        ],
        updates: [
          { id: 'u3', author: 'ali', text: 'The reservation is under "Piranesi" at the back table.', at: ago(5) },
          { id: 'u4', author: 'tom', text: 'Still on page 44. Send encouragement.', at: ago(50) },
        ],
      },
      {
        id: 'c3', name: 'Sunday Sappho',
        book: { title: 'Real Life', author: 'Brandon Taylor', pages: 330 },
        meetings: [
          meeting(-14, 11, 'Blue Door Café', '', ['lu', 'kai', 'me']),
          meeting(14, 11, 'Blue Door Café', 'Brunch. Bring your annotated copies.', []),
        ],
        members: [
          { id: 'me', name: 'You', page: 15 }, { id: 'lu', name: 'Lu', page: 150 }, { id: 'kai', name: 'Kai', page: 88 },
        ],
        history: [
          { title: "Giovanni's Room", author: 'James Baldwin', pages: 169, rating: 5, finishedAt: at(-45) },
          { title: 'Normal People', author: 'Sally Rooney', pages: 266, rating: 4, finishedAt: at(-80) },
        ],
        updates: [
          { id: 'u5', author: 'lu', text: 'Brunch at 11. I will save the corner table by the window.', at: ago(30) },
        ],
      },
    ],
  });

  let state = load();
  function load() {
    try { const s = JSON.parse(localStorage.getItem(STORE)); if (s && s.clubs) return s; } catch (e) {}
    return seed();
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} }

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const app = $('#app');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (m, c) => Math.min(100, Math.round((m.page / c.book.pages) * 100));
  const initial = n => esc((n || '?').trim()[0].toUpperCase());
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

  const nextMeeting = c => (c.meetings || []).filter(m => new Date(m.date) >= Date.now()).sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  const nextTime = c => { const m = nextMeeting(c); return m ? new Date(m.date).getTime() : Infinity; };

  /* ---------- home ---------- */
  function home() {
    const clubs = [...state.clubs].sort((a, b) => nextTime(a) - nextTime(b));
    const first = clubs[0] && nextMeeting(clubs[0]);
    app.innerHTML = `
      <section class="page-head head-row">
        <div><div class="kicker">${pluralize(clubs.length, 'club')}</div><h1>Your clubs</h1></div>
        <button class="newclub" id="new-club-btn">+ New club</button>
      </section>
      <div class="stories">
        ${clubs.map(c => {
          const m = nextMeeting(c);
          const me = c.members.find(x => x.id === ME);
          const p = me ? pct(me, c) : 0;
          return `
          <a class="poster" href="#/club/${c.id}" style="background:${grad(c)}">
            <div class="p-top"><span class="p-club">${esc(c.name)}</span><span class="chip">${m ? relDay(m.date) : 'Unscheduled'}</span></div>
            <div class="p-main">
              <div class="p-text">
                <h2>${esc(c.book.title)}</h2>
                <div class="p-date">${m ? `${fmtShort(m.date)} · ${fmtTime(m.date)}` : 'No meeting yet'}</div>
              </div>
              ${coverHTML(c)}
            </div>
            <div class="p-foot">
              <span class="stack">${c.members.map(avatar).join('')}</span>
              <span class="p-prog"><span>${p}%</span><i><b style="width:${p}%"></b></i></span>
            </div>
          </a>`;
        }).join('') || '<p class="muted-line">No clubs yet. Start one with “New club”.</p>'}
      </div>`;
    $('#new-club-btn').onclick = openModal;
  }

  /* ---------- club ---------- */
  let timer;
  function club(id) {
    const c = state.clubs.find(x => x.id === id);
    if (!c) { location.hash = '#/'; return; }
    const meet = nextMeeting(c);
    if (meet) { meet.maybe = meet.maybe || []; meet.potluck = meet.potluck || {}; }
    const rsvp = meet ? (meet.going.includes(ME) ? 'yes' : meet.maybe.includes(ME) ? 'maybe' : '') : '';
    const me = c.members.find(m => m.id === ME);
    const potluck = meet ? Object.entries(meet.potluck) : [];
    const updates = [...(c.updates || [])].sort((a, b) => new Date(b.at) - new Date(a.at));

    app.innerHTML = `
      <a class="back" href="#/">‹ All clubs</a>
      <section class="club-head">
        <div class="kicker">Book club</div>
        <h1>${esc(c.name)}</h1>
        <p class="deck" style="margin-top:0">${esc(c.book.author)} · ${c.book.pages} pages</p>
      </section>

      ${meet ? `
      <section class="poster feature" aria-label="Next meeting" style="background:${grad(c)}">
        <span class="chip">Next meeting · ${relDay(meet.date)}</span>
        <div class="p-main">
          <div class="p-text">
            <h2>${esc(c.book.title)}</h2>
            <div class="when">${fmtLong(meet.date)} · ${fmtTime(meet.date)}<br>${esc(meet.place)}</div>
          </div>
          ${coverHTML(c)}
        </div>
        ${meet.note ? `<p class="note">${esc(meet.note)}</p>` : ''}
        <div class="countdown" id="countdown"></div>
        <div class="rsvp">
          <button data-rsvp="yes" class="${rsvp === 'yes' ? 'on' : ''}">Going</button>
          <button data-rsvp="maybe" class="${rsvp === 'maybe' ? 'on' : ''}">Maybe</button>
          <button data-rsvp="no" class="${!rsvp ? 'on' : ''}">Can't make it</button>
          <span class="count"><span class="stack">${meet.going.slice(0, 5).map(g => avatar({ id: g, name: memberName(c, g) })).join('')}</span>${meet.going.length} going</span>
        </div>
        <div class="potluck">
          <div class="kicker">On the table</div>
          <ul>${potluck.length ? potluck.map(([pid, item]) => `<li><b>${esc(memberName(c, pid))}</b>${esc(item)}</li>`).join('') : '<li class="empty-line">Nobody has signed up to bring anything yet.</li>'}</ul>
          <form class="inline-form" id="potluck-form">
            <input name="item" maxlength="60" placeholder="I'm bringing…" value="${esc(meet.potluck[ME] || '')}" aria-label="What you're bringing">
            <button class="btn">${meet.potluck[ME] ? 'Update' : 'Sign up'}</button>
          </form>
        </div>
      </section>` : `<section class="poster feature" style="background:${grad(c)}"><span class="chip">Next meeting</span><h2>Nothing scheduled</h2></section>`}

      ${me ? `
      <div class="sec"><h2>Your progress</h2><span class="kicker">${pct(me, c)}%</span></div>
      <div class="update">
        <div class="prog-num"><b id="pgnum">${me.page}</b> of ${c.book.pages} pages</div>
        <div class="prog-track"><i class="prog-fill" data-w="${pct(me, c)}%"></i></div>
        <input type="range" id="pg" min="0" max="${c.book.pages}" value="${me.page}" aria-label="Pages read">
      </div>` : ''}

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
      </ul>`;

    requestAnimationFrame(() => requestAnimationFrame(() => { const f = $('.prog-fill'); if (f) f.style.width = f.dataset.w; }));

    // countdown
    clearInterval(timer);
    if (meet) {
      const tick = () => {
        const el = $('#countdown');
        if (!el) { clearInterval(timer); return; }
        const s = Math.max(0, Math.floor((new Date(meet.date) - Date.now()) / 1000));
        const parts = [['Days', Math.floor(s / 86400)], ['Hours', Math.floor(s % 86400 / 3600)], ['Minutes', Math.floor(s % 3600 / 60)], ['Seconds', s % 60]];
        el.innerHTML = parts.map(([l, v]) => `<div class="tick"><b>${String(v).padStart(2, '0')}</b><span>${l}</span></div>`).join('');
      };
      tick();
      timer = setInterval(tick, 1000);
    }

    app.querySelectorAll('[data-rsvp]').forEach(b => b.onclick = () => {
      const v = b.dataset.rsvp;
      meet.going = meet.going.filter(x => x !== ME);
      meet.maybe = meet.maybe.filter(x => x !== ME);
      if (v === 'yes') meet.going.push(ME);
      if (v === 'maybe') meet.maybe.push(ME);
      save(); club(id);
      if (v === 'yes') confetti();
      toast(v === 'yes' ? "You're on the list" : v === 'maybe' ? 'Marked as maybe' : 'Response saved');
    });

    const pf = $('#potluck-form');
    if (pf) pf.onsubmit = e => {
      e.preventDefault();
      const item = new FormData(pf).get('item').trim();
      if (item) meet.potluck[ME] = item; else delete meet.potluck[ME];
      save(); club(id);
      toast(item ? 'Added to the table' : 'Removed from the table');
    };

    const pg = $('#pg');
    if (pg) {
      pg.oninput = () => { $('#pgnum').textContent = pg.value; };
      pg.onchange = () => {
        me.page = +pg.value;
        if (me.page >= c.book.pages && !c.book.finishedAt) c.book.finishedAt = new Date().toISOString();
        save(); club(id);
        if (me.page >= c.book.pages) { confetti(); toast('Finished. Rate it in Stats.'); }
      };
    }

    $('#note-form').onsubmit = e => {
      e.preventDefault();
      const text = new FormData(e.target).get('text').trim();
      if (!text) return;
      (c.updates = c.updates || []).push({ id: 'u' + Date.now(), author: ME, text, at: new Date().toISOString() });
      save(); club(id); toast('Posted');
    };
  }

  /* ---------- calendar ---------- */
  let cal = null;
  function calendar() {
    const now = new Date();
    if (!cal) cal = { y: now.getFullYear(), m: now.getMonth(), sel: dkey(now) };
    const all = [];
    state.clubs.forEach(c => (c.meetings || []).forEach(m => all.push({ c, m, d: new Date(m.date) })));
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
      <a class="event" href="#/club/${e.c.id}">
        <div class="date"><span>${e.d.toLocaleDateString(undefined, { month: 'short' })}</span><b>${e.d.getDate()}</b></div>
        <div><h2>${esc(e.c.name)}</h2><p>${showDate ? `${fmtShort(e.m.date)} · ` : ''}${fmtTime(e.m.date)} · ${esc(e.m.place)}</p></div>
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
        const t = new Date(m.date).getTime();
        const when = `${fmtLong(m.date)} at ${fmtTime(m.date)} · ${m.place}`;
        if (n <= 21) upcoming.push({ id: `cd:${c.id}:${m.date}`, kicker: 'Countdown', title: `${c.name} meets ${relPhrase(m.date)}`, body: when, time: relDay(m.date), club: c.id, sort: t, pri: 1 });
        if (n <= 7) {
          const pot = m.potluck || {};
          if (pot[ME]) {
            upcoming.push({ id: `food:${c.id}:${m.date}:${pot[ME]}`, kicker: 'Reminder', title: `Bring ${pot[ME]} to ${c.name}`, body: `You signed up for ${fmtShort(m.date)}. Doors at ${fmtTime(m.date)}.`, time: relDay(m.date), club: c.id, sort: t, pri: 0 });
          } else {
            const others = Object.entries(pot).map(([id, item]) => `${memberName(c, id)}: ${item}`).join(' · ');
            upcoming.push({ id: `food:${c.id}:${m.date}:none`, kicker: 'Reminder', title: `Sign up to bring something to ${c.name}`, body: others ? `So far: ${others}.` : 'Nobody has claimed anything yet.', time: relDay(m.date), club: c.id, sort: t, pri: 0 });
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
      (c.history || []).forEach((h, i) => out.push({ ...h, club: c.name, ref: h, key: `${c.id}:${i}` }));
      const me = c.members.find(m => m.id === ME);
      if (me && me.page >= c.book.pages) out.push({ ...c.book, finishedAt: c.book.finishedAt || new Date().toISOString(), club: c.name, ref: c.book, key: `${c.id}:cur` });
    });
    return out.sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));
  }

  function stats() {
    const books = readBooks();
    const pages = books.reduce((s, b) => s + b.pages, 0);
    const rated = books.filter(b => b.rating);
    const avg = rated.length ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1) : '—';
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

      <div class="sec"><h2>The shelf</h2><span class="kicker">Tap stars to rate</span></div>
      <ul class="shelf">
        ${books.map(b => `
          <li class="book">
            <div><h3>${esc(b.title)}</h3><div class="by">${esc(b.author)}</div></div>
            <div class="stars" role="group" aria-label="Rating for ${esc(b.title)}">
              ${[1, 2, 3, 4, 5].map(n => `<button data-key="${esc(b.key)}" data-r="${n}" class="${(b.rating || 0) >= n ? 'on' : ''}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}
            </div>
            <div class="meta">${esc(b.club)} · ${b.pages} pp · ${fmt(b.finishedAt, { month: 'short', year: 'numeric' })}</div>
          </li>`).join('') || '<li class="muted-line">Finish a book to see it here.</li>'}
      </ul>`;

    app.querySelectorAll('.stars button').forEach(btn => btn.onclick = () => {
      const b = books.find(x => x.key === btn.dataset.key);
      const r = +btn.dataset.r;
      b.ref.rating = b.ref.rating === r ? 0 : r;
      save(); stats();
    });
  }

  /* ---------- new club ---------- */
  function openModal() {
    const root = $('#modal-root');
    const soon = new Date(Date.now() + 7 * DAY);
    soon.setHours(19, 0, 0, 0);
    const local = new Date(soon - soon.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
    root.innerHTML = `
      <div class="backdrop"><form class="modal" aria-label="New club">
        <div class="kicker">New club</div>
        <h2>Start a club</h2>
        <label>Club name<input name="name" required maxlength="40" placeholder="Plot Twist Society"></label>
        <div class="row">
          <label>Book<input name="title" required maxlength="60" placeholder="Title"></label>
          <label>Author<input name="author" maxlength="60" placeholder="Author"></label>
        </div>
        <div class="row">
          <label>Pages<input name="pages" type="number" min="1" max="5000" required value="300"></label>
          <label>First meeting<input name="date" type="datetime-local" required value="${local}"></label>
        </div>
        <label>Where<input name="place" maxlength="60" placeholder="Someone's living room"></label>
        <div class="actions"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn">Create</button></div>
      </form></div>`;
    const close = () => { root.innerHTML = ''; };
    root.querySelector('[data-close]').onclick = close;
    root.querySelector('.backdrop').onclick = e => { if (e.target.classList.contains('backdrop')) close(); };
    root.querySelector('form').onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const id = 'c' + Date.now();
      state.clubs.push({
        id, name: f.get('name').trim(),
        book: { title: f.get('title').trim(), author: (f.get('author') || 'Unknown').trim(), pages: +f.get('pages') },
        meetings: [{ date: new Date(f.get('date')).toISOString(), place: (f.get('place') || 'TBD').trim(), note: '', going: [ME], maybe: [], potluck: {} }],
        members: [{ id: ME, name: 'You', page: 0 }],
        history: [], updates: [],
      });
      save(); close(); updateBadge(); fetchCovers();
      location.hash = `#/club/${id}`;
    };
    root.querySelector('input').focus();
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
    const colors = ['#ff3d8b', '#ff8a3d', '#ffc53d', '#7b4dff', '#2bb6ff'];
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
    clearInterval(timer);
    const h = location.hash.replace(/^#\/?/, '');
    let tab = 'home';
    if (h.startsWith('club/')) club(h.slice(5));
    else if (h === 'calendar') { tab = 'calendar'; calendar(); }
    else if (h === 'notifications') { tab = 'notifications'; notifications(); }
    else if (h === 'stats') { tab = 'stats'; stats(); }
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
