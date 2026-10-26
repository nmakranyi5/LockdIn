const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
// Usage: npx expo export --platform web --output-dir dist-web && node scripts/check-layout.js
// Needs: playwright. Env: ZOOM=1.3 (text size stress), ONLY="iPad", SHOTS=<dir> for screenshots.
const root = path.join(__dirname, '..', 'dist-web');
const srv = http.createServer((q, r) => {
  let f = path.join(root, q.url.split('?')[0]);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
  r.writeHead(200, {'content-type': {'.js':'text/javascript','.html':'text/html','.css':'text/css','.ttf':'font/ttf'}[path.extname(f)]||'application/octet-stream'});
  fs.createReadStream(f).pipe(r);
}).listen(8099, run);

const VIEWPORTS = [
  ['iPhone SE 1 (320x568)', 320, 568], ['Android small (360x640)', 360, 640], ['iPhone SE 2/3 (375x667)', 375, 667],
  ['iPhone 14 (390x844)', 390, 844], ['iPhone Pro Max (430x932)', 430, 932], ['iPad (768x1024)', 768, 1024],
  ['iPad landscape (1024x768)', 1024, 768], ['Phone landscape (667x375)', 667, 375], ['Phone landscape (844x390)', 844, 390],
  ['Desktop (1366x768)', 1366, 768],
];
const only = process.env.ONLY, shots = process.env.SHOTS;

function seed() {
  const mk = (id, h, extra) => { const s = new Date(); s.setHours(h,0,0,0); const e = new Date(s.getTime()+5400000); return { id, title: 'T'+id, startDate: s, endDate: e, startedAt:null, completedAt:null, ...extra }; };
  const y = new Date(); y.setDate(y.getDate()-1); y.setHours(9,0,0,0);
  return [
    mk('1', 9, { title: 'Prepare the quarterly business review presentation for leadership', kind:'timer', priority:'urgent', repeats:'weekdays' }),
    mk('2', 11, { title: 'Supercalifragilisticexpialidocious_unbrokenwordtitle_that_never_ends', kind:'oneshot', priority:'important' }),
    mk('3', 13, { title: 'Groceries', kind:'checklist', priority:'low', repeats:'monthly', items:[{id:'a',text:'Oat milk, the unsweetened organic kind from the good shop across town',done:false},{id:'b',text:'Eggs',done:true},{id:'c',text:'Sourdough bread and a few extra things for the weekend',done:false}] }),
    { id:'p1', title:'Yesterday', kind:'oneshot', startDate:y, endDate:new Date(y.getTime()+3600000), completedAt:y.getTime(), startedAt:y.getTime() },
  ];
}

async function run() {
  const b = await chromium.launch();
  const results = [];
  for (const [name, w, h] of VIEWPORTS) {
    if (only && !name.includes(only)) continue;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(t => { if (!localStorage.getItem('seeded')) { localStorage.setItem('seeded','1'); localStorage.setItem('hasSeenHelp','true'); localStorage.setItem('hasSeenTaskHelp','true'); localStorage.setItem('@lockdin_tasks', t); } }, JSON.stringify(seed()));
    await p.goto('http://localhost:8099/'); await p.waitForTimeout(1500);
    if (process.env.ZOOM) { await p.addStyleTag({ content: `html{zoom:${process.env.ZOOM}}` }); await p.waitForTimeout(300); }

    // Reports elements that stick out of the viewport, plus whether named controls are fully visible.
    const check = async (scene, mustSee = []) => {
      const r = await p.evaluate(({ mustSee }) => {
        const vw = innerWidth, vh = innerHeight, bad = [];
        const label = (el) => (el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 30);
        for (const el of document.querySelectorAll('body *')) {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          // content of an intentional horizontal scroller may extend past the screen
          let inScroller = false;
          for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if ((o === 'auto' || o === 'scroll') && a.scrollWidth > a.clientWidth + 1 && a.getBoundingClientRect().right <= vw + 1) { inScroller = true; break; } }
          if (inScroller) continue;
          if (r.right > vw + 1 || r.left < -1) {
            // ignore children of clipped horizontally-scrolling rows
            bad.push(`h-overflow <${el.tagName.toLowerCase()}> "${label(el)}" [${Math.round(r.left)}..${Math.round(r.right)}] vw=${vw}`);
          }
        }
        const missing = [];
        for (const text of mustSee) {
          const el = [...document.querySelectorAll('body *')].filter(e => (e.getAttribute('aria-label') === text) || (e.children.length === 0 && e.innerText && e.innerText.trim() === text)).pop();
          if (!el) { missing.push(`not found: ${text}`); continue; }
          const r = el.getBoundingClientRect();
          if (r.bottom > vh + 1 || r.top < -1 || r.right > vw + 1 || r.left < -1) missing.push(`off-screen: ${text} [top ${Math.round(r.top)} bottom ${Math.round(r.bottom)}] vh=${vh}`);
        }
        return { bad: [...new Set(bad)].slice(0, 6), missing, docOverflow: document.documentElement.scrollWidth > vw + 1 };
      }, { mustSee });
      const issues = [...r.bad, ...r.missing, ...(r.docOverflow ? ['document scrolls horizontally'] : [])];
      results.push({ vp: name, scene, issues });
      if (shots) await p.screenshot({ path: path.join(shots, `${w}x${h}-${scene.replace(/\W+/g,'_')}.png`) });
    };
    const tap = async (loc, what) => {
      try { await loc.click({ timeout: 2500 }); }
      catch (e) { results.push({ vp: name, scene: 'click: ' + what, issues: ['control is covered or unreachable: ' + what] }); await loc.click({ force: true, timeout: 2000 }).catch(() => {}); }
    };
    const clickText = (t) => tap(p.getByText(t, { exact: true }).last(), t);

    await check('home', ['Profile', 'Help', 'Settings', 'Add task', 'LockdIn']);
    await clickText('Add task'); await p.waitForTimeout(400);
    await check('add-modal', ['Save', 'Close']);
    await clickText('Checklist'); await clickText('Add item'); await p.waitForTimeout(200);
    await check('add-modal checklist', ['Save', 'Close']);
    await tap(p.getByLabel('Close').last(), 'Close'); await p.waitForTimeout(300);
    await tap(p.getByLabel('Help').first(), 'Help'); await p.waitForTimeout(300);
    await check('help', ['Continue']);
    await clickText('Continue'); await p.waitForTimeout(300);
    await tap(p.getByLabel('Settings').first(), 'Settings'); await p.waitForTimeout(300);
    await check('settings', ['Done']);
    await clickText('Done'); await p.waitForTimeout(300);
    await tap(p.getByLabel('Delete task').first(), 'Delete task'); await p.waitForTimeout(300);
    await check('delete-repeat', ['Cancel']);
    await clickText('Cancel'); await p.waitForTimeout(300);
    await tap(p.getByLabel('Profile').first(), 'Profile'); await p.waitForTimeout(500);
    await check('profile (top)', ['Close']);
    await p.evaluate(() => { for (const e of document.querySelectorAll('*')) if (e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY)) e.scrollTop = e.scrollHeight; });
    await p.waitForTimeout(300);
    await check('profile (bottom)', ['Close', '100']);
    if (errs.length) results.push({ vp: name, scene: 'js errors', issues: errs.slice(0,2) });
    await ctx.close();
  }
  const fails = results.filter(r => r.issues.length);
  for (const f of fails) console.log(`✗ ${f.vp} :: ${f.scene}\n    ` + f.issues.join('\n    '));
  console.log(`\n${results.length - fails.length}/${results.length} scenes clean`);
  await b.close(); srv.close();
}
