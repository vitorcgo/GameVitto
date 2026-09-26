"""Verify that a race recording's loaded bytes match its preserved build."""
from pathlib import Path
import json, sys
folder = Path(sys.argv[1])
report = json.loads((folder / 'demo-report.json').read_text())
sources = json.loads((folder / 'source-hashes.json').read_text())['files']
assert not report.get('failure'), report.get('failure')
assert not report['errors'], report['errors']
assert len(report['standings']) == 8 and all(r['gates'] == 24 for r in report['standings'])
assert report['seenAnti'] and report['seenGlide']
assert report['samples'] and all(s['imageContent']['nonemptyScene'] for s in report['samples'])
loaded = report.get('loadedFiles', {})
if report.get('sourceCourse') and (report.get('assetManifest', {}).get('course') or {}).get('tvBrand'):
    atlas = '/assets/mario-kart/' + report['assetManifest']['course']['tvBrand']['image']
    assert atlas in loaded and loaded[atlas]['status'] == 200, 'Selected source TV atlas was not loaded by this recording'
assert loaded, 'This recording predates browser response hashing; verify its snapshot manually.'
checked = {path: {**data, 'match': data['sha256'] == sources.get(path.lstrip('/'))}
           for path, data in loaded.items()}
assert all(d['match'] for d in checked.values()), 'Loaded source differs from snapshot.'
assert (folder / 'keyboard-demo.webm').stat().st_size > 100_000
(folder / 'loaded-source-verification.json').write_text(json.dumps(checked, indent=2))
print(f'PASS: {len(checked)} matching loaded files, {len(report["samples"])} nonempty scene samples, eight finishers.')
