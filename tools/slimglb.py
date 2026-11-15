# slim a Meshy GLB: drop tangents + MR/extra textures, recompress base color to JPEG
import json,struct,sys,io
from PIL import Image
src,dst,size,q=sys.argv[1],sys.argv[2],int(sys.argv[3]),int(sys.argv[4])
d=open(src,'rb').read()
l=struct.unpack('<I',d[12:16])[0]; j=json.loads(d[20:20+l])
bin0=d[20+l+8:]
bvs=j['bufferViews']
def bvdata(i): b=bvs[i]; o=b.get('byteOffset',0); return bin0[o:o+b['byteLength']]
for m in j['meshes']:
  for p in m['primitives']: p['attributes'].pop('TANGENT',None)
mat=j['materials'][0]; pbr=mat['pbrMetallicRoughness']
texi=pbr['baseColorTexture']['index']; imgi=j['textures'][texi]['source']
pbr.pop('metallicRoughnessTexture',None); pbr['metallicFactor']=0; pbr['roughnessFactor']=1
for k in ['normalTexture','occlusionTexture','emissiveTexture']: mat.pop(k,None)
im=Image.open(io.BytesIO(bvdata(j['images'][imgi]['bufferView']))).convert('RGB')
if im.width>size: im=im.resize((size,size),Image.LANCZOS)
bio=io.BytesIO(); im.save(bio,'JPEG',quality=q,optimize=True); jpg=bio.getvalue()
# collect used accessors
used=set()
for m in j['meshes']:
  for p in m['primitives']:
    used|=set(p['attributes'].values())
    if 'indices' in p: used.add(p['indices'])
for s in j.get('skins',[]):
  if 'inverseBindMatrices' in s: used.add(s['inverseBindMatrices'])
for a in j.get('animations',[]):
  for s in a['samplers']: used|={s['input'],s['output']}
out=bytearray(); newbv=[]; bvmap={}
def add(data,extra):
  while len(out)%4: out.append(0)
  e=dict(extra); e['buffer']=0; e['byteOffset']=len(out); e['byteLength']=len(data); out.extend(data); newbv.append(e); return len(newbv)-1
for ai in sorted(used):
  a=j['accessors'][ai]; bi=a['bufferView']
  if bi not in bvmap:
    b=bvs[bi]; bvmap[bi]=add(bvdata(bi),{k:v for k,v in b.items() if k in('byteStride','target')})
  a['bufferView']=bvmap[bi]
# drop unused accessors by renumbering
order=sorted(used); amap={o:i for i,o in enumerate(order)}
j['accessors']=[j['accessors'][o] for o in order]
for m in j['meshes']:
  for p in m['primitives']:
    p['attributes']={k:amap[v] for k,v in p['attributes'].items()}
    if 'indices' in p: p['indices']=amap[p['indices']]
for s in j.get('skins',[]):
  if 'inverseBindMatrices' in s: s['inverseBindMatrices']=amap[s['inverseBindMatrices']]
for a in j.get('animations',[]):
  for s in a['samplers']: s['input']=amap[s['input']]; s['output']=amap[s['output']]
ib=add(jpg,{})
j['images']=[{'bufferView':ib,'mimeType':'image/jpeg'}]
j['textures']=[{'source':0,'sampler':j['textures'][texi].get('sampler',0)}] if j.get('samplers') else [{'source':0}]
pbr['baseColorTexture']={'index':0}
j['bufferViews']=newbv
while len(out)%4: out.append(0)
j['buffers']=[{'byteLength':len(out)}]
js=json.dumps(j,separators=(',',':')).encode()
while len(js)%4: js+=b' '
glb=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(out))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(out),0x004E4942)+bytes(out)
open(dst,'wb').write(glb); print(dst,len(glb)//1000,'KB','jpg',len(jpg)//1000)
