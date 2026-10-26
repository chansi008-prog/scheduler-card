// 화면 모듈: 데일리 / 도전카드 / 사람 탭과 입력 창
import * as S from './store.js';
import {
  HOURS, PRIS, SYS_FIELDS, STATUSES, COLORS, SSH, MOTIVES, COMMS, CALL_MAX,
  emptyDaily, emptyCard, isDailyEmpty, isCardEmpty, pvTotal, fmtNum, toNum, colorHex,
  ymd, addDays, dateLabel, shortDate, weekdayKo, initialOf, pasteDaily, pasteCard,
  sortCardsByDate, groupCardsByPerson, normalizeDaily,
  packRecord, parseRecord, mergePeople, remapRecord, backupDue,
} from './forms.js';
import { renderDaily, renderCard, ensureFonts, toBlob } from './render.js';
import { embedText, extractText } from './pngmeta.js';

const $ = (sel, el = document) => el.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => ymd(new Date());
const nameOf = id => S.personName(id);

// ── 아이콘 ──
const ICON = {
  left: '<path d="M15 6l-6 6 6 6"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  paste: '<path d="M9 4h6v3H9z"/><path d="M15 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  cards: '<rect x="4" y="4" width="13" height="16" rx="2"/><path d="M8 9h5M8 13h5M20 7v12a2 2 0 0 1-2 2h-9"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21 20c0-2.6-1.6-4.8-4-5.6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
};
const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

// ── 상태 ──
const state = { date: today() };

function route() {
  const h = location.hash.slice(1) || 'daily';
  const [name, arg] = h.split('/');
  return { name, arg: arg ? decodeURIComponent(arg) : '' };
}
const go = hash => { location.hash = hash; };

// ── 공통: 알림, 확인 ──
let toastTimer;
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 1800);
}

