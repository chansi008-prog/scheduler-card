// PNG 숨은 기록: 저장하는 이미지 파일 안(iTXt 조각)에 양식 기록을 넣고, 다시 꺼낸다.
// 그림에는 보이지 않는다. 카톡처럼 이미지를 다시 압축하면 지워진다.

export const KEYWORD = 'scheduler-card';
const SIG = [137, 80, 78, 71, 13, 10, 26, 10];

let table;
function crc32(bytes) {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function isPng(b) {
  return b.length > 8 && SIG.every((v, i) => b[i] === v);
}

// 조각 목록: { type, start(길이 위치), dataStart, length }
function chunks(b) {
  const out = [];
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let p = 8;
  while (p + 12 <= b.length) {
    const length = dv.getUint32(p);
    const type = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
    out.push({ type, start: p, dataStart: p + 8, length });
    p += 12 + length;
    if (type === 'IEND') break;
  }
  return out;
}

function makeITXt(keyword, text) {
  const enc = new TextEncoder();
  const kw = enc.encode(keyword);
  const tx = enc.encode(text);
  // 키워드\0 압축안함(0) 방식(0) 언어\0 번역키워드\0 본문
  const data = new Uint8Array(kw.length + 5 + tx.length);
  data.set(kw, 0);
  let p = kw.length;
  data[p++] = 0; data[p++] = 0; data[p++] = 0; data[p++] = 0; data[p++] = 0;
  data.set(tx, p);
  const chunk = new Uint8Array(12 + data.length);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, data.length);
  chunk.set([105, 84, 88, 116], 4); // 'iTXt'
  chunk.set(data, 8);
  dv.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
}

// PNG 바이트에 기록을 넣는다 (IEND 바로 앞)
export function embedText(bytes, text, keyword = KEYWORD) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (!isPng(b)) throw new Error('PNG 파일이 아니에요');
  const iend = chunks(b).find(c => c.type === 'IEND');
  if (!iend) throw new Error('PNG 끝을 찾지 못했어요');
  const add = makeITXt(keyword, text);
  const out = new Uint8Array(b.length + add.length);
  out.set(b.subarray(0, iend.start), 0);
  out.set(add, iend.start);
  out.set(b.subarray(iend.start), iend.start + add.length);
  return out;
}

// PNG 바이트에서 기록을 꺼낸다. 없으면 null
export function extractText(bytes, keyword = KEYWORD) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (!isPng(b)) return null;
  const dec = new TextDecoder();
  for (const c of chunks(b)) {
    if (c.type !== 'iTXt' && c.type !== 'tEXt') continue;
    const data = b.subarray(c.dataStart, c.dataStart + c.length);
    const z = data.indexOf(0);
    if (z < 0 || dec.decode(data.subarray(0, z)) !== keyword) continue;
    if (c.type === 'tEXt') return dec.decode(data.subarray(z + 1));
    if (data[z + 1] !== 0) continue;             // 압축된 것은 쓰지 않음
    let p = z + 3;
    p = data.indexOf(0, p) + 1;                  // 언어
    p = data.indexOf(0, p) + 1;                  // 번역 키워드
    return dec.decode(data.subarray(p));
  }
  return null;
}
