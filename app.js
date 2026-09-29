(() => {
  'use strict';

  const STORE = 'booked_up_v1';
  const COLORS = ['#ff4fa3', '#ff9a3c', '#c8ff5a', '#5ee7ff', '#b28dff', '#ffd23c'];
  const ACCENTS = [
    'linear-gradient(90deg,#ff4fa3,#ff9a3c)',
    'linear-gradient(90deg,#8b5cf6,#5ee7ff)',
    'linear-gradient(90deg,#c8ff5a,#5ee7ff)',
    'linear-gradient(90deg,#ff9a3c,#ffd23c)',
  ];
  const EMOJIS = ['📚', '🔮', '🕵️', '🌶️', '🐉', '💌', '🌙', '🍷'];
  const ME = 'me';

  const daysFromNow = (d, h = 19) => {
    const t = new Date();
    t.setDate(t.getDate() + d);
    t.setHours(h, 0, 0, 0);
    return t.toISOString();
  };

  const seed = () => ({
    clubs: [
      {
        id: 'c1', name: 'Plot Twist Society', emoji: '🕵️', accent: 0,
        book: { title: 'The Secret History', author: 'Donna Tartt', pages: 559 },
        meeting: { date: daysFromNow(3), place: "Maya's rooftop", note: 'Bring snacks + a hot take 🔥', going: ['me', 'maya', 'jo'] },
        members: [
          { id: 'me', name: 'You', emoji: '😎', page: 312 },
          { id: 'maya', name: 'Maya', emoji: '🦋', page: 480 },
          { id: 'jo', name: 'Jo', emoji: '🧃', page: 205 },
          { id: 'dev', name: 'Dev', emoji: '🐙', page: 559 },
          { id: 'sam', name: 'Sam', emoji: '🌸', page: 90 },
        ],
      },
      {
        id: 'c2', name: 'Dragons & Dumplings', emoji: '🐉', accent: 1,
        book: { title: 'Piranesi', author: 'Susanna Clarke', pages: 272 },
        meeting: { date: daysFromNow(9, 18), place: 'Lucky Dumpling House', note: 'Dinner first, discussion after', going: ['ali'] },
        members: [
          { id: 'me', name: 'You', emoji: '😎', page: 120 },
          { id: 'ali', name: 'Ali', emoji: '🍜', page: 272 },
          { id: 'rae', name: 'Rae', emoji: '🪐', page: 198 },
          { id: 'tom', name: 'Tom', emoji: '🐢', page: 44 },
        ],
      },
      {
        id: 'c3', name: 'Sunday Sappho', emoji: '💌', accent: 3,
        book: { title: 'Real Life', author: 'Brandon Taylor', pages: 330 },
        meeting: { date: daysFromNow(14, 11), place: 'Blue Door Café', note: 'Brunch vibes ☕', going: [] },
        members: [
          { id: 'me', name: 'You', emoji: '😎', page: 15 },
          { id: 'lu', name: 'Lu', emoji: '🌻', page: 150 },
          { id: 'kai', name: 'Kai', emoji: '🦊', page: 88 },
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

  const $ = (s, r = document) => r.querySelector(s);
  const app = $('#app');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (m, c) => Math.min(100, Math.round((m.page / c.book.pages) * 100));
  const fmtDate = iso => new Date(iso).toLocaleString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  function relDay(iso) {
    const days = Math.ceil((new Date(iso) - Date.now()) / 864e5);
    if (days <= 0) return 'Today!';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
  }
  function nextClubMeeting(c) { return c.meeting ? new Date(c.meeting.date).getTime() : Infinity; }

  /* ---------- views ---------- */
  function home() {
    const clubs = [...state.clubs].sort((a, b) => nextClubMeeting(a) - nextClubMeeting(b));
    app.innerHTML = `
      <section class="hero">
        <h1>Your <span class="grad">book clubs</span> ✨</h1>
        <p class="sub">${clubs.length} club${clubs.length === 1 ? '' : 's'}. Zero excuses for not finishing chapter 12.</p>
      </section>
      <div class="clubs">
        ${clubs.map(c => {
          const me = c.members.find(m => m.id === ME);
          return `
          <a class="card club-card" href="#/club/${c.id}" style="--accent:${ACCENTS[c.accent % ACCENTS.length]}">
            <div class="club-emoji">${esc(c.emoji)}</div>
            <h3>${esc(c.name)}</h3>
            <div class="club-book">Reading <b>${esc(c.book.title)}</b> · ${esc(c.book.author)}</div>
            ${c.meeting ? `<span class="pill lime">🗓 ${relDay(c.meeting.date)}</span>` : ''}
            <div class="club-book">You're ${me ? pct(me, c) : 0}% through</div>
            <div class="avatars">${c.members.map((m, i) => `<span class="av" style="--c:${COLORS[i % COLORS.length]}">${esc(m.emoji)}</span>`).join('')}</div>
          </a>`;
        }).join('') || '<div class="card empty">No clubs yet — start one!</div>'}
      </div>`;
  }

  let timer;
  function club(id) {
    const c = state.clubs.find(x => x.id === id);
    if (!c) return (location.hash = '#/');
    const meet = c.meeting;
    const going = meet ? meet.going : [];
    const rsvp = going.includes(ME) ? 'yes' : (meet && meet.maybe && meet.maybe.includes(ME) ? 'maybe' : '');
    const me = c.members.find(m => m.id === ME);
    const ranked = c.members.map((m, i) => ({ ...m, color: COLORS[i % COLORS.length] })).sort((a, b) => b.page - a.page);

    app.innerHTML = `
      <a class="back" href="#/">← All clubs</a>
      <div class="club-head">
        <div class="club-emoji">${esc(c.emoji)}</div>
        <div>
          <h1 style="font-size:clamp(2rem,6vw,3.2rem)">${esc(c.name)}</h1>
          <p class="sub" style="margin-top:4px">📖 ${esc(c.book.title)} by ${esc(c.book.author)} · ${c.book.pages} pages</p>
        </div>
      </div>

      ${meet ? `
      <section class="card next">
        <div class="eyebrow">Next book club</div>
        <h2>${relDay(meet.date)} 🎉</h2>
        <div class="meta"><span>🗓 ${fmtDate(meet.date)}</span><span>📍 ${esc(meet.place)}</span>${meet.note ? `<span>💬 ${esc(meet.note)}</span>` : ''}</div>
        <div class="countdown" id="countdown"></div>
        <div class="rsvp">
          <button data-rsvp="yes" class="${rsvp === 'yes' ? 'on' : ''}">🙌 I'm in</button>
          <button data-rsvp="maybe" class="${rsvp === 'maybe' ? 'on' : ''}">🤔 Maybe</button>
          <button data-rsvp="no" class="${!rsvp ? 'on' : ''}">😢 Can't</button>
          <span class="going">${going.length} going</span>
        </div>
      </section>` : ''}

      <h2>Leaderboard 🏁</h2>
      <section class="card board">
        ${ranked.map((m, i) => {
          const p = pct(m, c);
          return `
          <div class="lane ${m.id === ME ? 'me' : ''}">
            <div class="rank">${['🥇', '🥈', '🥉'][i] || i + 1}</div>
            <div class="track">
              <div class="fill" style="--c:${m.color}" data-w="${p}"></div>
              <span class="name">${esc(m.name)}</span>
              <div class="rider" data-l="${p}" style="left:0"><span class="av" style="--c:${m.color}">${esc(m.emoji)}</span></div>
            </div>
            <div class="pct">${p}%</div>
          </div>`;
        }).join('')}
        <div class="finish">🏁 finish · p.${c.book.pages}</div>
      </section>

      ${me ? `
      <section class="card update">
        <label for="pg">Where are you?</label>
        <input type="range" id="pg" min="0" max="${c.book.pages}" value="${me.page}">
        <output id="pgout">p. ${me.page}</output>
      </section>` : ''}
    `;

    // animate the race
    requestAnimationFrame(() => requestAnimationFrame(() => {
      app.querySelectorAll('.fill').forEach(f => f.style.width = `${f.dataset.w}%`);
      app.querySelectorAll('.rider').forEach(r => {
        const track = r.parentElement.clientWidth;
        const half = 20; // keep avatar fully inside the track
        const px = Math.max(half + 3, Math.min(track - half - 3, track * r.dataset.l / 100));
        r.style.left = `${px}px`;
      });
    }));

    // countdown
    clearInterval(timer);
    if (meet) {
      const tick = () => {
        const el = $('#countdown');
        if (!el) return clearInterval(timer);
        let s = Math.max(0, Math.floor((new Date(meet.date) - Date.now()) / 1000));
        const parts = [['days', Math.floor(s / 86400)], ['hrs', Math.floor(s % 86400 / 3600)], ['min', Math.floor(s % 3600 / 60)], ['sec', s % 60]];
        el.innerHTML = parts.map(([l, v]) => `<div class="tick"><b>${String(v).padStart(2, '0')}</b><span>${l}</span></div>`).join('');
      };
      tick();
      timer = setInterval(tick, 1000);
    }

    app.querySelectorAll('[data-rsvp]').forEach(b => b.onclick = () => {
      const v = b.dataset.rsvp;
      meet.going = meet.going.filter(x => x !== ME);
      meet.maybe = (meet.maybe || []).filter(x => x !== ME);
      if (v === 'yes') { meet.going.push(ME); confetti(); toast("You're on the list! 🎟️"); }
      if (v === 'maybe') meet.maybe.push(ME);
      save(); club(id);
    });

    const pg = $('#pg');
    if (pg) {
      pg.oninput = () => { $('#pgout').textContent = `p. ${pg.value}`; };
      pg.onchange = () => {
        me.page = +pg.value;
        save(); club(id);
        if (me.page >= c.book.pages) { confetti(); toast('You finished the book! 🎉'); }
      };
    }
  }

  /* ---------- new club modal ---------- */
  function openModal() {
    let emoji = EMOJIS[0];
    const root = $('#modal-root');
    const soon = new Date(Date.now() + 7 * 864e5);
    soon.setHours(19, 0, 0, 0);
    const local = new Date(soon - soon.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
    root.innerHTML = `
      <div class="backdrop"><form class="modal">
        <h2>Start a club ✨</h2>
        <label>Club name<input name="name" required maxlength="40" placeholder="Plot Twist Society"></label>
        <div class="emoji-pick">${EMOJIS.map((e, i) => `<button type="button" data-e="${e}" class="${i ? '' : 'on'}">${e}</button>`).join('')}</div>
        <div class="row">
          <label>Book<input name="title" required maxlength="60" placeholder="Book title"></label>
          <label>Author<input name="author" maxlength="60" placeholder="Author"></label>
        </div>
        <div class="row">
          <label>Pages<input name="pages" type="number" min="1" max="5000" required value="300"></label>
          <label>Next meetup<input name="date" type="datetime-local" required value="${local}"></label>
        </div>
        <label>Where<input name="place" maxlength="60" placeholder="Someone's couch"></label>
        <div class="actions"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn">Create club</button></div>
      </form></div>`;
    const close = () => root.innerHTML = '';
    root.querySelector('[data-close]').onclick = close;
    root.querySelector('.backdrop').onclick = e => { if (e.target.classList.contains('backdrop')) close(); };
    root.querySelectorAll('[data-e]').forEach(b => b.onclick = () => {
      emoji = b.dataset.e;
      root.querySelectorAll('[data-e]').forEach(x => x.classList.toggle('on', x === b));
    });
    root.querySelector('form').onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const id = 'c' + Date.now();
      state.clubs.push({
        id, name: f.get('name').trim(), emoji, accent: state.clubs.length % ACCENTS.length,
        book: { title: f.get('title').trim(), author: (f.get('author') || 'Unknown').trim(), pages: +f.get('pages') },
        meeting: { date: new Date(f.get('date')).toISOString(), place: (f.get('place') || 'TBD').trim(), note: '', going: [ME] },
        members: [{ id: ME, name: 'You', emoji: '😎', page: 0 }],
      });
      save(); close(); confetti();
      location.hash = `#/club/${id}`;
    };
    root.querySelector('input').focus();
  }

  /* ---------- fx ---------- */
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (let i = 0; i < 60; i++) {
      const p = document.createElement('i');
      p.className = 'confetti';
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = COLORS[i % COLORS.length];
      p.style.animationDuration = 1.6 + Math.random() * 1.6 + 's';
      p.style.animationDelay = Math.random() * .3 + 's';
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 3800);
    }
  }

  /* ---------- router ---------- */
  function route() {
    clearInterval(timer);
    const m = location.hash.match(/^#\/club\/(.+)$/);
    m ? club(m[1]) : home();
    scrollTo(0, 0);
  }
  addEventListener('hashchange', route);
  $('#new-club-btn').onclick = openModal;
  route();
})();
