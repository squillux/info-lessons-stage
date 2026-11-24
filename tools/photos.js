/* 위키미디어 공용 사진 도우미 (자유 이용 허락 사진만)
   후보 찾기:  node tools/photos.js find <요청.json> <후보폴더>   요청 = [{key, q}]  → 후보 사진(작게)과 cand.json, sheet.html
   내려받기:   node tools/photos.js get <후보폴더> key=번호 ...   → assets/photos/key.jpg + assets/photos/credits.json 갱신 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'assets/photos');
const UA = {'User-Agent': 'info-lessons-builder/1.0 (educational non-commercial site)'};
const OK = /^(CC0|CC BY(-SA)? [0-9.]+|Public domain|PD|CC BY [0-9.]+)/i;
const api = q => 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams(Object.assign({action: 'query', format: 'json'}, q));
const strip = s => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const wait = ms => new Promise(r => setTimeout(r, ms));
async function get(url){ for (let i = 0; i < 6; i++){ try { await wait(700); const r = await fetch(url, {headers: UA}); if (r.ok) return r; if (r.status === 429) await wait(8000 * (i + 1)); } catch (e){} await wait(2000); } throw new Error('fetch ' + url); }

async function find(reqFile, dir){
  const reqs = JSON.parse(fs.readFileSync(reqFile, 'utf8')); fs.mkdirSync(dir, {recursive: true});
  const all = {};
  for (const {key, q, n = 6} of reqs){
    const j = await (await get(api({generator: 'search', gsrnamespace: 6, gsrsearch: q + ' filetype:bitmap', gsrlimit: 20, prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: 320}))).json();
    const pages = Object.values((j.query || {}).pages || {}).sort((a, b) => a.index - b.index);
    const c = [];
    for (const p of pages){
      const i = p.imageinfo && p.imageinfo[0]; if (!i || !/jpeg/.test(i.mime) || i.width < 900) continue;
      const m = i.extmetadata || {}, lic = strip(m.LicenseShortName && m.LicenseShortName.value);
      if (!OK.test(lic)) continue;
      c.push({title: p.title, page: i.descriptionurl, author: strip(m.Artist && m.Artist.value).slice(0, 80), license: lic, thumb: i.thumburl});
      if (c.length >= n) break;
    }
    for (let k = 0; k < c.length; k++){ const b = Buffer.from(await (await get(c[k].thumb)).arrayBuffer()); fs.writeFileSync(path.join(dir, `${key}_${k}.jpg`), b); }
    all[key] = c; console.log(key, c.length);
  }
  fs.writeFileSync(path.join(dir, 'cand.json'), JSON.stringify(all, null, 1));
  fs.writeFileSync(path.join(dir, 'sheet.html'), `<!doctype html><meta charset="utf-8"><body style="font:12px sans-serif;margin:8px">${Object.entries(all).map(([k, c]) => `<div style="margin:6px 0"><b>${k}</b><div style="display:flex;gap:4px">${c.map((x, i) => `<div style="width:160px"><img src="${k}_${i}.jpg" style="width:160px;height:110px;object-fit:cover"><br>${i}: ${x.license}</div>`).join('')}</div></div>`).join('')}</body>`);
}

async function getChosen(dir, picks){
  const cand = JSON.parse(fs.readFileSync(path.join(dir, 'cand.json'), 'utf8'));
  fs.mkdirSync(OUT, {recursive: true});
  const credFile = path.join(OUT, 'credits.json'), cred = fs.existsSync(credFile) ? JSON.parse(fs.readFileSync(credFile, 'utf8')) : {};
  for (const pk of picks){
    const [key, idx, name] = pk.split(/[=:]/); const c = cand[key][+idx]; const out = name || key;
    const j = await (await get(api({titles: c.title, prop: 'imageinfo', iiprop: 'url', iiurlwidth: 800}))).json();
    const u = Object.values(j.query.pages)[0].imageinfo[0].thumburl;
    fs.writeFileSync(path.join(OUT, out + '.jpg'), Buffer.from(await (await get(u)).arrayBuffer()));
    cred[out] = {title: c.title.replace(/^File:/, ''), author: c.author, license: c.license, page: c.page};
    console.log('saved', out, fs.statSync(path.join(OUT, out + '.jpg')).size);
  }
  fs.writeFileSync(credFile, JSON.stringify(cred, null, 1));
}

const [cmd, a, ...rest] = process.argv.slice(2);
(cmd === 'find' ? find(a, rest[0]) : getChosen(a, rest)).catch(e => { console.error(e.message); process.exit(1); });
