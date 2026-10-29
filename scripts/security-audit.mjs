// Prevent known secret formats, private documents and source-backup CI jobs
// from being committed to the website's public deployment.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
const root=new URL('../',import.meta.url).pathname;
const excluded=new Set(['.git','node_modules','.vercel']);
const banned=[
  /^\.env(?:\.|$)/i,
  /(?:^|\/)(?:id_rsa|id_ed25519|.*\.pem|.*\.p12|.*\.pfx|.*\.keystore|.*\.jks)$/i,
  /(?:^|\/)release\.json$/i,
  /(?:^|\/)SHA256SUMS\.txt$/i,
  /(?:^|\/)docs\/releases\//i,
  /^marketplace\/(?:COIN-ROLLOUT-SAFETY|DISCORD-VERIFIED-TRADE-INTEGRATION|TRIPLE-ACCOUNT-QR-SETUP)\.md$/i,
];
const forbiddenContent=[
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/,
  /\bAIza[A-Za-z0-9_-]{30,}\b/,
  /\bpostgres(?:ql)?:\/\/[^\s"'<>]+:[^\s"'<>]+@[^\s"'<>]+/,
];
const errors=[];
function walk(dir){
 for(const e of readdirSync(dir,{withFileTypes:true})){
  if(e.isDirectory()&&excluded.has(e.name))continue;
  const full=join(dir,e.name),rel=relative(root,full).replaceAll('\\','/');
  if(e.isDirectory()){walk(full);continue}
  if(!e.isFile())continue;
  if(banned.some(re=>re.test(rel)))errors.push('Sensitive artifact present: '+rel);
  if(!/\.(?:js|mjs|cjs|ts|json|yml|yaml|html|md|txt|env|sh|cmd)$/i.test(e.name))continue;
  // Do not flag detection patterns in this validator itself.
  if(rel==='scripts/security-audit.mjs')continue;
  const content=readFileSync(full,'utf8');
  if(forbiddenContent.some(re=>re.test(content)))errors.push('Possible credential embedded in '+rel);
 }
}
walk(root);
if(existsSync(join(root,'hero-clash','release.js')))errors.push('Old metadata helper still deployed');
const ci=readFileSync(join(root,'.github/workflows/ci.yml'),'utf8');
if(/actions\/upload-artifact|AbszSMP-online-source/.test(ci))errors.push('Full source backup CI job is enabled');
if(errors.length){console.error('Security audit failed:\\n'+errors.join('\\n'));process.exitCode=1}
else console.log('Security audit passed: no disallowed public artifacts or known credential patterns.');
