# copy one animation (by name prefix) from src GLB into dst GLB (same skeleton node layout)
import json,struct,sys
def load(f):
    d=open(f,'rb').read(); l=struct.unpack('<I',d[12:16])[0]; j=json.loads(d[20:20+l]); b=bytearray(d[20+l+8:20+l+8+struct.unpack('<I',d[20+l:20+l+4])[0]]); return j,b
def save(f,j,b):
    while len(b)%4: b.append(0)
    j['buffers']=[{'byteLength':len(b)}]
    js=json.dumps(j,separators=(',',':')).encode()
    while len(js)%4: js+=b' '
    open(f,'wb').write(struct.pack('<III',0x46546C67,2,28+len(js)+len(b))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(b),0x004E4942)+bytes(b))
sj,sb=load(sys.argv[1]); dj,db=load(sys.argv[2]); name=sys.argv[3]
assert [n.get('name') for n in sj['nodes']]==[n.get('name') for n in dj['nodes']], 'node layout differs'
a=next(x for x in sj['animations'] if x['name'].startswith(name))
amap={}
def cp(ai):
    if ai in amap: return amap[ai]
    acc=dict(sj['accessors'][ai]); bv=sj['bufferViews'][acc['bufferView']]; o=bv.get('byteOffset',0)
    while len(db)%4: db.append(0)
    nb={'buffer':0,'byteOffset':len(db),'byteLength':bv['byteLength']}; db.extend(sb[o:o+bv['byteLength']])
    dj['bufferViews'].append(nb); acc['bufferView']=len(dj['bufferViews'])-1
    dj['accessors'].append(acc); amap[ai]=len(dj['accessors'])-1; return amap[ai]
na={'name':a['name'],'channels':a['channels'],'samplers':[{**s,'input':cp(s['input']),'output':cp(s['output'])} for s in a['samplers']]}
dj['animations'].append(na); save(sys.argv[2],dj,db); print('copied',a['name'])
