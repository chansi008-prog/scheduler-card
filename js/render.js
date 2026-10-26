// 그림 모듈: 데일리·도전카드를 실제 종이 양식과 같은 모양으로 캔버스에 그린다.
// 좌표는 종이 사진(가로 1000 기준, 세로 1414 = 1 : 1.414)에서 잰 값이다.
import {
  HOURS, PRIS, SYS_FIELDS, STATUSES, SSH, MOTIVES, COMMS,
  colorHex, pvTotal, fmtNum, toNum, weekdayKo, parseYmd, shortDate, initialOf, fitText, wrapText,
} from './forms.js';

export const FONT = '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const PAPER_W = 1000, PAPER_H = 1414;
const OUT_W = 1748;                     // 저장 이미지 가로 픽셀 (A5 300dpi)
const INK = '#141414';
const PEN = '#1F3D7A';                  // 동그라미·체크 표시 색 (펜 느낌)
const VAL = INK;                        // 사용자가 쓴 글 기본 색
const LINE = 1.1, BOLD = 2.4;

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
  const text = (str, x, y, { size = 15, weight = 400, align = 'left', color = INK, base = 'middle' } = {}) => {
    ctx.font = font(size, weight); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
    ctx.fillText(str, x, y);
  };
  const width = (str, size, weight = 400) => { ctx.font = font(size, weight); return ctx.measureText(str).width; };
  const measureAt = (size, weight = 400) => s => width(s, size, weight);
  // 상자 안에 글을 맞춰 넣기 (넘치면 글자를 줄인다)
  const fit = (str, x, y, w, h, { max = 15, min = 8, align = 'left', valign = 'middle', color = INK, oneLine = false, weight = 400, pad = 5, lineGap = 1.3 } = {}) => {
    if (str == null || String(str).trim() === '') return;
    const iw = w - pad * 2, ih = h - pad * 2;
    let r = fitText(sz => measureAt(sz, weight), str, iw, ih, { max, min, lineGap, oneLine });
    if (oneLine && r.size === min && width(r.lines[0], min, weight) > iw) {
      r = fitText(sz => measureAt(sz, weight), str, iw, ih, { max: min + 2, min, lineGap });
    }
    const lh = r.size * lineGap;
    const total = r.lines.length * lh - (lh - r.size);
    let ty = valign === 'top' ? y + pad : y + (h - total) / 2;
    const tx = align === 'center' ? x + w / 2 : align === 'right' ? x + w - pad : x + pad;
    for (const l of r.lines) { text(l, tx, ty + r.size / 2, { size: r.size, weight, align, color }); ty += lh; }
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
  return { font, ln, rect, text, width, measureAt, fit, circle, ellipse, dot, check };
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
  // 사진 좌표 → 종이 좌표
  const k = 860 / 1252;
  const X = x => 70 + (x - 105) * k;
  const Y = y => 112 + (y - 105) * k;
  const H = (a, b) => Y(b) - Y(a);
  const W = (a, b) => X(b) - X(a);

  // 날짜
  const dt = parseYmd(d.date);
  T.text('Date :', X(120), Y(58), { size: 17 });
  T.text(`${dt.getMonth() + 1}`, X(265), Y(58), { size: 20, align: 'right', color: VAL });
  T.text('월', X(290), Y(58), { size: 17, align: 'center' });
  T.text(`${dt.getDate()}`, X(370), Y(58), { size: 20, align: 'right', color: VAL });
  T.text('일 (', X(408), Y(58), { size: 17, align: 'center' });
  T.text(weekdayKo(d.date), X(475), Y(58), { size: 20, align: 'center', color: VAL });
  T.text(')', X(530), Y(58), { size: 17, align: 'center' });

  // ── 시스템적 사고 ──
  const top = [105, 168, 229, 290, 351, 412, 472];
  for (let i = 1; i < top.length - 1; i++) T.ln(X(105), Y(top[i]), X(1357), Y(top[i]));
  // 요일 문구가 있으면 "시스템적 사고 : 문구" (길면 왼쪽부터 쓰고 글자를 줄인다)
  const theme = (d.theme || '').trim();
  const label = theme ? '시스템적 사고 : ' : '시스템적 사고';
  const fullW = T.width(label, 17) + T.width(theme, 17);
  if (fullW <= W(105, 1357) - 30) {
    const x0 = X(731) - fullW / 2;
    T.text(label, x0, Y(136), { size: 17 });
    if (theme) T.text(theme, x0 + T.width(label, 17), Y(136), { size: 17, color: VAL });
  } else {
    T.text(label, X(120), Y(136), { size: 17 });
    const lx = X(120) + T.width(label, 17);
    T.fit(theme, lx, Y(105), X(1350) - lx, H(105, 168), { max: 19, min: 8, pad: 0, color: VAL });
  }
  SYS_FIELDS.forEach((f, i) => {
    const y0 = top[i + 1], y1 = top[i + 2];
    const label = `${f.label}:`;
    T.text(label, X(118), (Y(y0) + Y(y1)) / 2, { size: 15 });
    const lx = X(118) + T.width(label, 15) + 6;
    T.fit(d.sys?.[f.key], lx, Y(y0), X(1357) - lx, H(y0, y1), { max: 19, min: 8, pad: 3, color: VAL });
  });

  // ── 시급한 일 (왼쪽) ──
  const L0 = 105, L1 = 600, LT = 220, R0 = 650, R1 = 1357;
  T.ln(X(L1), Y(472), X(L1), Y(1935));
  T.ln(X(R0), Y(472), X(R0), Y(1935));
  T.text('시급한 일 (1상한 활동)', X(122), Y(512), { size: 16 });
  T.text('위기, 다급, 마감, 미팅, 준비', X(122), Y(556), { size: 14 });
  drawClock(ctx, X(525), Y(530), 24);
  const rowsL = [585];
  for (let i = 1; i <= HOURS.length; i++) rowsL.push(585 + (1490 - 585) * i / HOURS.length);
  rowsL.forEach(y => T.ln(X(L0), Y(y), X(L1), Y(y)));
  T.ln(X(LT), Y(585), X(LT), Y(1490));
  HOURS.forEach((h, i) => {
    const y0 = rowsL[i], y1 = rowsL[i + 1];
    T.text(h, X(165), (Y(y0) + Y(y1)) / 2, { size: 15, align: 'center' });
    const r = d.urgent[i];
    T.fit(r?.text, X(LT), Y(y0), W(LT, L1), H(y0, y1), { max: 19, min: 7, color: colorHex(r?.color) });
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
    T.fit(label, x, y0, X(L0 + cw) - X(L0) - (x - x0) - 1, y1 - y0, { max: 14, min: 7, pad: 2, lineGap: 1.18, color: VAL });
  });

  // 기억해두기
  const memoRows = [1735, 1800, 1867, 1935];
  memoRows.slice(1, 3).forEach(y => T.ln(X(L0), Y(y), X(L1), Y(y)));
  T.text('기억 해두기', X(350), (Y(1735) + Y(1800)) / 2, { size: 15, align: 'center' });
  (d.memo || []).forEach((m, i) => {
    T.fit(m.text, X(L0), Y(memoRows[i + 1]), W(L0, L1), H(memoRows[i + 1], memoRows[i + 2]), { max: 18, min: 7, color: colorHex(m.color) });
  });

  // ── 중요한 일 (오른쪽) ──
  T.text('중요한 일 (2상한 활동)', X(662), Y(507), { size: 16 });
  T.text('준비, 예방, 가치규명, 계획, 관계, 재창조', X(662), Y(550), { size: 14 });
  drawCompass(ctx, X(1248), Y(530), 23);
  const rowsR = [575];
  for (let i = 1; i <= PRIS.length; i++) rowsR.push(575 + (1180 - 575) * i / PRIS.length);
  rowsR.forEach(y => T.ln(X(R0), Y(y), X(R1), Y(y)));
  T.ln(X(762), Y(575), X(762), Y(1180));
  T.ln(X(900), Y(575), X(900), Y(1180));
  PRIS.forEach((p, i) => {
    const y0 = rowsR[i], y1 = rowsR[i + 1], cy = (Y(y0) + Y(y1)) / 2;
    if (p) T.text(p, X(831), cy, { size: 15, align: 'center' });
    const r = d.important[i];
    if (!r) return;
    const cx = (X(R0) + X(762)) / 2;
    if (r.status === 'deleg') {
      const ini = initialOf(nameOf(r.delegateId));
      T.circle(cx, cy, 13);
      if (ini) T.text(ini, cx, cy + 0.5, { size: 13, align: 'center', color: PEN });
    } else if (r.status) {
      const st = STATUSES.find(s => s.key === r.status);
      if (st) T.text(st.mark, cx, cy, { size: r.status === 'doing' ? 15 : 19, align: 'center', color: PEN, weight: 500 });
    }
    T.fit(r.text, X(900), Y(y0), W(900, R1), H(y0, y1), { max: 19, min: 7, color: colorHex(r.color) });
  });

  // 범례
  const legendY = (Y(1180) + Y(1243)) / 2;
  {
    const parts = [['V', '완료'], ['→', '연기'], ['×', '취소'], ['김', '위임'], ['●', '진행중']];
    const sz = 14, gap = 14;
    let tw = 0;
    const ws = parts.map(([m, l]) => { const w = (m === '김' ? 19 : T.width(m, sz)) + 2 + T.width(l, sz); tw += w; return w; });
    tw += gap * (parts.length - 1);
    let x = (X(R0) + X(R1)) / 2 - tw / 2;
    parts.forEach(([m, l], i) => {
      if (m === '김') { T.circle(x + 9, legendY, 9, INK, 1.1); T.text('김', x + 9, legendY + 0.5, { size: 10.5, align: 'center' }); x += 19 + 2; }
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
    T.fit(nameOf(d.stp?.[i]), X(900), Y(y), W(900, R1), H(1243, 1304), { max: 19, min: 8, color: VAL });
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
  T.rect(X(105), Y(105), W(105, 1357), H(105, 1935), BOLD);
  T.ln(X(105), Y(472), X(1357), Y(472), BOLD);
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
  T.text('도전 카드', X(622), Y(100), { size: 30, weight: 700, align: 'center' });
  T.text('일자', X(930), Y(108), { size: 16 });
  if (c.date) T.text(shortDate(c.date), X(930) + T.width('일자', 16) + 10, Y(108), { size: 18, color: VAL });

  // ── 상자 1: 기본 정보 ──
  const b1 = [152, 215, 280, 345, 408];
  T.rect(X(105), Y(152), W(105, RX), H(152, 408), BOLD);
  b1.slice(1, 4).forEach(y => T.ln(X(105), Y(y), X(RX), Y(y)));
  [522, 922].forEach(x => T.ln(X(x), Y(152), X(x), Y(280)));
  [318, 522, 728, 922, 1030, 1137, 1243].forEach(x => T.ln(X(x), Y(280), X(x), Y(408)));
  T.text('대   상', midX(105, 522), mid(152, 215), { size: 17, align: 'center' });
  const nm = nameOf(c.personId);
  if (nm) T.fit(nm, X(522), Y(152), W(522, 922), H(152, 215), { max: 21, min: 10, align: 'center', oneLine: true, color: VAL, weight: 500 });
  else T.text('이   름', midX(522, 922), mid(152, 215), { size: 17, align: 'center' });
  // 신 / 생 / 활
  const sshX = [1012, 1140, 1265];
  SSH.forEach((ch, i) => {
    T.text(ch, X(sshX[i]), mid(152, 215), { size: 17, align: 'center' });
    if (c.ssh === ch) T.circle(X(sshX[i]), mid(152, 215), 15);
  });
  [1076, 1203].forEach(x => T.text('/', X(x), mid(152, 215), { size: 17, align: 'center' }));
  T.text('관계(발달4단계)', midX(105, 522), mid(215, 280), { size: 16, align: 'center' });
  T.text('상대 수준 (나의 역할)', midX(522, 922), mid(215, 280), { size: 16, align: 'center' });
  T.text('동기 (Process 4단계)', midX(922, RX), mid(215, 280), { size: 16, align: 'center' });
  [['개인적', 105, 318], ['사업적', 318, 522], ['상대', 522, 728], ['나', 728, 922]].forEach(([t, a, b]) =>
    T.text(t, midX(a, b), mid(280, 345), { size: 16, align: 'center' }));
  const mx = [922, 1030, 1137, 1243, RX];
  MOTIVES.forEach((t, i) => T.fit(t, X(mx[i]), Y(280), W(mx[i], mx[i + 1]), H(280, 345), { max: 16, min: 10, align: 'center', oneLine: true, pad: 2 }));
  // 값
  if (c.relPersonal) T.text(String(c.relPersonal), midX(105, 318), mid(345, 408), { size: 21, align: 'center', color: VAL });
  if (c.relBusiness) T.text(String(c.relBusiness), midX(318, 522), mid(345, 408), { size: 21, align: 'center', color: VAL });
  T.fit(c.them, X(522), Y(345), W(522, 728), H(345, 408), { max: 18, min: 7, align: 'center', color: VAL, pad: 3 });
  T.fit(c.me, X(728), Y(345), W(728, 922), H(345, 408), { max: 18, min: 7, align: 'center', color: VAL, pad: 3 });
  const mi = MOTIVES.indexOf(c.motive);
  if (mi >= 0) T.dot(midX(mx[mi], mx[mi + 1]), mid(345, 408), 7);

  // ── 상자 2: 목표 ──
  T.rect(X(105), Y(428), W(105, RX), H(428, 852), BOLD);
  [485, 538, 592].forEach(y => T.ln(X(105), Y(y), X(RX), Y(y)));
  T.text('1. 목표(What) : 상대를 위하여 내가 달성하고 싶은 것 (사전 계획)', X(125), mid(428, 485), { size: 17, weight: 500 });
  [522, 922].forEach(x => T.ln(X(x), Y(485), X(x), Y(538)));
  [['당월', 105, 522, 'm0'], ['익월', 522, 922, 'm1'], ['익익월', 922, RX, 'm2']].forEach(([t, a, b, key]) => {
    T.text(t, X(a) + 6, mid(485, 538), { size: 15 });
    const lx = X(a) + 6 + T.width(t, 15) + 6;
    T.fit(c.goal?.[key], lx, Y(485), X(b) - lx, H(485, 538), { max: 18, min: 7, pad: 2, color: VAL });
  });
  const gx = [105, 628, 731, 1032, RX];
  [628, 731, 1032].forEach(x => T.ln(X(x), Y(538), X(x), Y(852)));
  [['저량 (Level)'], ['Why'], ['유입 (What)'], ['유출 (What)']].forEach(([t], i) =>
    T.fit(t, X(gx[i]), Y(538), W(gx[i], gx[i + 1]), H(538, 592), { max: 16, min: 9, align: 'center', oneLine: true, pad: 2 }));
  ['stock', 'why', 'inflow', 'outflow'].forEach((key, i) =>
    T.fit(c[key], X(gx[i]), Y(592), W(gx[i], gx[i + 1]), H(592, 852), { max: key === 'why' ? 15 : 18, min: 6, valign: 'top', color: VAL, pad: key === 'why' ? 3 : 6 }));

  // ── 상자 3: 방법 · 진행 ──
  T.rect(X(105), Y(868), W(105, RX), H(868, 1595), BOLD);
  T.ln(X(105), Y(972), X(RX), Y(972));
  T.ln(X(630), Y(868), X(630), Y(1595));
  T.text('2. 방법 (How) :', midX(105, 630), Y(902), { size: 17, align: 'center', weight: 500 });
  T.text('내가 질문할 것 (사전 계획)', midX(105, 630), Y(944), { size: 17, align: 'center', weight: 500 });
  T.text('3. 진행(doing) :', midX(630, RX), Y(902), { size: 17, align: 'center', weight: 500 });
  T.text('실제 진행된 것 (진행 결과)', midX(630, RX), Y(944), { size: 17, align: 'center', weight: 500 });
  drawQA(T, c.qa || [], { qx: X(105), qw: W(105, 630), ax: X(630), aw: W(630, RX), y: Y(972), h: H(972, 1595) });

  // ── 상자 4: 피드백 ──
  T.rect(X(105), Y(1602), W(105, RX), H(1602, 1940), BOLD);
  T.ln(X(105), Y(1655), X(RX), Y(1655));
  T.text('4. 피드백(Feed Back) : 잘할 것, 보완할 것 (가치 성장)', X(125), mid(1602, 1655), { size: 17, weight: 500 });
  T.ln(X(320), Y(1655), X(320), Y(1940));
  const fr = [1655, 1712, 1768, 1825, 1882, 1940];
  fr.slice(1, 5).forEach(y => T.ln(X(105), Y(y), X(320), Y(y)));
  T.text('소통 4단계', midX(105, 320), mid(1655, 1712), { size: 16, align: 'center' });
  COMMS.forEach((cm, i) => {
    const cy = mid(fr[i + 1], fr[i + 2]);
    T.text(cm.label, midX(105, 320), cy, { size: 16, align: 'center' });
    if (c.comm === cm.n) T.ellipse(midX(105, 320), cy, T.width(cm.label, 16) / 2 + 9, 15);
  });
  T.fit(c.feedback, X(320), Y(1655), W(320, RX), H(1655, 1940), { max: 18, min: 6, valign: 'top', color: VAL, pad: 7 });
  return canvas;
}

// 방법·진행: 같은 번호의 질문과 결과를 같은 높이에서 시작
function drawQA(T, qa, { qx, qw, ax, aw, y, h }) {
  const pairs = qa.filter(p => (p.q || '').trim() || (p.a || '').trim());
  if (!pairs.length) return;
  const pad = 7, lineGap = 1.32, pairGap = 0.7;
  const qText = (p, i) => `${i + 1}. ${(p.q || '').trim()}`;
  let size = 18, layout;
  for (; size >= 6; size -= 0.5) {
    const m = T.measureAt(size);
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
    l.ql.forEach((t, j) => { if (cy + j * lh + size <= y + h) T.text(t, qx + pad, cy + j * lh + size / 2, { size, color: VAL }); });
    l.al.forEach((t, j) => { if (cy + j * lh + size <= y + h) T.text(t, ax + pad, cy + j * lh + size / 2, { size, color: VAL }); });
    cy += l.rows * lh + size * pairGap;
  }
}

export function toBlob(canvas) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}
