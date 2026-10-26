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

export const SYS_FIELDS = [
  { key: 'level', label: '저량', hint: '현재 상황 체크' },
  { key: 'input', label: '유입', hint: '오늘 할 것' },
  { key: 'output', label: '유출', hint: '상대가 할 질문 미리 생각해 보기 / 이탈 방지' },
  { key: 'control', label: '제어', hint: '주의점, 신경 쓸 것' },
  { key: 'feedback', label: '피드백', hint: '만난 후 체크 & 스폰서 상담' },
];

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

export const SSH = ['신', '생', '활'];
export const MOTIVES = ['needs', '준비', '적용', '결과'];
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
    theme: '',
    sys: { level: '', input: '', output: '', control: '', feedback: '' },
    urgent: HOURS.map(line),
    important: PRIS.map(() => ({ text: '', color: 'k', status: '', delegateId: null })),
    stp: Array(STP_ROWS).fill(null),
    consumers: Array.from({ length: CONSUMER_ROWS }, () => ({ personId: null, pv: '', product: '' })),
    personal: { pv: '', product: '' },
    calls: [],
    memo: Array.from({ length: MEMO_ROWS }, line),
  };
}

// 예전 데이터나 일부만 있는 데이터를 빈 양식 모양에 맞춘다
export function normalizeDaily(d) {
  const base = emptyDaily(d.date);
  const fill = (arr, n, mk) => Array.from({ length: n }, (_, i) => ({ ...mk(), ...((arr || [])[i] || {}) }));
  return {
    ...base, ...d,
    sys: { ...base.sys, ...(d.sys || {}) },
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
    ssh: '',
    relPersonal: null, relBusiness: null,
    them: '', me: '',
    motive: '',
    goal: { m0: '', m1: '', m2: '' },
    stock: '', why: '', inflow: '', outflow: '',
    qa: [{ q: '', a: '' }],
    comm: null,
    feedback: '',
  };
}

const hasText = v => typeof v === 'string' && v.trim() !== '';

export function isDailyEmpty(d) {
  if (!d) return true;
  if (hasText(d.theme) || Object.values(d.sys || {}).some(hasText)) return false;
  if ((d.urgent || []).some(r => hasText(r.text))) return false;
  if ((d.important || []).some(r => hasText(r.text) || r.status)) return false;
  if ((d.stp || []).some(Boolean)) return false;
  if ((d.consumers || []).some(r => r.personId || hasText(String(r.pv ?? '')) || hasText(r.product))) return false;
  if (hasText(String(d.personal?.pv ?? '')) || hasText(d.personal?.product)) return false;
  if ((d.calls || []).length) return false;
  if ((d.memo || []).some(r => hasText(r.text))) return false;
  return true;
}

export function isCardEmpty(c) {
  if (!c) return true;
  if (c.personId || c.ssh || c.relPersonal || c.relBusiness || c.motive || c.comm) return false;
  if ([c.them, c.me, c.stock, c.why, c.inflow, c.outflow, c.feedback].some(hasText)) return false;
  if (Object.values(c.goal || {}).some(hasText)) return false;
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

// 붙이기: 내용 전체를 복제하고 날짜만 대상 날짜로
export function pasteDaily(src, date) {
  return normalizeDaily({ ...structuredClone(src), date });
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