// ── 아래에서 올라오는 입력 창 ──
function openSheet(title, bodyHtml, { onMount, wide = false } = {}) {
  closeSheet();
  const wrap = document.createElement('div');
  wrap.id = 'sheet';
  wrap.innerHTML = `<div class="scrim" data-close></div>
    <div class="panel ${wide ? 'wide' : ''}" role="dialog" aria-label="${esc(title)}">
      <div class="ph"><b>${esc(title)}</b><button class="icon-btn ghost" data-close aria-label="닫기">${ic('x')}</button></div>
      <div class="pb">${bodyHtml}</div>
    </div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('locked');
  wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });
  onMount?.(wrap);
  requestAnimationFrame(() => wrap.classList.add('on'));
  return wrap;
}
function closeSheet() {
  $('#sheet')?.remove();
  document.body.classList.remove('locked');
}

function colorChips(selected) {
  return `<div class="chips colors">${COLORS.map(c => `<button class="chip sm ${c.key === selected ? 'on' : ''}" data-color="${c.key}"><span class="cdot" style="background:${c.hex}"></span>${c.label}</button>`).join('')}</div>`;
}
function wireColors(root, initial) {
  let color = initial;
  root.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => {
    color = b.dataset.color;
    root.querySelectorAll('[data-color]').forEach(x => x.classList.toggle('on', x === b));
    const ta = root.querySelector('textarea, input.main');
    if (ta) ta.style.color = colorHex(color);
  }));
  return () => color;
}

// 기억해 둔 문구 버튼들 (× 로 지우기)
function recentHtml(key, label = '이전에 쓴 문구') {
  const list = S.db().settings.recent[key] || [];
  if (!list.length) return '';
  return `<div class="recent"><div class="lbl">${label} <button class="link sm" data-edit-recent>편집</button></div>
    <div class="chips">${list.map(t => `<span class="chip sm pick" data-pick="${esc(t)}">${esc(t)}<button class="x" data-forget="${esc(t)}" aria-label="지우기">${ic('x')}</button></span>`).join('')}</div></div>`;
}
function wireRecent(root, key, onPick) {
  root.querySelector('[data-edit-recent]')?.addEventListener('click', e => {
    const r = e.target.closest('.recent'); r.classList.toggle('editing');
    e.target.textContent = r.classList.contains('editing') ? '완료' : '편집';
  });
  root.querySelectorAll('[data-pick]').forEach(ch => ch.addEventListener('click', e => {
    const f = e.target.closest('[data-forget]');
    if (f) { S.forgetText(key, f.dataset.forget); ch.remove(); return; }
    if (ch.closest('.recent').classList.contains('editing')) return;
    onPick(ch.dataset.pick);
  }));
}

// 한 줄 글 입력 창 (색·이전 문구 포함)
function textSheet({ title, value = '', color, recentKey, hint = '', multiline = true, onSave }) {
  const hasColor = color !== undefined;
  const body = `
    <textarea class="main" rows="${multiline ? 3 : 2}" placeholder="${esc(hint)}" style="color:${colorHex(color || 'k')}">${esc(value)}</textarea>
    ${hasColor ? `<div class="lbl">글자 색</div>${colorChips(color || 'k')}` : ''}
    ${recentKey ? recentHtml(recentKey) : ''}
    <div class="row-btns mt"><button class="btn" data-clear>지우기</button><button class="btn pri" data-save>저장</button></div>`;
  openSheet(title, body, {
    onMount(root) {
      const ta = $('textarea', root);
      const getColor = hasColor ? wireColors(root, color || 'k') : () => undefined;
      const save = text => {
        const t = text.trim();
        if (recentKey && t) S.rememberText(recentKey, t);
        onSave(t, getColor());
        closeSheet(); render();
      };
      if (recentKey) wireRecent(root, recentKey, t => save(t));
      $('[data-save]', root).addEventListener('click', () => save(ta.value));
      $('[data-clear]', root).addEventListener('click', () => { onSave('', 'k'); closeSheet(); render(); });
      setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 60);
    },
  });
}

// 사람 고르기 칩 + 새 이름 추가
function peopleHtml(selectedId, { none = false } = {}) {
  const people = [...S.db().people].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  return `<div class="people-pick">
    <div class="chips">${none ? `<button class="chip sm ${!selectedId ? 'on' : ''}" data-person="">없음</button>` : ''}
      ${people.map(p => `<button class="chip sm ${p.id === selectedId ? 'on' : ''}" data-person="${p.id}">${esc(p.name)}</button>`).join('')}</div>
    ${people.length ? '' : '<p class="muted small">아직 등록된 사람이 없어요. 아래에 이름을 써서 추가하세요.</p>'}
    <div class="addrow"><input type="text" placeholder="새 이름" data-newname enterkeyhint="done"><button class="btn sm" data-addperson>${ic('plus')} 추가</button></div>
  </div>`;
}
function wirePeople(root, initial, onChange) {
  let sel = initial;
  const box = $('.people-pick', root);
  const mark = () => box.querySelectorAll('[data-person]').forEach(b => b.classList.toggle('on', (b.dataset.person || null) === (sel || null)));
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-person]');
    if (b) { sel = b.dataset.person || null; mark(); onChange?.(sel); }
  });
  const add = () => {
    const inp = $('[data-newname]', box); const n = inp.value.trim();
    if (!n) { inp.focus(); return; }
    const p = S.addPerson(n);
    sel = p.id;
    if (!box.querySelector(`[data-person="${p.id}"]`)) {
      const chip = document.createElement('button');
      chip.className = 'chip sm'; chip.dataset.person = p.id; chip.textContent = p.name;
      $('.chips', box).appendChild(chip);
      box.querySelector('p.muted')?.remove();
    }
    inp.value = ''; mark(); onChange?.(sel);
  };
  $('[data-addperson]', box).addEventListener('click', add);
  $('[data-newname]', box).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
  return () => sel;
}

function personSheet(title, current, onPick, { none = true } = {}) {
  openSheet(title, `${peopleHtml(current, { none })}<div class="row-btns mt"><button class="btn pri" data-save>확인</button></div>`, {
    onMount(root) {
      const get = wirePeople(root, current, null);
      $('[data-save]', root).addEventListener('click', () => { onPick(get()); closeSheet(); render(); });
    },
  });
}

// ════════════════ 데일리 ════════════════
function curDaily() {
  return S.getDaily(state.date) || emptyDaily(state.date);
}
function saveDaily(d) {
  if (isDailyEmpty(d)) S.removeDaily(d.date); else S.saveDaily(d);
}

function lineRow(attrs, label, text, color, hint = '') {
  return `<button class="lrow" ${attrs}><span class="lab">${label}</span><span class="val ${text ? '' : 'ph'}" style="${text ? `color:${colorHex(color)}` : ''}">${esc(text || hint)}</span></button>`;
}

function viewDaily() {
  const d = curDaily();
  const isToday = state.date === today();
  const imp = d.important.map((r, i) => {
    let mark = '';
    if (r.status === 'deleg') mark = `<span class="ini">${esc(initialOf(nameOf(r.delegateId)) || '위')}</span>`;
    else if (r.status) mark = `<span class="mk">${STATUSES.find(s => s.key === r.status)?.mark || ''}</span>`;
    return `<button class="lrow imp" data-act="imp" data-i="${i}"><span class="st">${mark}</span><span class="lab pri">${PRIS[i]}</span><span class="val ${r.text ? '' : 'ph'}" style="${r.text ? `color:${colorHex(r.color)}` : ''}">${esc(r.text || '')}</span></button>`;
  }).join('');
  const total = pvTotal(d);
  const calls = d.calls.map((c, i) => `<div class="lrow call">
      <button class="cbox ${c.done ? 'on' : ''}" data-act="calldone" data-i="${i}" aria-label="연락함">${ic('check')}</button>
      <button class="val" data-act="call" data-i="${i}"><b>${esc(nameOf(c.personId) || '(이름 없음)')}</b> <span class="muted">${esc(c.action || '')}</span></button>
    </div>`).join('');
  const due = backupDue(S.db().settings, S.hasAnyData());
  const banner = due ? `<div class="banner"><div><b>백업할 때가 됐어요</b><span>${S.db().settings.lastBackupAt ? `마지막 백업 후 ${due}일 지났어요.` : '아직 한 번도 백업하지 않았어요.'} 휴대폰을 바꾸거나 앱을 지우면 기록이 사라져요.</span></div>
      <div class="row-btns"><button class="btn sm" data-act="backup-later">나중에</button><button class="btn sm pri" data-act="backup-now">지금 백업</button></div></div>` : '';
  return `${banner}
    <header class="dtop">
      <button class="icon-btn" data-act="prev" aria-label="전날">${ic('left')}</button>
      <label class="dlabel"><span>${dateLabel(state.date)}</span><input type="date" value="${state.date}" data-act="pickdate" aria-label="날짜 고르기"></label>
      <button class="icon-btn" data-act="next" aria-label="다음 날">${ic('right')}</button>
    </header>
    ${isToday ? '' : `<div class="center"><button class="link" data-act="today">오늘로</button></div>`}
    <div class="acts">
      <button class="btn sm" data-act="copy-daily">${ic('copy')} 복사</button>
      <button class="btn sm" data-act="paste-daily">${ic('paste')} 붙이기</button>
      <button class="btn sm pri" data-act="img-daily">${ic('image')} 이미지</button>
    </div>

    <section class="card">
      <h2>시스템적 사고</h2>
      ${lineRow('data-act="theme"', '문구', d.theme, 'k', '요일 문구 (예: 관계와 성장의 날)')}
      ${SYS_FIELDS.map(f => lineRow(`data-act="sys" data-k="${f.key}"`, f.label, d.sys[f.key], 'k', f.hint)).join('')}
    </section>

    <section class="card">
      <h2>시급한 일 <small>1상한</small></h2>
      ${HOURS.map((h, i) => lineRow(`data-act="urgent" data-i="${i}"`, h, d.urgent[i].text, d.urgent[i].color)).join('')}
    </section>

    <section class="card">
      <h2>중요한 일 <small>2상한</small></h2>
      ${imp}
      <p class="legend">V 완료 · → 연기 · × 취소 · <span class="ini sm">김</span> 위임 · ● 진행중</p>
    </section>

    <section class="card">
      <h2>STP</h2>
      ${d.stp.map((p, i) => lineRow(`data-act="stp" data-i="${i}"`, String(i + 1), nameOf(p), 'k', '사람 선택')).join('')}
    </section>

    <section class="card">
      <h2>소비자 관리 <span class="sum">합계 ${fmtNum(total)} PV</span></h2>
      ${d.consumers.map((c, i) => `<button class="lrow cons" data-act="cons" data-i="${i}">
          <span class="nm ${c.personId ? '' : 'ph'}">${esc(nameOf(c.personId) || '이름')}</span>
          <span class="pv">${String(c.pv ?? '').trim() ? fmtNum(toNum(c.pv)) : ''}</span>
          <span class="val">${esc(c.product || '')}</span></button>`).join('')}
      <button class="lrow cons" data-act="cons" data-i="personal">
        <span class="nm">개인</span><span class="pv">${String(d.personal.pv ?? '').trim() ? fmtNum(toNum(d.personal.pv)) : ''}</span><span class="val">${esc(d.personal.product || '')}</span></button>
    </section>

    <section class="card">
      <h2>Call 10 <small>${d.calls.filter(c => c.done).length} / ${d.calls.length}</small></h2>
      ${calls}
      ${d.calls.length < CALL_MAX ? `<button class="lrow add" data-act="call" data-i="new">${ic('plus')} 사람 추가</button>` : ''}
    </section>

    <section class="card">
      <h2>기억해두기</h2>
      ${d.memo.map((m, i) => lineRow(`data-act="memo" data-i="${i}"`, String(i + 1), m.text, m.color)).join('')}
    </section>

    ${isDailyEmpty(d) ? '' : `<div class="center mt2"><button class="link danger" data-act="clear-daily">이 날 내용 모두 지우기</button></div>`}
  `;
}

function editDaily(fn) {
  const d = curDaily();
  fn(d);
  saveDaily(d);
}

function importantSheet(i) {
  const d = curDaily();
  const r = d.important[i];
  let status = r.status || '';
  const body = `
    <div class="lbl">상태</div>
    <div class="chips" data-status-chips>
      <button class="chip sm ${!status ? 'on' : ''}" data-st="">없음</button>
      ${STATUSES.map(s => `<button class="chip sm ${status === s.key ? 'on' : ''}" data-st="${s.key}">${s.key === 'deleg' ? '<span class="ini sm">김</span>' : s.mark} ${s.label}</button>`).join('')}
    </div>
    <div class="deleg ${status === 'deleg' ? '' : 'hide'}"><div class="lbl">누구에게 맡겼나요?</div>${peopleHtml(r.delegateId)}</div>
    <div class="lbl">할 일 (${PRIS[i] || '기타'})</div>
    <textarea class="main" rows="2" style="color:${colorHex(r.color)}">${esc(r.text)}</textarea>
    <div class="lbl">글자 색</div>${colorChips(r.color)}
    ${recentHtml('important')}
    <div class="row-btns mt"><button class="btn" data-clear>지우기</button><button class="btn pri" data-save>저장</button></div>`;
  openSheet(`중요한 일 ${PRIS[i] || ''}`, body, {
    onMount(root) {
      const getColor = wireColors(root, r.color);
      const getPerson = wirePeople(root, r.delegateId, null);
      root.querySelectorAll('[data-st]').forEach(b => b.addEventListener('click', () => {
        status = b.dataset.st;
        root.querySelectorAll('[data-st]').forEach(x => x.classList.toggle('on', x === b));
        $('.deleg', root).classList.toggle('hide', status !== 'deleg');
      }));
      const ta = $('textarea', root);
      const save = text => {
        const t = text.trim();
        if (t) S.rememberText('important', t);
        editDaily(dd => { dd.important[i] = { text: t, color: getColor(), status, delegateId: status === 'deleg' ? getPerson() : null }; });
        closeSheet(); render();
      };
      wireRecent(root, 'important', t => { ta.value = t; save(t); });
      $('[data-save]', root).addEventListener('click', () => save(ta.value));
      $('[data-clear]', root).addEventListener('click', () => {
        editDaily(dd => { dd.important[i] = { text: '', color: 'k', status: '', delegateId: null }; });
        closeSheet(); render();
      });
    },
  });
}

function callSheet(idx) {
  const d = curDaily();
  const isNew = idx === 'new';
  const c = isNew ? { personId: null, action: '', done: false } : d.calls[idx];
  let action = c.action || '', done = !!c.done;
  const actions = S.db().settings.recent.callAction || [];
  const body = `
    <div class="lbl">1. 사람</div>${peopleHtml(c.personId)}
    <div class="lbl">2. 한 일</div>
    <div class="recent"><div class="chips" data-actions>${actions.map(a => `<span class="chip sm pick ${a === action ? 'on' : ''}" data-pick="${esc(a)}">${esc(a)}<button class="x" data-forget="${esc(a)}" aria-label="지우기">${ic('x')}</button></span>`).join('')}</div>
    ${actions.length ? '<button class="link sm" data-edit-recent>편집</button>' : ''}</div>
    <div class="addrow"><input type="text" class="act-in" placeholder="직접 쓰기 (예: 안부, 상담, 배달)" value="${actions.includes(action) ? '' : esc(action)}"></div>
    <button class="toggle ${done ? 'on' : ''}" data-done><span class="cbox ${done ? 'on' : ''}">${ic('check')}</span> 연락했어요</button>
    <div class="row-btns mt">${isNew ? '' : `<button class="btn danger" data-del>${ic('trash')} 빼기</button>`}<button class="btn pri" data-save>저장</button></div>`;
  openSheet(isNew ? 'Call 10 추가' : 'Call 10', body, {
    onMount(root) {
      const getPerson = wirePeople(root, c.personId, null);
      const inp = $('.act-in', root);
      const chipsBox = $('[data-actions]', root);
      root.querySelector('[data-edit-recent]')?.addEventListener('click', e => {
        const r = e.target.closest('.recent'); r.classList.toggle('editing');
        e.target.textContent = r.classList.contains('editing') ? '완료' : '편집';
      });
      chipsBox.addEventListener('click', e => {
        const f = e.target.closest('[data-forget]');
        const ch = e.target.closest('[data-pick]');
        if (f) { S.forgetText('callAction', f.dataset.forget); ch.remove(); return; }
        if (!ch || ch.closest('.recent').classList.contains('editing')) return;
        action = action === ch.dataset.pick ? '' : ch.dataset.pick;
        chipsBox.querySelectorAll('[data-pick]').forEach(x => x.classList.toggle('on', x.dataset.pick === action));
        inp.value = '';
      });
      inp.addEventListener('input', () => { action = inp.value; chipsBox.querySelectorAll('[data-pick]').forEach(x => x.classList.remove('on')); });
      $('[data-done]', root).addEventListener('click', e => {
        done = !done; const b = e.currentTarget; b.classList.toggle('on', done); $('.cbox', b).classList.toggle('on', done);
      });
      $('[data-save]', root).addEventListener('click', () => {
        const pid = getPerson();
        if (!pid) { toast('사람을 골라 주세요'); return; }
        const a = action.trim();
        if (a) S.rememberText('callAction', a);
        editDaily(dd => {
          const rec = { personId: pid, action: a, done };
          if (isNew) dd.calls.push(rec); else dd.calls[idx] = rec;
        });
        closeSheet(); render();
      });
      $('[data-del]', root)?.addEventListener('click', () => { editDaily(dd => dd.calls.splice(idx, 1)); closeSheet(); render(); });
    },
  });
}

function consumerSheet(idx) {
  const d = curDaily();
  const personal = idx === 'personal';
  const c = personal ? d.personal : d.consumers[idx];
  const body = `
    ${personal ? '' : `<div class="lbl">이름</div>${peopleHtml(c.personId, { none: true })}`}
    <div class="grid2">
      <div><div class="lbl">PV</div><input type="text" inputmode="numeric" class="pv-in" value="${esc(c.pv)}" placeholder="10,000"></div>
      <div><div class="lbl">전달 제품</div><input type="text" class="prod-in" value="${esc(c.product)}" placeholder="더블엑스"></div>
    </div>
    ${recentHtml('product', '이전에 쓴 제품')}
    <div class="row-btns mt"><button class="btn" data-clear>비우기</button><button class="btn pri" data-save>저장</button></div>`;
  openSheet(personal ? '소비자 관리 · 개인' : '소비자 관리', body, {
    onMount(root) {
      const getPerson = personal ? () => null : wirePeople(root, c.personId, null);
      const pv = $('.pv-in', root), prod = $('.prod-in', root);
      wireRecent(root, 'product', t => { prod.value = t; });
      const put = rec => editDaily(dd => { if (personal) dd.personal = rec; else dd.consumers[idx] = rec; });
      $('[data-save]', root).addEventListener('click', () => {
        const p = prod.value.trim();
        if (p) S.rememberText('product', p);
        const rec = { pv: pv.value.trim(), product: p };
        if (!personal) rec.personId = getPerson();
        put(rec); closeSheet(); render();
      });
      $('[data-clear]', root).addEventListener('click', () => { put(personal ? { pv: '', product: '' } : { personId: null, pv: '', product: '' }); closeSheet(); render(); });
    },
  });
}

// ════════════════ 도전카드 ════════════════
function cardMeta(c) {
  const bits = [];
  if (c.relPersonal || c.relBusiness) bits.push(`관계 ${c.relPersonal || '-'}·${c.relBusiness || '-'}`);
  if (c.motive) bits.push(c.motive);
  if (c.comm) bits.push(`${c.comm}류`);
  return bits.join(' · ');
}
function cardRow(c, { showName = true } = {}) {
  const dt = c.date ? c.date.split('-') : [];
  return `<button class="crow" data-act="opencard" data-id="${c.id}">
    <div><b>${showName ? esc(nameOf(c.personId) || '(대상 없음)') : shortDate(c.date)}</b><span class="muted small">${esc(cardMeta(c))}</span></div>
    <span class="muted small">${showName && dt.length ? `${+dt[1]}.${+dt[2]}` : ''}</span></button>`;
}

function viewCards() {
  const sort = S.db().settings.cardSort || 'date';
  const cards = S.db().cards;
  let list = '';
  if (!cards.length) {
    list = `<div class="empty">아직 도전카드가 없어요.<br>위의 <b>새 카드</b>로 시작하세요.</div>`;
  } else if (sort === 'date') {
    let month = '';
    for (const c of sortCardsByDate(cards)) {
      const m = c.date ? `${c.date.slice(0, 4)}년 ${+c.date.slice(5, 7)}월` : '날짜 없음';
      if (m !== month) { list += `<div class="month">${m}</div>`; month = m; }
      list += cardRow(c);
    }
    list = `<div class="card list">${list}</div>`;
  } else {
    const groups = groupCardsByPerson(cards, nameOf);
    list = groups.map(g => `<details class="card grp" ${state.openGroup === g.personId ? 'open' : ''} data-grp="${g.personId}">
        <summary><div><b>${esc(g.name)}</b> <span class="muted small">카드 ${g.cards.length}장</span><br><span class="muted small">최근 ${shortDate(g.cards[0].date)} ${esc(cardMeta(g.cards[0]))}</span></div>${ic('right', 'chev')}</summary>
        ${g.cards.map(c => cardRow(c, { showName: false })).join('')}
      </details>`).join('');
  }
  return `
    <header class="top"><h1>도전카드</h1><button class="btn sm pri" data-act="newcard">${ic('plus')} 새 카드</button></header>
    <div class="seg"><button class="${sort === 'date' ? 'on' : ''}" data-act="sort" data-v="date">날짜순</button><button class="${sort === 'person' ? 'on' : ''}" data-act="sort" data-v="person">사람순</button></div>
    <div class="mt">${list}</div>`;
}

function chipGroup(field, options, value, labelOf = v => v) {
  return `<div class="chips">${options.map(o => `<button class="chip sm ${String(value) === String(o) ? 'on' : ''}" data-act="cardpick" data-f="${field}" data-v="${esc(o)}">${esc(labelOf(o))}</button>`).join('')}</div>`;
}
const ta = (f, v, ph = '', rows = 3) => `<textarea data-cf="${f}" rows="${rows}" placeholder="${esc(ph)}">${esc(v)}</textarea>`;

function viewCard(id) {
  const c = S.db().cards.find(x => x.id === id);
  if (!c) return `<div class="empty">카드를 찾을 수 없어요.<br><button class="link" data-act="tab" data-v="cards">도전카드 목록으로</button></div>`;
  const recent = S.db().settings.recent;
  return `
    <button class="back" data-act="back">${ic('left')} 도전카드</button>
    <div class="acts">
      <button class="btn sm" data-act="copy-card">${ic('copy')} 복사</button>
      <button class="btn sm" data-act="paste-card">${ic('paste')} 붙이기</button>
      <button class="btn sm pri" data-act="img-card">${ic('image')} 이미지</button>
    </div>

    <section class="card">
      <div class="grid2">
        <div><div class="lbl">일자</div><input type="date" data-cf="date" value="${esc(c.date)}"></div>
        <div><div class="lbl">대상</div><button class="pickbtn ${c.personId ? '' : 'ph'}" data-act="cardperson">${esc(nameOf(c.personId) || '사람 선택')}</button></div>
      </div>
      <div class="lbl">신 / 생 / 활</div>${chipGroup('ssh', SSH, c.ssh)}
    </section>

    <section class="card">
      <h2>관계 <small>발달 4단계</small></h2>
      <div class="lbl">개인적</div>${chipGroup('relPersonal', [1, 2, 3, 4], c.relPersonal)}
      <div class="lbl">사업적</div>${chipGroup('relBusiness', [1, 2, 3, 4], c.relBusiness)}
      <h2 class="mt">상대 수준 <small>나의 역할</small></h2>
      <div class="grid2">
        <div><div class="lbl">상대</div><input type="text" data-cf="them" value="${esc(c.them)}" list="dl-them" placeholder="0%, 잠재적 리더"></div>
        <div><div class="lbl">나</div><input type="text" data-cf="me" value="${esc(c.me)}" list="dl-me" placeholder="사업지원"></div>
      </div>
      <datalist id="dl-them">${(recent.them || []).map(t => `<option value="${esc(t)}">`).join('')}</datalist>
      <datalist id="dl-me">${(recent.me || []).map(t => `<option value="${esc(t)}">`).join('')}</datalist>
      <h2 class="mt">동기 <small>Process 4단계</small></h2>
      ${chipGroup('motive', MOTIVES, c.motive)}
    </section>

    <section class="card">
      <h2>1. 목표 (What)</h2>
      <div class="lbl">당월</div><input type="text" data-cf="goal.m0" value="${esc(c.goal?.m0)}">
      <div class="grid2">
        <div><div class="lbl">익월</div><input type="text" data-cf="goal.m1" value="${esc(c.goal?.m1)}"></div>
        <div><div class="lbl">익익월</div><input type="text" data-cf="goal.m2" value="${esc(c.goal?.m2)}"></div>
      </div>
      <div class="lbl">저량 (Level)</div>${ta('stock', c.stock, '지금 상대의 상황')}
      <div class="lbl">Why</div>${ta('why', c.why, '', 2)}
      <div class="lbl">유입 (What)</div>${ta('inflow', c.inflow)}
      <div class="lbl">유출 (What)</div>${ta('outflow', c.outflow)}
    </section>

    <section class="card">
      <h2>2. 방법 · 3. 진행</h2>
      <p class="muted small">질문과 그 결과를 한 쌍으로 적어요. 이미지에서 같은 높이에 나란히 들어가요.</p>
      ${(c.qa || []).map((p, i) => `<div class="qa">
          <div class="qh"><b>질문 ${i + 1}</b>${c.qa.length > 1 ? `<button class="link sm danger" data-act="qadel" data-i="${i}">빼기</button>` : ''}</div>
          <div class="lbl">방법 (How) · 내가 질문할 것</div>${ta(`qa.${i}.q`, p.q, '', 2)}
          <div class="lbl">진행 (doing) · 실제 진행된 것</div>${ta(`qa.${i}.a`, p.a, '만난 뒤에 적기', 2)}
        </div>`).join('')}
      <button class="btn block" data-act="qaadd">${ic('plus')} 질문 추가</button>
    </section>

    <section class="card">
      <h2>4. 피드백 <small>잘할 것, 보완할 것</small></h2>
      <div class="lbl">소통 4단계 · 어떤 수준으로 소통했나요?</div>
      ${chipGroup('comm', COMMS.map(x => x.n), c.comm, n => COMMS.find(x => x.n === n).label)}
      <div class="lbl">잘할 것 · 보완할 것</div>${ta('feedback', c.feedback, '', 4)}
    </section>

    <div class="center mt2"><button class="link danger" data-act="delcard">이 카드 삭제</button></div>`;
}

// 도전카드 글 입력 → 바로 저장 (화면은 다시 그리지 않음)
function onCardInput(e) {
  const el = e.target.closest('[data-cf]');
  if (!el) return;
  const { arg } = route();
  const c = S.db().cards.find(x => x.id === arg);
  if (!c) return;
  const path = el.dataset.cf.split('.');
  let obj = c;
  for (let i = 0; i < path.length - 1; i++) {
    if (obj[path[i]] == null) obj[path[i]] = {};
    obj = obj[path[i]];
  }
  obj[path[path.length - 1]] = el.value;
  S.saveCard(c);
}
function onCardChange(e) {
  const el = e.target.closest('[data-cf]');
  if (!el) return;
  const f = el.dataset.cf;
  if ((f === 'them' || f === 'me') && el.value.trim()) S.rememberText(f, el.value);
}

// 빈 새 카드는 나갈 때 지운다
function dropEmptyCard(id) {
  const c = S.db().cards.find(x => x.id === id);
  if (c && isCardEmpty({ ...c, date: null })) S.removeCard(id);
}

// ════════════════ 사람 ════════════════
function viewPeople() {
  const people = [...S.db().people].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const count = id => S.db().cards.filter(c => c.personId === id).length;
  return `
    <header class="top"><h1>사람</h1></header>
    <div class="addrow big"><input type="text" placeholder="새 이름" data-newperson enterkeyhint="done"><button class="btn pri" data-act="addperson">${ic('plus')} 추가</button></div>
    <div class="card list mt">${people.length ? people.map(p => `<button class="crow" data-act="openperson" data-id="${p.id}"><div><b>${esc(p.name)}</b></div><span class="muted small">도전카드 ${count(p.id)}장 ${ic('right', 'chev')}</span></button>`).join('')
      : '<div class="empty">등록된 사람이 없어요.<br>데일리·도전카드에서 사람을 고를 때도 바로 추가할 수 있어요.</div>'}</div>

    <section class="card mt2">
      <h2>백업</h2>
      <p class="muted small">기록은 이 휴대폰 안에만 저장돼요. 휴대폰을 바꾸거나 앱을 지우기 전에 백업 파일을 저장해 두세요.</p>
      ${S.db().settings.lastBackupAt ? `<p class="small">마지막 백업: ${new Date(S.db().settings.lastBackupAt).toLocaleDateString('ko-KR')}</p>` : ''}
      <div class="row-btns"><button class="btn" data-act="export">내보내기</button><button class="btn" data-act="import">가져오기</button></div>
      <input type="file" accept="application/json,.json" hidden data-importfile>
      <h2 class="mt">이미지에서 되살리기</h2>
      <p class="muted small">이 앱에서 저장한 데일리·도전카드 이미지를 고르면 그 안에 숨겨 둔 기록으로 다시 만들어요. 여러 장을 한 번에 골라도 돼요. 카톡으로 주고받은 이미지는 압축돼서 기록이 지워져 있어요.</p>
      <button class="btn block" data-act="restore-img">이미지 고르기</button>
      <input type="file" accept="image/png,image/*" multiple hidden data-restorefile>
    </section>`;
}

function viewPerson(id) {
  const p = S.db().people.find(x => x.id === id);
  if (!p) return `<div class="empty">사람을 찾을 수 없어요.</div>`;
  const cards = sortCardsByDate(S.db().cards.filter(c => c.personId === id));
  return `
    <button class="back" data-act="back">${ic('left')} 사람</button>
    <header class="top"><h1>${esc(p.name)}</h1><button class="icon-btn" data-act="renameperson" aria-label="이름 고치기">${ic('edit')}</button></header>
    <div class="sec"><h2>도전카드 <small>${cards.length}장</small></h2><button class="btn sm pri" data-act="newcard" data-person="${id}">${ic('plus')} 새 카드</button></div>
    <div class="card list">${cards.length ? cards.map(c => cardRow(c, { showName: false })).join('') : '<div class="empty">아직 카드가 없어요.</div>'}</div>
    <div class="center mt2"><button class="link danger" data-act="delperson">이 사람 삭제</button></div>`;
}

// ════════════════ 이미지 ════════════════
async function showImage(kind) {
  openSheet('이미지', `<div class="imgwrap"><div class="muted center">그리는 중…</div></div>`, { wide: true });
  await ensureFonts();
  let canvas, fname, record;
  if (kind === 'daily') {
    const d = curDaily();
    canvas = renderDaily(d, nameOf);
    fname = `데일리_${state.date}.png`;
    record = packRecord('daily', d, nameOf);
  } else {
    const c = S.db().cards.find(x => x.id === route().arg);
    canvas = renderCard(c, nameOf);
    fname = `도전카드_${nameOf(c.personId) || '대상없음'}_${c.date}.png`;
    record = packRecord('card', c, nameOf);
  }
  // 이미지 파일 안에 기록을 숨겨 둔다 (나중에 이미지로 되살리기)
  let blob = await toBlob(canvas);
  try { blob = new Blob([embedText(new Uint8Array(await blob.arrayBuffer()), record)], { type: 'image/png' }); }
  catch (er) { console.warn('기록 넣기 실패', er); }
  const url = URL.createObjectURL(blob);
  const sheet = $('#sheet');
  if (!sheet) return;
  $('.pb', sheet).innerHTML = `<div class="imgwrap"><img src="${url}" alt="${esc(fname)}"></div>
    <p class="muted small center">저장 버튼을 누르고 "이미지 저장"을 고르면 사진 앱에 들어가요.</p>
    <div class="row-btns mt"><button class="btn pri block" data-save>${ic('image')} 저장 · 공유</button></div>`;
  $('[data-save]', sheet).addEventListener('click', async () => {
    const file = new File([blob], fname, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove();
  });
}

// ════════════════ 백업 ════════════════
async function exportBackup() {
  const blob = new Blob([S.exportJson()], { type: 'application/json' });
  const file = new File([blob], `스케쥴러백업_${today()}.json`, { type: 'application/json' });
  const done = () => { S.setSetting('lastBackupAt', Date.now()); S.setSetting('snoozeUntil', null); render(); toast('백업 파일을 만들었어요'); };
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); done(); return; } catch (er) { if (er.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  done();
}

// 이미지 파일들에서 숨은 기록을 꺼내 되살린다
async function restoreFromImages(files) {
  const found = [];
  let missing = 0;
  for (const f of files) {
    try {
      const text = extractText(new Uint8Array(await f.arrayBuffer()));
      const rec = text && parseRecord(text);
      if (rec) found.push(rec); else missing++;
    } catch { missing++; }
  }
  if (!found.length) {
    alert(`기록이 들어 있는 이미지를 찾지 못했어요.${files.length > 1 ? ` (${files.length}장 모두)` : ''}\n이 앱에서 저장한 원본 이미지인지 확인해 주세요. 카톡으로 받은 이미지는 기록이 지워져 있어요.`);
    return;
  }
  const dailies = found.filter(r => r.kind === 'daily');
  const cards = found.filter(r => r.kind === 'card');
  const overD = dailies.filter(r => !isDailyEmpty(S.getDaily(r.data.date))).length;
  const overC = cards.filter(r => S.db().cards.some(c => c.id === r.data.id)).length;
  const lines = [`데일리 ${dailies.length}장, 도전카드 ${cards.length}장을 찾았어요.`];
  if (missing) lines.push(`기록이 없는 이미지 ${missing}장은 건너뛰어요.`);
  if (overD + overC) lines.push(`이미 있는 ${overD + overC}개는 이미지 내용으로 바뀌어요.`);
  if (!confirm(lines.join('\n') + '\n\n되살릴까요?')) return;
  for (const r of found) {
    const { add, remap } = mergePeople(S.db().people, r.people);
    if (add.length) S.addPeopleRaw(add);
    const data = remapRecord(r.kind, r.data, remap);
    if (r.kind === 'daily') S.saveDaily(normalizeDaily(data));
    else S.restoreCardRecord(data);
  }
  S.flush();
  render();
  toast(`${found.length}장을 되살렸어요`);
}

// ════════════════ 그리기 ════════════════
let lastCardId = null;
function render() {
  const r = route();
  // 빈 새 카드에서 나가면 정리
  if (lastCardId && !(r.name === 'card' && r.arg === lastCardId)) { dropEmptyCard(lastCardId); lastCardId = null; }
  if (r.name === 'card') lastCardId = r.arg;
  if (r.name === 'daily' && r.arg && /^\d{4}-\d{2}-\d{2}$/.test(r.arg)) state.date = r.arg;

  const tab = r.name === 'card' || r.name === 'cards' ? 'cards' : r.name === 'people' || r.name === 'person' ? 'people' : 'daily';
  const html = r.name === 'card' ? viewCard(r.arg)
    : r.name === 'cards' ? viewCards()
    : r.name === 'people' ? viewPeople()
    : r.name === 'person' ? viewPerson(r.arg)
    : viewDaily();
  const y = scrollY;
  $('#app').innerHTML = html;
  scrollTo(0, y);
  document.querySelectorAll('#nav [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === tab));
}

let lastRoute = '';
addEventListener('hashchange', () => {
  const h = location.hash;
  const sameView = h.split('/')[0] === lastRoute.split('/')[0] && h.startsWith('#daily');
  lastRoute = h;
  closeSheet();
  render();
  if (!sameView) scrollTo(0, 0);
});

// ════════════════ 클릭 처리 ════════════════
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.closest('#sheet')) return;
  const act = el.dataset.act, i = el.dataset.i;
  const d = () => curDaily();

  switch (act) {
    case 'tab': {
      const v = el.dataset.v;
      go(v === 'daily' ? `daily/${state.date}` : v);
      break;
    }
    case 'prev': go(`daily/${addDays(state.date, -1)}`); break;
    case 'next': go(`daily/${addDays(state.date, 1)}`); break;
    case 'today': go(`daily/${today()}`); break;
    case 'theme':
      textSheet({ title: '시스템적 사고 · 요일 문구', value: d().theme, recentKey: 'theme', hint: '예: 관계와 성장의 날', multiline: false,
        onSave: t => editDaily(dd => { dd.theme = t; }) });
      break;
    case 'sys': {
      const f = SYS_FIELDS.find(x => x.key === el.dataset.k);
      textSheet({ title: f.label, value: d().sys[f.key], recentKey: f.key, hint: f.hint,
        onSave: t => editDaily(dd => { dd.sys[f.key] = t; }) });
      break;
    }
    case 'urgent': {
      const r = d().urgent[i];
      textSheet({ title: `시급한 일 · ${HOURS[i]}시`, value: r.text, color: r.color, recentKey: 'urgent', multiline: false,
        onSave: (t, c) => editDaily(dd => { dd.urgent[i] = { text: t, color: c || 'k' }; }) });
      break;
    }
    case 'memo': {
      const r = d().memo[i];
      textSheet({ title: '기억해두기', value: r.text, color: r.color, recentKey: 'memo',
        onSave: (t, c) => editDaily(dd => { dd.memo[i] = { text: t, color: c || 'k' }; }) });
      break;
    }
    case 'imp': importantSheet(+i); break;
    case 'stp': personSheet(`STP ${+i + 1}`, d().stp[i], pid => editDaily(dd => { dd.stp[i] = pid; })); break;
    case 'cons': consumerSheet(i === 'personal' ? 'personal' : +i); break;
    case 'call': callSheet(i === 'new' ? 'new' : +i); break;
    case 'calldone': editDaily(dd => { dd.calls[i].done = !dd.calls[i].done; }); render(); break;
    case 'clear-daily':
      if (confirm(`${dateLabel(state.date)} 내용을 모두 지울까요?`)) { S.removeDaily(state.date); render(); }
      break;
    case 'copy-daily': {
      const cur = d();
      if (isDailyEmpty(cur)) { toast('복사할 내용이 없어요'); break; }
      S.setSetting('clipboard', { kind: 'daily', from: state.date, data: structuredClone(cur) });
      toast(`${dateLabel(state.date)} 내용을 복사했어요`);
      break;
    }
    case 'paste-daily': {
      const clip = S.db().settings.clipboard;
      if (clip?.kind !== 'daily') { toast('먼저 다른 날짜에서 복사를 눌러 주세요'); break; }
      if (!isDailyEmpty(d()) && !confirm(`${dateLabel(state.date)}에 이미 내용이 있어요. ${dateLabel(clip.from)} 내용으로 덮어쓸까요?`)) break;
      saveDaily(pasteDaily(clip.data, state.date));
      render(); toast('붙였어요. 바꿀 칸만 고치세요');
      break;
    }
    case 'img-daily': showImage('daily'); break;

    case 'sort': S.setSetting('cardSort', el.dataset.v); render(); break;
    case 'newcard': {
      const c = S.addCard({ ...emptyCard(today()), personId: el.dataset.person || null });
      go(`card/${c.id}`);
      break;
    }
    case 'opencard': go(`card/${el.dataset.id}`); break;
    case 'back': history.length > 1 ? history.back() : go(route().name === 'person' ? 'people' : 'cards'); break;
    case 'cardpick': {
      const c = S.db().cards.find(x => x.id === route().arg);
      const f = el.dataset.f;
      let v = el.dataset.v;
      if (['relPersonal', 'relBusiness', 'comm'].includes(f)) v = Number(v);
      c[f] = c[f] === v ? (typeof v === 'number' ? null : '') : v;
      S.saveCard(c); render();
      break;
    }
    case 'cardperson': {
      const c = S.db().cards.find(x => x.id === route().arg);
      personSheet('대상', c.personId, pid => { c.personId = pid; S.saveCard(c); });
      break;
    }
    case 'qaadd': {
      const c = S.db().cards.find(x => x.id === route().arg);
      c.qa = [...(c.qa || []), { q: '', a: '' }];
      S.saveCard(c); render();
      setTimeout(() => document.querySelector(`[data-cf="qa.${c.qa.length - 1}.q"]`)?.focus(), 50);
      break;
    }
    case 'qadel': {
      const c = S.db().cards.find(x => x.id === route().arg);
      const p = c.qa[i];
      if ((p.q || p.a) && !confirm(`질문 ${+i + 1}을 뺄까요?`)) break;
      c.qa.splice(+i, 1); S.saveCard(c); render();
      break;
    }
    case 'copy-card': {
      const c = S.db().cards.find(x => x.id === route().arg);
      if (isCardEmpty({ ...c, date: null })) { toast('복사할 내용이 없어요'); break; }
      S.setSetting('clipboard', { kind: 'card', from: c.date, data: structuredClone(c) });
      toast('도전카드를 복사했어요');
      break;
    }
    case 'paste-card': {
      const clip = S.db().settings.clipboard;
      if (clip?.kind !== 'card') { toast('먼저 다른 도전카드에서 복사를 눌러 주세요'); break; }
      const c = S.db().cards.find(x => x.id === route().arg);
      if (!isCardEmpty({ ...c, date: null }) && !confirm('이 카드에 이미 내용이 있어요. 복사한 카드 내용으로 덮어쓸까요?')) break;
      S.saveCard(pasteCard(clip.data, c));
      render(); toast('붙였어요. 바꿀 칸만 고치세요');
      break;
    }
    case 'img-card': showImage('card'); break;
    case 'delcard':
      if (confirm('이 도전카드를 삭제할까요? 되돌릴 수 없어요.')) { S.removeCard(route().arg); lastCardId = null; go('cards'); }
      break;

    case 'addperson': {
      const inp = $('[data-newperson]'); const n = inp.value.trim();
      if (!n) { inp.focus(); break; }
      S.addPerson(n); render(); toast(`${n} 님을 추가했어요`);
      break;
    }
    case 'openperson': go(`person/${el.dataset.id}`); break;
    case 'renameperson': {
      const id = route().arg; const n = prompt('이름', nameOf(id));
      if (n && n.trim()) { S.renamePerson(id, n); render(); }
      break;
    }
    case 'delperson': {
      const id = route().arg;
      const used = S.db().cards.some(c => c.personId === id);
      if (confirm(`${nameOf(id)} 님을 목록에서 삭제할까요?${used ? '\n이 사람의 도전카드는 남지만 대상 이름이 비게 돼요.' : ''}`)) { S.removePerson(id); go('people'); }
      break;
    }
    case 'export': case 'backup-now': exportBackup(); break;
    case 'backup-later': S.setSetting('snoozeUntil', Date.now() + 86400000); render(); break;
    case 'import': $('[data-importfile]').click(); break;
    case 'restore-img': $('[data-restorefile]').click(); break;
  }
});

document.addEventListener('input', e => {
  if (e.target.closest('#sheet')) return;
  if (route().name === 'card') onCardInput(e);
});
document.addEventListener('change', e => {
  if (e.target.matches('[data-act="pickdate"]') && e.target.value) { go(`daily/${e.target.value}`); return; }
  if (e.target.matches('[data-restorefile]')) {
    const files = [...e.target.files]; e.target.value = '';
    if (files.length) restoreFromImages(files);
    return;
  }
  if (e.target.matches('[data-importfile]')) {
    const f = e.target.files[0]; if (!f) return;
    if (!confirm('백업 파일로 지금 기록을 모두 바꿀까요?')) { e.target.value = ''; return; }
    f.text().then(t => { S.importJson(t); toast('백업을 가져왔어요'); render(); }).catch(er => alert(er.message));
    return;
  }
  if (route().name === 'card') {
    onCardChange(e);
    if (e.target.dataset.cf === 'date') render();
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('[data-newperson]')) { e.preventDefault(); $('[data-act="addperson"]').click(); }
  if (e.key === 'Escape') closeSheet();
});
document.addEventListener('toggle', e => {
  if (e.target.matches?.('details.grp')) state.openGroup = e.target.open ? e.target.dataset.grp : (state.openGroup === e.target.dataset.grp ? null : state.openGroup);
}, true);

// ── 시작 ──
(async () => {
  await S.load();
  if (!location.hash) history.replaceState(null, '', `#daily/${state.date}`);
  lastRoute = location.hash;
  render();
  ensureFonts();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();

// 테스트·디버그용
window.__app = { S, render, go, renderDaily, renderCard, curDaily, weekdayKo };
