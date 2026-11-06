import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const root = process.cwd();
const target = path.resolve(process.argv[2]);
if (target === root || !fs.existsSync(path.join(target, '.openai/hosting.json'))) {
  throw new Error('请提供已登记的独立 Sites 演示目录');
}
for (const name of ['app', 'components', 'lib', 'public']) {
  fs.cpSync(path.join(root, name), path.join(target, name), { recursive: true });
}
for (const name of ['package.json', 'package-lock.json', 'tsconfig.json', 'postcss.config.mjs']) {
  fs.copyFileSync(path.join(root, name), path.join(target, name));
}
fs.mkdirSync(path.join(target, 'lib/demo'), { recursive: true });
for (const name of ['knowledge-base', 'compliance-cases', 'legal-sources']) {
  fs.writeFileSync(path.join(target, `lib/demo/${name}.json`), JSON.stringify(yaml.load(fs.readFileSync(path.join(root, `knowledge-base/${name}.yaml`), 'utf8'))));
}
const apiExport = fs.readFileSync(path.join(root, 'app/api/export/route.ts'), 'utf8');
const exportBody = apiExport.slice(apiExport.indexOf('  let rendered;'), apiExport.lastIndexOf('\n}'));
fs.writeFileSync(path.join(target, 'lib/demo/api.ts'), `
import { evaluate } from '../engine/evaluate';
import { KnowledgeBaseSchema } from '../schemas';
import knowledge from './knowledge-base.json';
import cases from './compliance-cases.json';
import sources from './legal-sources.json';
import { renderToDocx } from '../export/docx';
import { renderGapReport, renderPrivacyPolicyOutline, renderCrossBorderConsent, renderPiCollectionList, renderSharingList, renderSeparateConsent, renderPipiaReport } from '../templates/render';
import type { Organization, ProcessingActivity } from '../types';
export async function demoFetch(input: string, init?: RequestInit): Promise<Response> {
  const kb = KnowledgeBaseSchema.parse(knowledge);
  if(input.startsWith('/api/llm/')) return Response.json({error:'公开演示未启用 AI 服务，请体验规则评估与文件导出。'},{status:503});
  if(input === '/api/cases') return Response.json(cases);
  if(input.startsWith('/api/check-updates')) {
    if(init?.method === 'POST') return new Response('演示版不修改法规复核状态', {status:403});
    return Response.json({statuses:sources.sources.map(s=>({...s,status:'pending',checked_at:'',error:'演示版未执行实时检查'})),refreshed:false});
  }
  const body = JSON.parse(String(init?.body || '{}')) as {org:Organization;activities:ProcessingActivity[];docType:string};
  const {org,activities,docType}=body;
  const result=evaluate(org,activities,kb);
  if(input === '/api/evaluate') return Response.json(result);
  if(input !== '/api/export') return new Response('未提供此演示功能',{status:404});
${exportBody}
}
`);
function edit(file, fn) {
  const dest=path.join(target,file);
  fs.writeFileSync(dest,fn(fs.readFileSync(dest,'utf8')));
}
for(const page of ['questionnaire','report','documents','admin','review']) {
  edit(`app/${page}/page.tsx`, s=>s.replace('"use client";', '"use client";\nimport { demoFetch } from "@/lib/demo/api";').replaceAll('fetch(', 'demoFetch('));
}
edit('lib/export/docx.ts',s=>s.replace('Promise<Buffer>','Promise<Uint8Array>').replace('Buffer.from(await Packer.toBuffer(wordDoc))','new Uint8Array(await (await Packer.toBlob(wordDoc)).arrayBuffer())'));
edit('components/DemoStart.tsx',s=>s.replace('"use client";', '"use client";\nimport { demoFetch } from "@/lib/demo/api";').replace('await fetch(', 'await demoFetch('));
edit('app/layout.tsx',s=>s.replace('<main className="flex-1 pt-13">{children}</main>', '<main className="flex-1 pt-13"><div className="bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">作品演示 · 请使用虚构数据 · 评估和文件在浏览器本地生成 · AI 与实时法规检查未启用</div>{children}</main>'));
fs.writeFileSync(path.join(target,'next.config.ts'),'export default { output: "export", trailingSlash: true };\n');
// 仅删除独立生成目录中的服务端路由；源码仓库和本地环境保持原样。
fs.rmSync(path.join(target,'app/api'),{recursive:true,force:true});
fs.writeFileSync(path.join(target,'.gitignore'),'node_modules/\n.next/\nout/\n.env*\n*.tsbuildinfo\nnext-env.d.ts\n');
console.log('已生成不含密钥及服务端调用的静态演示源码');
