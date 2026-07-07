import fs from 'fs';

let html = fs.readFileSync('dist-singlefile/index.html', 'utf8');
const js = fs.readFileSync('dist-singlefile/bundle.js', 'utf8');

// Replace the external module script tag with a plain inline <script>.
// (A classic inline script works from file://; type="module" would be blocked.)
// Use a function replacement so `$` sequences in the minified JS are not
// treated as special replacement patterns.
html = html.replace(/<script\b[^>]*bundle\.js[^>]*><\/script>/,
  () => '<script>\n' + js + '\n</script>');

if (html.includes('bundle.js')) {
  console.error('ERROR: script tag not replaced');
  process.exit(1);
}

// Standalone output: one HTML file that runs by double-clicking (file://).
fs.writeFileSync('dist-singlefile/Space-Planning-Calculator.html', html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`wrote dist-singlefile/Space-Planning-Calculator.html (${kb} KB)`);
