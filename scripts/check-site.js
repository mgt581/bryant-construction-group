const fs = require('fs');
const path = require('path');

const pages = fs.readdirSync('.').filter((file) => file.endsWith('.html')).sort();
const existingFiles = new Set();
const existingDirs = new Set();

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name).replace(/^\.\//, '');
    if (entry.isDirectory()) {
      existingDirs.add(filePath);
      walk(filePath);
    } else {
      existingFiles.add(filePath);
    }
  }
}

function isLocalReference(value) {
  return value && !/^(https?:|mailto:|tel:|sms:|#|javascript:)/i.test(value) && !value.includes('${');
}

function referenceExists(value) {
  return existingFiles.has(value) || existingDirs.has(value);
}

walk('.');

let ok = true;

for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  const title = (html.match(/<title>([^<]+)<\/title>/) || [, ''])[1];
  const h1Count = [...html.matchAll(/<h1\b/gi)].length;
  const requiredHeaderHooks = [
    'class="mobile-header-actions"',
    'class="nav-toggle"',
    'class="main-nav" id="mobileNav"',
    'class="mobile-menu-quote"'
  ];

  if (title.length > 65) {
    ok = false;
    console.error(`${page}: title is ${title.length} characters`);
  }

  if (h1Count !== 1) {
    ok = false;
    console.error(`${page}: expected 1 h1, found ${h1Count}`);
  }

  for (const hook of requiredHeaderHooks) {
    if (!html.includes(hook)) {
      ok = false;
      console.error(`${page}: missing header hook ${hook}`);
    }
  }

  if (html.includes('assets/bcg.png')) {
    ok = false;
    console.error(`${page}: use assets/bcg.PNG or an optimized display asset, not assets/bcg.png`);
  }

  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    const tag = match[0];
    const src = (tag.match(/src=["']([^"']+)/i) || [, ''])[1];
    if (!/\swidth=["']/.test(tag) || !/\sheight=["']/.test(tag)) {
      ok = false;
      console.error(`${page}: image missing width/height: ${src}`);
    }
  }

  for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/gi)) {
    const value = match[1];
    if (!isLocalReference(value)) continue;
    const clean = decodeURIComponent(value.split('#')[0].split('?')[0]);
    if (clean && !referenceExists(clean)) {
      ok = false;
      console.error(`${page}: missing local reference ${value}`);
    }
  }

  for (const match of html.matchAll(/['"](assets\/[^'"]+?)['"]/g)) {
    const value = match[1];
    if (value.includes('${')) continue;
    if (!referenceExists(value)) {
      ok = false;
      console.error(`${page}: missing scripted asset ${value}`);
    }
  }
}

if (ok) {
  console.log(`OK: ${pages.length} HTML pages passed site checks.`);
}

process.exit(ok ? 0 : 1);
