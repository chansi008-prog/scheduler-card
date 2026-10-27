// 그림 모듈: 데일리·도전카드를 실제 종이 양식과 같은 모양으로 캔버스에 그린다.
// 좌표는 종이 사진(가로 1000 기준, 세로 1414 = 1 : 1.414)에서 잰 값이다.
import {
  HOURS, PRIS, STATUSES, COMMS,
  colorHex, pvTotal, fmtNum, toNum, weekdayKo, parseYmd, shortDate, initialOf, fitText, wrapText,
} from './forms.js';

export const FONT = '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const PAPER_W = 1000, PAPER_H = 1414;
const OUT_W = 1748;                     // 저장 이미지 가로 픽셀 (A5 300dpi)
const INK = '#141414';
const PEN = '#1F3D7A';                  // 동그라미·체크 표시 색 (펜 느낌)
const VAL = INK;                        // 사용자가 쓴 글 기본 색
const LINE = 1.1, BOLD = 2.4;
// 글자 크기 배율: 양식 글자·기입 글자 모두 이 비율로 키운다 (v2: 1.2배)
const TS = 1.2;

export async function ensureFonts() {
  if (!document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load(`400 20px ${FONT}`, '가나다 ABC 123'),
      document.fonts.load(`500 20px ${FONT}`, '가나다 ABC 123'),
      document.fonts.load(`700 20px ${FONT}`, '가나다 ABC 123'),
    ]);
  } catch { /* 글꼴을 못 받아도 기본 글꼴로 그린다 */ }
}

function makePaper() {
  const canvas = document.createElement('canvas');
  const s = OUT_W / PAPER_W;
  canvas.width = OUT_W;
  canvas.height = Math.round(PAPER_H * s);
  const ctx = canvas.getContext('2d');
  ctx.scale(s, s);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, PAPER_W, PAPER_H);
  ctx.lineCap = 'square';
  return { canvas, ctx };
}

// ── 그리기 도구 ──
function tools(ctx) {
  const font = (size, weight = 400) => `${weight} ${size}px ${FONT}`;
  const ln = (x1, y1, x2, y2, w = LINE, color = INK) => {
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };
  const rect = (x, y, w, h, lw = LINE) => { ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.strokeRect(x, y, w, h); };
  // raw*: 배율 없이 실제 크기. text/width/measureAt/fit 은 TS 배율을 곱한다
  const rawText = (str, x, y, { size = 15, weight = 400, align = 'left', color = INK, base = 'middle' } = {}) => {
    ctx.font = font(size, weight); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
    ctx.fillText(str, x, y);
  };
  const rawWidth = (str, size, weight = 400) => { ctx.font = font(size, weight); return ctx.measureText(str).width; };
  const rawMeasureAt = (size, weight = 400) => s => rawWidth(s, size, weight);
  const text = (str, x, y, o = {}) => rawText(str, x, y, { ...o, size: (o.size ?? 15) * TS });
  const width = (str, size, weight = 400) => rawWidth(str, size * TS, weight);
  // 상자 안에 글을 맞춰 넣기 (넘치면 글자를 줄인다)
  const fit = (str, x, y, w, h, { max = 15, min = 8, align = 'left', valign = 'middle', color = INK, oneLine = false, weight = 400, pad = 5, lineGap = 1.3 } = {}) => {
    if (str == null || String(str).trim() === '') return;
    max = Math.round(max * TS);
    const iw = w - pad * 2, ih = h - pad * 2;
    let r = fitText(sz => rawMeasureAt(sz, weight), str, iw, ih, { max, min, lineGap, oneLine });
    if (oneLine && r.size === min && rawWidth(r.lines[0], min, weight) > iw) {
      r = fitText(sz => rawMeasureAt(sz, weight), str, iw, ih, { max: min + 2, min, lineGap });
    }
    const lh = r.size * lineGap;
    const total = r.lines.length * lh - (lh - r.size);
    let ty = valign === 'top' ? y + pad : y + (h - total) / 2;
    const tx = align === 'center' ? x + w / 2 : align === 'right' ? x + w - pad : x + pad;
    for (const l of r.lines) { rawText(l, tx, ty + r.size / 2, { size: r.size, weight, align, color }); ty += lh; }
    return r;
  };
  const circle = (cx, cy, r, color = PEN, w = 1.8) => {
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  };
  const ellipse = (cx, cy, rx, ry, color = PEN, w = 1.8) => {
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  };
  const dot = (cx, cy, r, color = PEN) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); };
  const check = (x, cy, size, color = PEN) => {
    ctx.strokeStyle = color; ctx.lineWidth = size * 0.16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + size * 0.35, cy + size * 0.35); ctx.lineTo(x + size, cy - size * 0.45); ctx.stroke();
    ctx.lineCap = 'square';
  };
  return { font, ln, rect, text, width, rawText, rawMeasureAt, fit, circle, ellipse, dot, check };
}

