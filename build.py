import sys
order=['core','audio','fx','heroes','rig','heromodel','world','combat','player','boss','ui','anime','moments','spectacle','kits','select','net','duel','bot','lobby','settings','main']
game='\n'.join(open(f'src/{n}.js').read() for n in order)
three=open('src/three.min.js').read()+'\n'+open('src/gltfloader.js').read()+'\n'+open('src/vendor/supabase.js').read()
import base64,os
for h in ['wind','fire','earth','water']:
    glb=f'assets/heroes/{h}.glb'
    b64=base64.b64encode(open(glb,'rb').read()).decode() if os.path.exists(glb) else ''
    three+=f'\nconst HERO_{h.upper()}_B64="'+b64+'";\n'
import glob,json
aud={os.path.splitext(os.path.basename(f))[0]:base64.b64encode(open(f,'rb').read()).decode() for f in sorted(glob.glob('assets/audio/*.mp3'))}
three+='const AUDIO_B64='+json.dumps(aud)+';\n'
print('audio clips',len(aud))
assert '</script' not in three and '</script' not in game
html=open('src/index.html').read()
import datetime
BUILD_ID=datetime.datetime.utcnow().strftime('%m%d-%H%M')
html=html.replace('</body>','<div id="buildTag" style="position:fixed;left:10px;bottom:6px;font:11px monospace;opacity:.5;z-index:50;pointer-events:none;color:#fff">build '+BUILD_ID+'</div></body>',1)
print('BUILD', BUILD_ID)
html=html.replace('<script>/*THREE*/</script>','<script>'+three+'</script>',1).replace('<script>/*GAME*/</script>','<script>\n'+game+'\n</script>',1)
open('dist/galeborn.html','w').write(html)
print(len(html))
