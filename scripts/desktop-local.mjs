import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';
const mode=process.argv[2];if(!['install','remove'].includes(mode))throw new Error('Use install or remove');
const root=process.cwd(),home=process.env.DSH_HOME??path.join(os.homedir(),'.dsh'),patch=path.join(home,'profiles/desktop/cordis.patch.yml');
const begin='# dsh-english-break local begin',end='# dsh-english-break local end';const original=await fs.readFile(patch,'utf8');const start=original.indexOf(begin),finish=original.indexOf(end);if((start>=0)!==(finish>=0))throw new Error('Incomplete existing marker; refusing to modify patch');
let next=original;
if(mode==='remove'){if(start>=0)next=original.slice(0,start)+original.slice(finish+end.length);}
else{
 const runtime=JSON.parse(await fs.readFile(path.join(home,'dsh-runtimes/dsh-primary-runtime/runtime.json'),'utf8'));if(runtime.desktopVersion!=='0.2.1-rc.3')throw new Error('Only 0.2.1-rc.3 verified');
 const manifest=JSON.parse(await fs.readFile(path.join(home,'profiles/desktop/package.json'),'utf8'));if(manifest.dependencies?.['dsh-english-break'])throw new Error('Packaged plugin is already installed; do not enable both');
 const host=await fs.readFile('dist/index.js');const digest=createHash('sha256').update(host).digest('hex').slice(0,12);const entry=path.join(root,'dist','desktop-'+digest+'.js');await fs.writeFile(entry,host);
 const block=`${begin}\n- insert:\n    - id: dsh-english-break-local\n      name: ${JSON.stringify(entry.replaceAll('\\','/'))}\n      config: {}\n${end}\n`;
 next=start>=0?original.slice(0,start)+block+original.slice(finish+end.length):original.trimEnd()+'\n\n'+block;
}
if(next!==original){const backup=path.join(root,'.local/backups');await fs.mkdir(backup,{recursive:true});await fs.writeFile(path.join(backup,'desktop-patch-'+Date.now()+'.yml'),original,{mode:0o600});if(await fs.readFile(patch,'utf8')!==original)throw new Error('Profile changed concurrently; retry');await fs.writeFile(patch,next,'utf8');}
console.log(mode==='install'?'English plugin registered through desktop user patch. Restart DSH when idle; no process was stopped.':'Only the English local patch was removed; learning records retained.');
