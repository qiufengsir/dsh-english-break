import {build} from 'esbuild';
await build({entryPoints:['src/index.ts'],outfile:'dist/index.js',bundle:true,platform:'node',format:'esm',target:'node24',packages:'external'});
await build({entryPoints:['src/core.ts'],outfile:'dist/core.js',bundle:true,platform:'node',format:'esm',target:'node24',packages:'external'});
await build({entryPoints:['src/client.tsx'],outfile:'dist/client.js',bundle:true,platform:'browser',format:'cjs',target:'es2022',packages:'external',loader:{'.css':'text'},banner:{js:'window.__ModuleLoader__.load({id:"dsh-english-break",factory:(require)=>{var module={exports:{}};var exports=module.exports;'},footer:{js:'return module.exports;}});'}});
