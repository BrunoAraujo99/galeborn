import sys, base64, os, glob, json, shutil, datetime
order=['core','audio','fx','heroes','rig','heromodel','world','combat','player','boss','ui','anime','moments','spectacle','kits','movesets','depth','arena','tempo','select','net','duel','bot','lobby','settings','perf','main']
game='\n'.join(open(f'src/{n}.js').read() for n in order)
libs=open('src/three.min.js').read()+'\n'+open('src/gltfloader.js').read()+'\n'+open('src/vendor/supabase.js').read()
HEROES=['wind','fire','earth','water']
audio=sorted(glob.glob('assets/audio/*.mp3'))
assert '</script' not in libs and '</script' not in game
BUILD_ID=datetime.datetime.now(datetime.timezone.utc).strftime('%m%d-%H%M')
print('BUILD', BUILD_ID)
def page(assets):
    html=open('src/index.html').read()
    html=html.replace('</body>','<div id="buildTag" style="position:fixed;left:10px;bottom:6px;font:11px monospace;opacity:.5;z-index:50;pointer-events:none;color:#fff">build '+BUILD_ID+'</div></body>',1)
    return html.replace('<script>/*THREE*/</script>','<script>'+libs+assets+'</script>',1).replace('<script>/*GAME*/</script>','<script>\n'+game+'\n</script>',1)
# 1) single self-contained file (works straight from disk)
emb=''
for h in HEROES:
    glb=f'assets/heroes/{h}.glb'
    emb+=f'\nconst HERO_{h.upper()}_B64="'+(base64.b64encode(open(glb,'rb').read()).decode() if os.path.exists(glb) else '')+'";\n'
emb+='const AUDIO_B64='+json.dumps({os.path.splitext(os.path.basename(f))[0]:base64.b64encode(open(f,'rb').read()).decode() for f in audio})+';\n'
html=page(emb)
os.makedirs('dist',exist_ok=True)
open('dist/galeborn.html','w').write(html)
print('single file',len(html))
# 2) web build: small page + separate model and audio files loaded on demand
web='dist/web'
shutil.rmtree(web,ignore_errors=True); os.makedirs(web+'/heroes'); os.makedirs(web+'/audio')
for h in HEROES: shutil.copy(f'assets/heroes/{h}.glb',f'{web}/heroes/{h}.glb')
for f in audio: shutil.copy(f,f'{web}/audio/')
w=page('\nconst ASSET_WEB=true;\nconst AUDIO_LIST='+json.dumps([os.path.splitext(os.path.basename(f))[0] for f in audio])+';\n')
open(web+'/index.html','w').write(w)
print('web page',len(w))
