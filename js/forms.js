// 양식 규칙 모듈: 데일리·도전카드의 빈 양식, 합계, 복사·붙이기, 줄바꿈 계산.
// 화면(app.js)과 그림(render.js)이 같이 쓰고, tests.html에서 검사한다.

// 시급한 일 시간 칸 (종이 양식과 같은 15칸)
export const HOURS = ['8', '9', '10', '11', '12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10~'];
// 중요한 일 10칸의 우선순위 (마지막 칸은 비어 있음)
export const PRIS = ['A', 'A', 'A', 'B', 'B', 'B', 'C', 'C', 'C', ''];
export const STP_ROWS = 2;
export const CONSUMER_ROWS = 5;
export const CALL_MAX = 12;   // 이미지: 3줄 × 4칸
export const MEMO_ROWS = 2;

// 중요한 일 상태
export const STATUSES = [
  { key: 'done', label: '완료', mark: 'V' },
  { key: 'delay', label: '연기', mark: '→' },
  { key: 'cancel', label: '취소', mark: '×' },
  { key: 'deleg', label: '위임', mark: '' },
  { key: 'doing', label: '진행중', mark: '●' },
];

export const COLORS = [
  { key: 'k', label: '검정', hex: '#141414' },
  { key: 'r', label: '빨강', hex: '#D0281E' },
  { key: 'g', label: '초록', hex: '#2E8B3A' },
];
export const colorHex = key => (COLORS.find(c => c.key === key) || COLORS[0]).hex;

export const COMMS = [
  { n: 1, label: '1류 : 이해' },
  { n: 2, label: '2류 : 설득' },
  { n: 3, label: '3류 : 강요' },
  { n: 4, label: '4류 : 구박' },
];

const line = () => ({ text: '', color: 'k' });

export function emptyDaily(date) {
  return {
    date,
    urgent: HOURS.map(line),
    important: PRIS.map(() => ({ text: '', color: 'k', status: '', delegateId: null })),
    stp: Array(STP_ROWS).fill(null),
    consumers: Array.from({ length: CONSUMER_ROWS }, () => ({ personId: null, pv: '', product: '' })),
    personal: { pv: '', product: '' },
    monthPv: '',        // 월 합계 PV (직접 입력)
    calls: [],
    memo: Array.from({ length: MEMO_ROWS }, line),
  };
}

// v1.0에만 있던 칸 (v2.0에서 삭제): 데일리 시스템적 사고, 도전카드 신/생/활·관계·상대 수준·동기·목표
const V1_DAILY = ['theme', 'sys'];
const V1_CARD = ['ssh', 'relPersonal', 'relBusiness', 'them', 'me', 'motive', 'goal', 'stock', 'why', 'inflow', 'outflow'];
const omit = (o, keys) => { const c = { ...o }; keys.forEach(k => delete c[k]); return c; };

// 예전 데이터나 일부만 있는 데이터를 빈 양식 모양에 맞춘다 (v1.0 칸은 버린다)
export function normalizeDaily(d) {
  const base = emptyDaily(d.date);
  const fill = (arr, n, mk) => Array.from({ length: n }, (_, i) => ({ ...mk(), ...((arr || [])[i] || {}) }));
  return {
    ...base, ...omit(d, V1_DAILY),
    urgent: fill(d.urgent, HOURS.length, line),
    important: fill(d.important, PRIS.length, () => ({ text: '', color: 'k', status: '', delegateId: null })),
    stp: Array.from({ length: STP_ROWS }, (_, i) => (d.stp || [])[i] ?? null),
    consumers: fill(d.consumers, CONSUMER_ROWS, () => ({ personId: null, pv: '', product: '' })),
    personal: { ...base.personal, ...(d.personal || {}) },
    calls: (d.calls || []).slice(0, CALL_MAX),
    memo: fill(d.memo, MEMO_ROWS, line),
  };
}

export function emptyCard(date) {
  return {
    date,
    personId: null,
    qa: [{ q: '', a: '' }],
    comm: null,
    feedback: '',
  };
}

export function normalizeCard(c) {
  const out = { ...emptyCard(c.date), ...omit(c, V1_CARD) };
  if (!Array.isArray(out.qa) || !out.qa.length) out.qa = [{ q: '', a: '' }];
  return out;
}

const hasText = v => typeof v === 'string' && v.trim() !== '';