// 시계 그림
function drawClock(ctx, cx, cy, r) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = r * 0.16; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = r * 0.07;
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    ctx.beginPath(); ctx.moveTo(cx + Math.sin(a) * r * 0.78, cy - Math.cos(a) * r * 0.78);
    ctx.lineTo(cx + Math.sin(a) * r * 0.88, cy - Math.cos(a) * r * 0.88); ctx.stroke();
  }
  ctx.lineWidth = r * 0.08; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - r * 0.62); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + r * 0.42, cy + r * 0.28); ctx.stroke();
  ctx.lineCap = 'square';
}

// 나침반 그림: N이 정확히 위(정북)를 향한다
function drawCompass(ctx, cx, cy, r) {
  ctx.strokeStyle = INK; ctx.fillStyle = INK;
  ctx.lineWidth = r * 0.06; ctx.beginPath(); ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = r * 0.03; ctx.beginPath(); ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2); ctx.stroke();
  // 대각선 짧은 바늘
  const point = (a, len, wid, fill) => {
    const tip = [cx + Math.sin(a) * len, cy - Math.cos(a) * len];
    const l = [cx + Math.sin(a - Math.PI / 2) * wid, cy - Math.cos(a - Math.PI / 2) * wid];
    const rr = [cx + Math.sin(a + Math.PI / 2) * wid, cy - Math.cos(a + Math.PI / 2) * wid];
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(...l); ctx.lineTo(...tip); ctx.closePath();
    ctx.fillStyle = fill ? INK : '#fff'; ctx.fill(); ctx.lineWidth = r * 0.03; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(...rr); ctx.lineTo(...tip); ctx.closePath();
    ctx.fillStyle = fill ? '#fff' : INK; ctx.fill(); ctx.stroke();
  };
  for (let i = 0; i < 4; i++) point(Math.PI / 4 + i * Math.PI / 2, r * 0.55, r * 0.1, false);
  for (let i = 0; i < 4; i++) point(i * Math.PI / 2, r * 1.0, r * 0.16, i === 0);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx, cy, r * 0.07, 0, Math.PI * 2); ctx.fill();
  ctx.font = `700 ${r * 0.34}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('N', cx, cy - r * 1.25);
}

// ════════════════ 데일리 ════════════════
export function renderDaily(d, nameOf) {
  const { canvas, ctx } = makePaper();
  const T = tools(ctx);
  // 사진 좌표 → 종이 좌표. v2: 시스템적 사고 상자를 빼고, 아래 부분(사진 472~1935)을 종이 높이 전체로 늘린다
  const k = 860 / 1252;
  const ky = (1369 - 112) / (1935 - 472);
  const X = x => 70 + (x - 105) * k;
  const Y = y => 112 + (y - 472) * ky;
  const H = (a, b) => Y(b) - Y(a);
  const W = (a, b) => X(b) - X(a);

  // 날짜
  const dt = parseYmd(d.date);
  const DY = 78;
  T.text('Date :', X(120), DY, { size: 17 });
  T.text(`${dt.getMonth() + 1}`, X(265), DY, { size: 20, align: 'right', color: VAL });
  T.text('월', X(290), DY, { size: 17, align: 'center' });
  T.text(`${dt.getDate()}`, X(370), DY, { size: 20, align: 'right', color: VAL });
  T.text('일 (', X(408), DY, { size: 17, align: 'center' });
  T.text(weekdayKo(d.date), X(475), DY, { size: 20, align: 'center', color: VAL });
  T.text(')', X(530), DY, { size: 17, align: 'center' });

  // ── 시급한 일 (왼쪽) ──
  const L0 = 105, L1 = 600, LT = 220, R0 = 650, R1 = 1357;
  T.ln(X(L1), Y(472), X(L1), Y(1935));
  T.ln(X(R0), Y(472), X(R0), Y(1935));
  T.text('시급한 일 (1상한 활동)', X(122), Y(512), { size: 16 });
  T.text('위기, 다급, 마감, 미팅, 준비', X(122), Y(556), { size: 14 });
  drawClock(ctx, X(525), Y(530), 27);
  const rowsL = [585];
  for (let i = 1; i <= HOURS.length; i++) rowsL.push(585 + (1490 - 585) * i / HOURS.length);
  rowsL.forEach(y => T.ln(X(L0), Y(y), X(L1), Y(y)));
  T.ln(X(LT), Y(585), X(LT), Y(1490));
  HOURS.forEach((h, i) => {
    const y0 = rowsL[i], y1 = rowsL[i + 1];
    T.text(h, X(165), (Y(y0) + Y(y1)) / 2, { size: 17, align: 'center' });
    const r = d.urgent[i];
    T.fit(r?.text, X(LT), Y(y0), W(LT, L1), H(y0, y1), { max: 21, min: 7, color: colorHex(r?.color) });
  });

  // Call 10: 3줄 × 4칸
  const callRows = [1490, 1550, 1612, 1673, 1735];
  callRows.forEach(y => T.ln(X(L0), Y(y), X(L1), Y(y)));
  T.text('Call 10', X(350), (Y(1490) + Y(1550)) / 2, { size: 15, align: 'center' });
  const cw = (L1 - L0) / 4;
  for (let c = 1; c < 4; c++) T.ln(X(L0 + cw * c), Y(1550), X(L0 + cw * c), Y(1735), 0.6, '#9a9a9a');
  (d.calls || []).slice(0, 12).forEach((call, i) => {
    const row = Math.floor(i / 4), col = i % 4;
    const x0 = X(L0 + cw * col), y0 = Y(callRows[row + 1]), y1 = Y(callRows[row + 2]);
    let x = x0 + 4;
    if (call.done) { T.check(x, (y0 + y1) / 2, 10); x += 13; }
    // 이름 / 한 일을 두 줄로 (칸이 좁아서 한 줄에 넣으면 글자가 너무 작아진다)
    const label = [nameOf(call.personId), call.action].filter(Boolean).join('\n');
    T.fit(label, x, y0, X(L0 + cw) - X(L0) - (x - x0) - 1, y1 - y0, { max: 16, min: 7, pad: 2, lineGap: 1.18, color: VAL });
  });

  // 기억해두기
  const memoRows = [1735, 1800, 1867, 1935];
  memoRows.slice(1, 3).forEach(y => T.ln(X(L0), Y(y), X(L1), Y(y)));
  T.text('기억 해두기', X(350), (Y(1735) + Y(1800)) / 2, { size: 15, align: 'center' });
  (d.memo || []).forEach((m, i) => {
    T.fit(m.text, X(L0), Y(memoRows[i + 1]), W(L0, L1), H(memoRows[i + 1], memoRows[i + 2]), { max: 20, min: 7, color: colorHex(m.color) });
  });

  // ── 중요한 일 (오른쪽) ──
  T.text('중요한 일 (2상한 활동)', X(662), Y(507), { size: 16 });
  T.text('준비, 예방, 가치규명, 계획, 관계, 재창조', X(662), Y(550), { size: 14 });
  drawCompass(ctx, X(1248), Y(533), 25);
  const rowsR = [575];
  for (let i = 1; i <= PRIS.length; i++) rowsR.push(575 + (1180 - 575) * i / PRIS.length);
  rowsR.forEach(y => T.ln(X(R0), Y(y), X(R1), Y(y)));
  T.ln(X(762), Y(575), X(762), Y(1180));
  T.ln(X(900), Y(575), X(900), Y(1180));
  PRIS.forEach((p, i) => {
    const y0 = rowsR[i], y1 = rowsR[i + 1], cy = (Y(y0) + Y(y1)) / 2;
    if (p) T.text(p, X(831), cy, { size: 17, align: 'center' });
    const r = d.important[i];
    if (!r) return;
    const cx = (X(R0) + X(762)) / 2;
    if (r.status === 'deleg') {
      const ini = initialOf(nameOf(r.delegateId));
      T.circle(cx, cy, 13 * TS);
      if (ini) T.text(ini, cx, cy + 0.5, { size: 13, align: 'center', color: PEN });
    } else if (r.status) {
      const st = STATUSES.find(s => s.key === r.status);
      if (st) T.text(st.mark, cx, cy, { size: { doing: 15, delay: 26 }[r.status] || 19, align: 'center', color: PEN, weight: 500 });
    }
    T.fit(r.text, X(900), Y(y0), W(900, R1), H(y0, y1), { max: 21, min: 7, color: colorHex(r.color) });
  });

  // 범례
  const legendY = (Y(1180) + Y(1243)) / 2;
  {
    const parts = [['V', '완료'], ['→', '연기'], ['×', '취소'], ['김', '위임'], ['●', '진행중']];
    const sz = 14, gap = 14;
    let tw = 0;
    const ws = parts.map(([m, l]) => { const w = (m === '김' ? 18 * TS : T.width(m, sz)) + 2 + T.width(l, sz); tw += w; return w; });
    tw += gap * (parts.length - 1);
    let x = (X(R0) + X(R1)) / 2 - tw / 2;
    parts.forEach(([m, l], i) => {
      if (m === '김') { const r = 9 * TS; T.circle(x + r, legendY, r, INK, 1.1); T.text('김', x + r, legendY + 0.5, { size: 10.5, align: 'center' }); x += r * 2 + 2; }
      else { T.text(m, x, legendY, { size: sz }); x += T.width(m, sz) + 2; }
      T.text(l, x, legendY, { size: sz }); x += T.width(l, sz) + gap;
      void ws[i];
    });
  }
  T.ln(X(R0), Y(1243), X(R1), Y(1243));

  // STP
  T.ln(X(900), Y(1243), X(900), Y(1365));
  T.ln(X(900), Y(1304), X(R1), Y(1304));
  T.ln(X(R0), Y(1365), X(R1), Y(1365));
  T.text('STP', X(775), (Y(1243) + Y(1365)) / 2, { size: 16, align: 'center' });
  [1243, 1304].forEach((y, i) => {
    T.fit(nameOf(d.stp?.[i]), X(900), Y(y), W(900, R1), H(1243, 1304), { max: 21, min: 8, color: VAL });
  });

  // 소비자 관리
  T.text('소비자 관리', X(1003), (Y(1365) + Y(1425)) / 2, { size: 16, align: 'center' });
  const cRows = [1425, 1487];
  for (let i = 1; i <= 5; i++) cRows.push(1487 + (1795 - 1487) * i / 5);
  cRows.push(1860, 1935);
  cRows.slice(0, -1).forEach(y => T.ln(X(R0), Y(y), X(R1), Y(y)));
  T.ln(X(765), Y(1425), X(765), Y(1860));
  T.ln(X(903), Y(1425), X(903), Y(1935));
  const midC = (a, b) => (Y(a) + Y(b)) / 2;
  T.text('이름', X(707), midC(1425, 1487), { size: 16, align: 'center' });
  T.text('PV', X(834), midC(1425, 1487), { size: 16, align: 'center' });
  T.text('전달  제품', X(1130), midC(1425, 1487), { size: 16, align: 'center' });
  (d.consumers || []).forEach((c, i) => {
    const y0 = cRows[i + 1], y1 = cRows[i + 2];
    T.fit(nameOf(c.personId), X(R0), Y(y0), W(R0, 765), H(y0, y1), { max: 16, min: 6, pad: 3, oneLine: true, color: VAL });
    if (String(c.pv ?? '').trim()) T.fit(fmtNum(toNum(c.pv)), X(765), Y(y0), W(765, 903), H(y0, y1), { max: 17, min: 7, pad: 4, align: 'right', oneLine: true, color: VAL });
    T.fit(c.product, X(903), Y(y0), W(903, R1), H(y0, y1), { max: 17, min: 7, color: VAL });
  });
  T.text('개인', X(707), midC(1795, 1860), { size: 16, align: 'center' });
  if (String(d.personal?.pv ?? '').trim()) T.fit(fmtNum(toNum(d.personal.pv)), X(765), Y(1795), W(765, 903), H(1795, 1860), { max: 17, min: 7, pad: 4, align: 'right', oneLine: true, color: VAL });
  T.fit(d.personal?.product, X(903), Y(1795), W(903, R1), H(1795, 1860), { max: 17, min: 7, color: VAL });
  T.text('합계', X(777), midC(1860, 1935), { size: 16, align: 'center' });
  T.text('PV', X(1348), midC(1860, 1935), { size: 15, align: 'right' });
  const total = pvTotal(d);
  if (total) T.text(fmtNum(total), X(1348) - T.width('PV', 15) - 8, midC(1860, 1935), { size: 19, align: 'right', color: VAL, weight: 500 });

  // 굵은 테두리
  T.rect(X(105), Y(472), W(105, 1357), H(472, 1935), BOLD);
  return canvas;
}

// ════════════════ 도전카드 ════════════════
export function renderCard(c, nameOf) {
  const { canvas, ctx } = makePaper();
  const T = tools(ctx);
  const k = 860 / 1240;
  const X = x => 70 + (x - 105) * k;
  const Y = y => 125 + (y - 150) * k;
  const H = (a, b) => Y(b) - Y(a);
  const W = (a, b) => X(b) - X(a);
  const mid = (a, b) => (Y(a) + Y(b)) / 2;
  const midX = (a, b) => (X(a) + X(b)) / 2;
  const RX = 1345;

  // 제목
  // 제목은 가운데, 일자는 오른쪽 끝에 맞춘다
  T.text('도전 카드', midX(105, RX), Y(100), { size: 30, weight: 700, align: 'center' });
  const ds = c.date ? shortDate(c.date) : '';
  const dsW = ds ? T.width(ds, 18) + 10 : 60;
  T.text('일자', X(RX) - dsW - T.width('일자', 16), Y(108), { size: 16 });
  if (ds) T.text(ds, X(RX), Y(108), { size: 18, color: VAL, align: 'right' });

  // v2: 대상 · 이름 한 줄만 남기고 (신/생/활, 관계, 상대 수준, 동기, 목표 상자는 뺌)
  //     방법 · 진행과 피드백 상자를 아래로 늘린다
  T.rect(X(105), Y(152), W(105, RX), H(152, 232), BOLD);
  // 대상 | 이름 구분선은 아래 방법 | 진행 구분선(630)과 맞춘다
  T.ln(X(630), Y(152), X(630), Y(232));
  T.text('대   상', midX(105, 630), mid(152, 232), { size: 18, align: 'center' });
  const nm = nameOf(c.personId);
  if (nm) T.fit(nm, X(630), Y(152), W(630, RX), H(152, 232), { max: 22, min: 10, align: 'center', oneLine: true, color: VAL, weight: 500 });
  else T.text('이   름', midX(630, RX), mid(152, 232), { size: 18, align: 'center' });

  // ── 상자 2·3: 방법 · 진행 ──
  const B3 = 255, B3H = 359, B3E = 1440;
  T.rect(X(105), Y(B3), W(105, RX), H(B3, B3E), BOLD);
  T.ln(X(105), Y(B3H), X(RX), Y(B3H));
  T.ln(X(630), Y(B3), X(630), Y(B3E));
  T.text('2. 방법 (How) :', midX(105, 630), Y(B3 + 34), { size: 17, align: 'center', weight: 500 });
  T.text('내가 질문할 것 (사전 계획)', midX(105, 630), Y(B3 + 76), { size: 17, align: 'center', weight: 500 });
  T.text('3. 진행(doing) :', midX(630, RX), Y(B3 + 34), { size: 17, align: 'center', weight: 500 });
  T.text('실제 진행된 것 (진행 결과)', midX(630, RX), Y(B3 + 76), { size: 17, align: 'center', weight: 500 });
  drawQA(T, c.qa || [], { qx: X(105), qw: W(105, 630), ax: X(630), aw: W(630, RX), y: Y(B3H), h: H(B3H, B3E) });

  // ── 상자 4: 피드백 ──
  T.rect(X(105), Y(1462), W(105, RX), H(1462, 1940), BOLD);
  T.ln(X(105), Y(1515), X(RX), Y(1515));
  T.text('4. 피드백(Feed Back) : 잘할 것, 보완할 것 (가치 성장)', X(125), mid(1462, 1515), { size: 17, weight: 500 });
  T.ln(X(320), Y(1515), X(320), Y(1940));
  const fr = [1515, 1600, 1685, 1770, 1855, 1940];
  fr.slice(1, 5).forEach(y => T.ln(X(105), Y(y), X(320), Y(y)));
  T.text('소통 4단계', midX(105, 320), mid(1515, 1600), { size: 16, align: 'center' });
  COMMS.forEach((cm, i) => {
    const cy = mid(fr[i + 1], fr[i + 2]);
    T.text(cm.label, midX(105, 320), cy, { size: 16, align: 'center' });
    if (c.comm === cm.n) T.ellipse(midX(105, 320), cy, T.width(cm.label, 16) / 2 + 10, 15 * TS);
  });
  T.fit(c.feedback, X(320), Y(1515), W(320, RX), H(1515, 1940), { max: 20, min: 6, valign: 'top', color: VAL, pad: 7 });
  return canvas;
}

// 방법·진행: 같은 번호의 질문과 결과를 같은 높이에서 시작
function drawQA(T, qa, { qx, qw, ax, aw, y, h }) {
  const pairs = qa.filter(p => (p.q || '').trim() || (p.a || '').trim());
  if (!pairs.length) return;
  const pad = 7, lineGap = 1.32, pairGap = 0.7;
  const qText = (p, i) => `${i + 1}. ${(p.q || '').trim()}`;
  let size = Math.round(20 * TS), layout;
  for (; size >= 6; size -= 0.5) {
    const m = T.rawMeasureAt(size);
    layout = pairs.map((p, i) => {
      const ql = wrapText(m, qText(p, i), qw - pad * 2);
      const al = (p.a || '').trim() ? wrapText(m, p.a.trim(), aw - pad * 2) : [];
      return { ql, al, rows: Math.max(ql.length, al.length) };
    });
    const total = layout.reduce((s, l) => s + l.rows, 0) * size * lineGap + (pairs.length - 1) * size * pairGap;
    if (total <= h - pad * 2) break;
  }
  size = Math.max(size, 6);
  const lh = size * lineGap;
  let cy = y + pad;
  for (const l of layout) {
    if (cy > y + h - pad) break;
    l.ql.forEach((t, j) => { if (cy + j * lh + size <= y + h) T.rawText(t, qx + pad, cy + j * lh + size / 2, { size, color: VAL }); });
    l.al.forEach((t, j) => { if (cy + j * lh + size <= y + h) T.rawText(t, ax + pad, cy + j * lh + size / 2, { size, color: VAL }); });
    cy += l.rows * lh + size * pairGap;
  }
}

export function toBlob(canvas) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}
