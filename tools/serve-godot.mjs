import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('godot/build/web');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.wasm':'application/wasm','.pck':'application/octet-stream','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    const bytes=await fs.readFile(file);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store'});
    res.end(bytes);
  }catch{res.writeHead(404);res.end('Export the Godot project before starting the preview.');}
});
server.listen(5180,'127.0.0.1',()=>console.log('Godot preview: http://127.0.0.1:5180/'));
