import fs from 'fs';

let html = fs.readFileSync('dist-singlefile/index.html', 'utf8');
const js = fs.readFileSync('dist-singlefile/bundle.js', 'utf8');

// Remove the external module script tag from <head>. A plain inline classic
// script works from file:// (type="module" would be blocked there), but unlike
// a module script it is NOT deferred — so it must run AFTER #root exists.
html = html.replace(/<script\b[^>]*bundle\.js[^>]*><\/script>/, '');

if (html.includes('bundle.js')) {
  console.error('ERROR: script tag not removed');
  process.exit(1);
}

// Inject the inlined bundle at the very end of <body>, so #root is already in
// the DOM when the script runs. Use a function replacement so `$` sequences in
// the minified JS are not treated as special replacement patterns.
const inlineTag = '<script>\n' + js + '\n</script>';
html = html.replace(/<\/body>/, () => inlineTag + '\n</body>');

if (!html.includes(inlineTag)) {
  console.error('ERROR: could not inject inline script before </body>');
  process.exit(1);
}

// Standalone output: one HTML file that runs by double-clicking (file://).
fs.writeFileSync('dist-singlefile/Space-Planning-Calculator.html', html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`wrote dist-singlefile/Space-Planning-Calculator.html (${kb} KB)`);
