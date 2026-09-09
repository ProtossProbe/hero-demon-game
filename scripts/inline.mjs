import { readFileSync, writeFileSync } from 'node:fs';
let html = readFileSync('dist/index.html', 'utf8');
html = html.replace(
  /<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g,
  (_, src) =>
    `<script type="module">${readFileSync('dist/' + src.replace(/^\.\//, ''), 'utf8').replace(/<\/script/gi, '<\\/script')}</script>`,
);
html = html.replace(
  /<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g,
  (_, href) =>
    `<style>${readFileSync('dist/' + href.replace(/^\.\//, ''), 'utf8')}</style>`,
);
writeFileSync('dist/勇者斗大魔王.html', html);
