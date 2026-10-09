import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
const engine=process.env.GODOT_BIN||(process.platform==='win32'?path.resolve('artifacts/godot-tools/Godot_v4.7.2-stable_win64_console.exe'):'godot');
function run(args){const result=spawnSync(engine,args,{stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)throw Error('Godot failed: '+result.status);}
await fs.mkdir('godot/build/web',{recursive:true});await fs.writeFile('godot/build/.gdignore','');
run(['--headless','--path','godot','--editor','--import']);
for(let i=0;i<4;i++)run(['--headless','--path','godot','--','--verify','--level='+i]);
run(['--headless','--path','godot','--export-release','Web','build/web/index.html']);
await fs.copyFile('legacy/threejs/public/favicon.svg','godot/build/web/favicon.svg');
// dist is generated output; refuse a recursive cleanup outside this checkout.
const target=path.resolve('dist');if(path.dirname(target)!==process.cwd())throw Error('Unexpected export path');
await fs.rm(target,{recursive:true,force:true});await fs.cp('godot/build/web',target,{recursive:true});
await fs.writeFile(path.join(target,'.nojekyll'),'');await fs.writeFile(path.join(target,'CNAME'),'wuyu.lanjinjin.site\n');
const pkg=JSON.parse(await fs.readFile('package.json','utf8'));
await fs.writeFile(path.join(target,'version.json'),JSON.stringify({engine:'Godot',version:pkg.version,levels:4,commit:process.env.GITHUB_SHA||spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout?.trim()}));
console.log('Godot website built in dist (4 levels).');
