// 저장소 모듈: 모든 데이터 읽기·쓰기를 여기에 모아 둔다.
// 이 기기의 브라우저 저장소(IndexedDB)에만 저장. 나중에 서버로 옮길 때 이 파일만 바꾸면 된다.
import { normalizeDaily, normalizeCard, remember } from './forms.js';

const DB_NAME = 'scheduler-card';
const KV = 'kv';
const KEY = 'data';

// 직접 쓴 문구를 기억해 두는 목록들
export const RECENT_KEYS = ['urgent', 'important', 'memo', 'callAction', 'product'];

function emptyData() {
  const recent = {};
  RECENT_KEYS.forEach(k => { recent[k] = []; });
  return {
    version: 1,
    people: [],          // { id, name }
    dailies: {},         // 'YYYY-MM-DD' → 데일리
    cards: [],           // 도전카드
    settings: { recent, cardSort: 'date', clipboard: null, lastBackupAt: null, firstUseAt: null, snoozeUntil: null },
  };
}

let data = emptyData();
let idb = null;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(KV);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function normalize(d) {
  const base = emptyData();
  const out = { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) } };
  out.settings.recent = { ...base.settings.recent, ...(out.settings.recent || {}) };
  if (!Array.isArray(out.people)) out.people = [];
  if (!Array.isArray(out.cards)) out.cards = [];
  if (!out.dailies || typeof out.dailies !== 'object') out.dailies = {};
  // v2.0: v1.0에만 있던 칸과 기억해 둔 문구를 지운다
  out.settings.recent = Object.fromEntries(RECENT_KEYS.map(k => [k, out.settings.recent[k] || []]));
  for (const k of Object.keys(out.dailies)) out.dailies[k] = normalizeDaily(out.dailies[k]);
  out.cards = out.cards.map(normalizeCard);
  if (out.settings.clipboard?.kind === 'card') out.settings.clipboard.data = normalizeCard(out.settings.clipboard.data);
  if (out.settings.clipboard?.kind === 'daily') out.settings.clipboard.data = normalizeDaily(out.settings.clipboard.data);
  return out;
}

export async function load() {
  try {
    idb = await openDb();
    const saved = await new Promise((resolve, reject) => {
      const r = idb.transaction(KV).objectStore(KV).get(KEY);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    if (saved) data = normalize(saved);
    if (!data.settings.firstUseAt) { data.settings.firstUseAt = Date.now(); persist(); }
    // 브라우저가 저장 공간을 정리할 때 지우지 않도록 요청
    navigator.storage?.persist?.().catch(() => {});
  } catch (e) {
    console.warn('저장소를 열지 못했습니다', e);
  }
  return data;
}

let timer = null;
function persist() {
  clearTimeout(timer);
  timer = setTimeout(flush, 150);
}
export function flush() {
  clearTimeout(timer);
  if (!idb) return;
  try { idb.transaction(KV, 'readwrite').objectStore(KV).put(structuredClone(data), KEY); }
  catch (e) { console.warn('저장 실패', e); }
}
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
addEventListener('pagehide', flush);

export const db = () => data;
export const touch = persist;

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
const now = () => new Date().toISOString();

// ── 사람 ──
export function addPerson(name) {
  const n = name.trim();
  const same = data.people.find(p => p.name === n);
  if (same) return same;
  const p = { id: uid(), name: n, createdAt: now() };
  data.people.push(p);
  persist();
  return p;
}
export function renamePerson(id, name) {
  const p = data.people.find(x => x.id === id);
  if (p) { p.name = name.trim(); persist(); }
}
export function removePerson(id) {
  data.people = data.people.filter(p => p.id !== id);
  persist();
}
export const personName = id => data.people.find(p => p.id === id)?.name || '';

// ── 데일리 ──
export function getDaily(date) {
  const d = data.dailies[date];
  return d ? normalizeDaily(d) : null;
}
export function saveDaily(d) {
  data.dailies[d.date] = d;
  persist();
}
export function removeDaily(date) {
  delete data.dailies[date];
  persist();
}

// ── 도전카드 ──
export function addCard(card) {
  const rec = { id: uid(), createdAt: now(), updatedAt: now(), ...card };
  data.cards.push(rec);
  persist();
  return rec;
}
export function saveCard(card) {
  const i = data.cards.findIndex(c => c.id === card.id);
  card.updatedAt = now();
  if (i >= 0) data.cards[i] = card; else data.cards.push(card);
  persist();
}
export function removeCard(id) {
  data.cards = data.cards.filter(c => c.id !== id);
  persist();
}

// ── 설정 ──
export function rememberText(key, text) {
  data.settings.recent[key] = remember(data.settings.recent[key], text);
  persist();
}
export function forgetText(key, text) {
  data.settings.recent[key] = (data.settings.recent[key] || []).filter(x => x !== text);
  persist();
}
export function setSetting(k, v) {
  data.settings[k] = v;
  persist();
}

// ── 이미지에서 되살리기 ──
export function addPeopleRaw(list) {
  list.forEach(p => { if (!data.people.some(x => x.id === p.id)) data.people.push({ ...p, createdAt: now() }); });
  persist();
}
export function restoreCardRecord(card) {
  card = normalizeCard(card);
  const i = data.cards.findIndex(c => c.id === card.id);
  if (i >= 0) data.cards[i] = card; else data.cards.push(card);
  persist();
}
export const hasAnyData = () => data.people.length > 0 || data.cards.length > 0 || Object.keys(data.dailies).length > 0;

// ── 백업 ──
export function exportJson() {
  return JSON.stringify({ app: 'scheduler-card', exportedAt: now(), ...data }, null, 2);
}
export function importJson(text) {
  const parsed = JSON.parse(text);
  if (!parsed || parsed.app !== 'scheduler-card') throw new Error('이 앱의 백업 파일이 아니에요');
  delete parsed.app; delete parsed.exportedAt;
  data = normalize(parsed);
  flush();
  return data;
}
