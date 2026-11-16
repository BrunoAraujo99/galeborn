import sys, base64, os, glob, json, shutil, datetime
order=['core','audio','fx','heroes','rig','heromodel','world','combat','player','boss','ui','anime','moments','clips','spectacle','kits','movesets','depth','arena','stage','tempo','clarity','training','progress','profile','select','net','duel','bot','lobby','settings','perf','neon','main']
game='\n'.join(open(f'src/{n}.js').read() for n in order)
libs=open('src/three.min.js').read()+'\n'+open('src/gltfloader.js').read()+'\n'+open('src/vendor/supabase.js').read()
HEROES=['wind','fire','earth','water']
audio=sorted(glob.glob('assets/audio/*.mp3'))
assert '</script' not in libs and '</script' not in game
BUILD_ID=datetime.datetime.now(datetime.timezone.utc).strftime('%m%d-%H%M')
print('BUILD', BUILD_ID)
FONTS=[('Dela Gothic One','400','normal','dela.woff2'),('Anton','400','normal','Anton_400_normal.woff2'),('Archivo','800 900','italic','Archivo_900_italic.woff2')]
ff=''.join("@font-face{font-family:'%s';font-style:%s;font-weight:%s;font-display:block;src:url(data:font/woff2;base64,%s) format('woff2')}" % (f,st,w,base64.b64encode(open('assets/fonts/'+fn,'rb').read()).decode()) for f,w,st,fn in FONTS)
THEME='<style>'+ff+'\n'+open('src/theme.css').read()+'</style>'
ART={k:{h:'data:image/webp;base64,'+base64.b64encode(open(f'assets/art/{k}_{h}.webp','rb').read()).decode() for h in HEROES} for k in ['face','body']}
ARTJS='\nconst ART='+json.dumps(ART)+';\n'
assert '</script' not in open('src/theme.css').read()
def page(assets):
    html=open('src/index.html').read()
    html=html.replace('</head>',THEME+'</head>',1)
    assets=ARTJS+assets
    html=html.replace('</body>','<div id="buildTag" style="position:fixed;left:10px;bottom:6px;font:11px monospace;opacity:.5;z-index:50;pointer-events:none;color:#fff">build '+BUILD_ID+'</div></body>',1)
    return html.replace('<script>/*THREE*/</script>','<script>'+libs+assets+'</script>',1).replace('<script>/*GAME*/</script>','<script>\n'+game+'\n</script>',1)
# 1) single self-contained file (works straight from disk)
emb=''
for h in HEROES:
    glb=f'assets/heroes/{h}.glb'
    emb+=f'\nconst HERO_{h.upper()}_B64="'+(base64.b64encode(open(glb,'rb').read()).decode() if os.path.exists(glb) else '')+'";\n'
ARENA_GLB=sorted(glob.glob('assets/arenas/*/*.glb'))
akey=lambda f: f.split('assets/arenas/')[1][:-4]
emb+='const ARENA_B64='+json.dumps({akey(f):base64.b64encode(open(f,'rb').read()).decode() for f in ARENA_GLB})+';\n'
emb+='const AUDIO_B64='+json.dumps({os.path.splitext(os.path.basename(f))[0]:base64.b64encode(open(f,'rb').read()).decode() for f in audio})+';\n'
html=page(emb)
os.makedirs('dist',exist_ok=True)
open('dist/galeborn.html','w').write(html)
print('single file',len(html))
# 2) web build: small page + separate model and audio files loaded on demand
web='dist/web'
shutil.rmtree(web,ignore_errors=True); os.makedirs(web+'/heroes'); os.makedirs(web+'/audio')
for h in HEROES: shutil.copy(f'assets/heroes/{h}.glb',f'{web}/heroes/{h}.glb')
for f in ARENA_GLB: os.makedirs(os.path.dirname(f'{web}/arenas/'+akey(f)),exist_ok=True); shutil.copy(f,f'{web}/arenas/'+akey(f)+'.glb')
for f in audio: shutil.copy(f,f'{web}/audio/')
w=page('\nconst ASSET_WEB=true;\nconst AUDIO_LIST='+json.dumps([os.path.splitext(os.path.basename(f))[0] for f in audio])+';\n')
open(web+'/index.html','w').write(w)
shutil.copy('dist/galeborn.html',web+'/galeborn-offline.html')
print('web page',len(w))
