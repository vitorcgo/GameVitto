"""Preserve the source behind one numbered visual iteration without committing."""
from pathlib import Path
import hashlib,json,datetime,shutil,sys
root=Path('games/mario-kart');out=Path(sys.argv[1]);out.mkdir(exist_ok=True,parents=True)
files=[p for p in root.rglob('*') if p.is_file() and 'evidence' not in p.parts and p.suffix in ('.js','.mjs','.py','.css','.html','.png','.webp','.svg')]
assets=Path('assets/mario-kart');models=[p for p in assets.glob('*') if p.is_file() and p.suffix in ('.glb','.json','.png','.webp','.svg')]
(out/'source-hashes.json').write_text(json.dumps({'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in files+models}},indent=2))
for p in files:
 target=out/'source'/p.relative_to(root);target=target.with_name(target.name+'.snapshot') if '.test.' in target.name else target;target.parent.mkdir(exist_ok=True,parents=True);shutil.copy2(p,target)