export function isDailyEmpty(d) {
  if (!d) return true;
  if ((d.urgent || []).some(r => hasText(r.text))) return false;
  if ((d.important || []).some(r => hasText(r.text) || r.status)) return false;
  if ((d.stp || []).some(Boolean)) return false;
  if ((d.consumers || []).some(r => r.personId || hasText(String(r.pv ?? '')) || hasText(r.product))) return false;
  if (hasText(String(d.personal?.pv ?? '')) || hasText(d.personal?.product)) return false;
  if (hasText(String(d.monthPv ?? ''))) return false;
  if ((d.calls || []).length) return false;
  if ((d.memo || []).some(r => hasText(r.text))) return false;
  return true;
}

export function isCardEmpty(c) {
  if (!c) return true;
  if (c.personId || c.comm) return false;
  if (hasText(c.feedback)) return false;
  if ((c.qa || []).some(p => hasText(p.q) || hasText(p.a))) return false;
  return true;
}

// "60,000" 처럼 쉼표가 있어도 숫자로
export function toNum(v) {
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
export function pvTotal(d) {
  return (d.consumers || []).reduce((s, r) => s + toNum(r.pv), 0) + toNum(d.personal?.pv);
}
export const fmtNum = n => Math.round(n).toLocaleString('ko-KR');

// 날짜 'YYYY-MM-DD'
export function ymd(dt) {
  const p = n => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}
export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(s, n) {
  const dt = parseYmd(s);
  dt.setDate(dt.getDate() + n);
  return ymd(dt);
}
export const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
export const weekdayKo = s => WEEK[parseYmd(s).getDay()];
export function dateLabel(s) {
  const dt = parseYmd(s);
  return `${dt.getMonth() + 1}월 ${dt.getDate()}일 (${weekdayKo(s)})`;
}
// 도전카드 일자 표기: 26. 1. 10
export function shortDate(s) {
  const dt = parseYmd(s);
  return `${String(dt.getFullYear()).slice(2)}. ${dt.getMonth() + 1}. ${dt.getDate()}`;
}

// 위임 표시용: 이름의 첫 글자(성)
export const initialOf = name => (name || '').trim().charAt(0);

// 한 번 쓴 문구 기억: 맨 앞에 두고 중복 제거
export function remember(list, text, max = 40) {
  const t = (text || '').trim();
  if (!t) return list || [];
  return [t, ...(list || []).filter(x => x !== t)].slice(0, max);
}

// 붙이기: 내용 전체를 복제하고 날짜만 대상 날짜로.
// 월 합계는 날마다 다르므로 복사하지 않는다
export function pasteDaily(src, date) {
  return normalizeDaily({ ...structuredClone(src), date, monthPv: '' });
}
// 도전카드 붙이기: 대상 카드의 id·날짜는 그대로, 나머지는 복사본
export function pasteCard(src, target) {
  const copy = structuredClone(src);
  delete copy.id; delete copy.createdAt; delete copy.updatedAt;
  return { ...copy, id: target.id, date: target.date, createdAt: target.createdAt };
}

// 정렬
export function sortCardsByDate(cards) {
  return [...cards].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
}
export function groupCardsByPerson(cards, nameOf) {
  const map = new Map();
  for (const c of sortCardsByDate(cards)) {
    const k = c.personId || '';
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(c);
  }
  return [...map.entries()]
    .map(([personId, list]) => ({ personId, name: personId ? nameOf(personId) : '(대상 없음)', cards: list }))
    .sort((a, b) => (a.personId ? 0 : 1) - (b.personId ? 0 : 1) || a.name.localeCompare(b.name, 'ko'));
}

// ── 줄바꿈 계산 (그림용) ──
// measure(text) → 글자 폭. 단어 단위로 나누고, 너무 긴 단어는 글자 단위로 자른다.
export function wrapText(measure, text, width) {
  const out = [];
  for (const para of String(text ?? '').split('\n')) {
    if (para === '') { out.push(''); continue; }
    const words = para.split(/(\s+)/).filter(w => w !== '');
    let cur = '';
    for (const w of words) {
      const next = cur + w;
      if (measure(next) <= width) { cur = next; continue; }
      if (cur.trim() !== '') { out.push(cur.trimEnd()); cur = ''; }
      if (/^\s+$/.test(w)) continue;
      if (measure(w) <= width) { cur = w; continue; }
      for (const ch of w) {
        if (measure(cur + ch) > width && cur !== '') { out.push(cur); cur = ''; }
        cur += ch;
      }
    }
    if (cur.trim() !== '' || out.length === 0) out.push(cur.trimEnd());
  }
  return out;
}

// 상자 안에 들어가는 가장 큰 글자 크기와 줄들을 찾는다.
// measureAt(size) → (text) => 폭
export function fitText(measureAt, text, width, height, { max, min, lineGap = 1.3, oneLine = false }) {
  for (let size = max; size >= min; size -= 1) {
    const m = measureAt(size);
    if (oneLine) {
      if (m(String(text ?? '').replace(/\n/g, ' ')) <= width) return { size, lines: [String(text ?? '').replace(/\n/g, ' ')] };
      continue;
    }
    const lines = wrapText(m, text, width);
    if (lines.length * size * lineGap <= height + size * (lineGap - 1)) return { size, lines };
  }
  // 가장 작은 글자로도 넘치면 들어가는 데까지만
  const m = measureAt(min);
  const lines = wrapText(m, text, width);
  const maxLines = Math.max(1, Math.floor((height + min * (lineGap - 1)) / (min * lineGap)));
  return { size: min, lines: lines.slice(0, maxLines), cut: lines.length > maxLines };
}

// ── 이미지 속 숨은 기록 ──
// 이미지에 넣을 기록: 양식 내용 + 그 안에 나오는 사람 이름
export function referencedPeople(kind, data) {
  const ids = new Set();
  if (kind === 'daily') {
    (data.stp || []).forEach(id => id && ids.add(id));
    (data.consumers || []).forEach(c => c.personId && ids.add(c.personId));
    (data.calls || []).forEach(c => c.personId && ids.add(c.personId));
    (data.important || []).forEach(r => r.delegateId && ids.add(r.delegateId));
  } else if (data.personId) ids.add(data.personId);
  return [...ids];
}
export function packRecord(kind, data, nameOf) {
  const people = referencedPeople(kind, data).map(id => ({ id, name: nameOf(id) })).filter(p => p.name);
  return JSON.stringify({ app: 'scheduler-card', v: 1, kind, data, people });
}
export function parseRecord(text) {
  try {
    const r = JSON.parse(text);
    if (r?.app !== 'scheduler-card' || !['daily', 'card'].includes(r.kind) || !r.data) return null;
    if (r.kind === 'daily' && !/^\d{4}-\d{2}-\d{2}$/.test(r.data.date || '')) return null;
    if (r.kind === 'card' && !r.data.id) return null;
    return { kind: r.kind, data: r.data, people: Array.isArray(r.people) ? r.people : [] };
  } catch { return null; }
}
// 들어오는 사람을 지금 목록에 맞춘다: 같은 id는 그대로, 같은 이름은 기존 사람으로, 나머지는 새로 추가
export function mergePeople(existing, incoming) {
  const remap = {};
  const add = [];
  for (const p of incoming) {
    if (!p?.id || !p.name) continue;
    if (existing.some(e => e.id === p.id) || add.some(a => a.id === p.id)) { remap[p.id] = p.id; continue; }
    const same = existing.find(e => e.name === p.name) || add.find(a => a.name === p.name);
    if (same) { remap[p.id] = same.id; continue; }
    add.push({ id: p.id, name: p.name });
    remap[p.id] = p.id;
  }
  return { add, remap };
}
export function remapRecord(kind, data, remap) {
  const m = id => (id && remap[id]) || id || null;
  const d = structuredClone(data);
  if (kind === 'daily') {
    d.stp = (d.stp || []).map(m);
    (d.consumers || []).forEach(c => { c.personId = m(c.personId); });
    (d.calls || []).forEach(c => { c.personId = m(c.personId); });
    (d.important || []).forEach(r => { r.delegateId = m(r.delegateId); });
  } else d.personId = m(d.personId);
  return d;
}

// ── 백업 알림 ──
export const BACKUP_DAYS = 7;
const DAY = 86400000;
// 기록이 있고, 마지막 백업(없으면 처음 쓴 날)에서 7일이 지났고, '나중에'를 누른 지 하루가 지났으면 알린다
export function backupDue({ lastBackupAt, firstUseAt, snoozeUntil }, hasData, now = Date.now()) {
  if (!hasData) return 0;
  if (snoozeUntil && now < snoozeUntil) return 0;
  const since = lastBackupAt || firstUseAt;
  if (!since) return 0;
  const days = Math.floor((now - since) / DAY);
  return days >= BACKUP_DAYS ? days : 0;
}
