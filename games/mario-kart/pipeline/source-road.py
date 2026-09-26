"""Recover a local MK8 Stadium route from its actual OBJ UV-center intersections.

No assets are downloaded. The output contains source-derived geometry and belongs
in the ignored local asset directory, alongside its provenance. Standard library.
"""
from pathlib import Path
from collections import defaultdict
from itertools import product
from bisect import bisect_right
import json, math, sys

obj, output = map(Path, sys.argv[1:3])
materials = {'fc_road', 'fc_road_G', 'fc_road_WhiteLine',
             'fc_road_WhiteLine_G', 'fc_road_MARIOKART', 'fc_ColorRoad'}
vertices, uvs, source_normals, faces = [], [], [], []
name = ''
for line in obj.open():
    fields = line.split()
    if not fields:
        continue
    tag = fields[0]
    if tag == 'v':
        vertices.append(tuple(map(float, fields[1:4])))
    elif tag == 'vt':
        uvs.append(tuple(map(float, fields[1:3])))
    elif tag == 'vn':
        source_normals.append(tuple(map(float, fields[1:4])))
    elif tag == 'o':
        name = fields[1].split('__')[-1]
    elif tag == 'f' and name in materials:
        corners = [tuple(int(i) - 1 for i in corner.split('/')) for corner in fields[1:]]
        if any(len(c) != 3 for c in corners):
            raise ValueError('Road OBJ requires positions, UVs and normals')
        faces.append((name, corners))

def mix(a, b, t):
    return tuple(x * (1 - t) + y * t for x, y in zip(a, b))

def normalized(v):
    length = math.sqrt(sum(x*x for x in v))
    if length < 1e-9:
        raise ValueError('Zero road normal')
    return tuple(x / length for x in v)

points, normals, edges = [], [], []
for name, corners in faces:
    # Neighboring asphalt center U=.5 meets the three-band road at U=2/3.
    # The colored section maps the same lane to U=1/3..1.
    level = 2 / 3 if name == 'fc_ColorRoad' else .5
    hits = []
    for a, b in zip(corners, corners[1:] + corners[:1]):
        ua, ub = uvs[a[1]][0], uvs[b[1]][0]
        if (ua-level)*(ub-level) > 0 or abs(ub-ua) < 1e-8:
            continue
        t = (level-ua)/(ub-ua)
        if not -.000001 <= t <= 1.000001:
            continue
        p = mix(vertices[a[0]], vertices[b[0]], t)
        n = mix(source_normals[a[2]], source_normals[b[2]], t)
        if not any(math.dist(p, h[0]) < 1e-5 for h in hits):
            hits.append((p, n))
    if len(hits) == 2:
        edges.append((len(points), len(points)+1))
        points.extend(h[0] for h in hits)
        normals.extend(h[1] for h in hits)

# Weld the intersections spatially; do not assume source vertex IDs are shared
# across texture/material seams. Neighbor cells handle rounding boundaries.
parent = list(range(len(points)))
def root(i):
    while parent[i] != i:
        parent[i] = parent[parent[i]]
        i = parent[i]
    return i
cells = defaultdict(list)
tolerance = .004
for i, p in enumerate(points):
    cell = tuple(math.floor(v/tolerance) for v in p)
    for delta in product((-1, 0, 1), repeat=3):
        for k in cells[tuple(a+b for a, b in zip(cell, delta))]:
            if math.dist(p, points[k]) <= tolerance:
                parent[root(i)] = root(k)
    cells[cell].append(i)
lookup, nodes, node_normals = {}, [], []
for i, p in enumerate(points):
    r = root(i)
    if r not in lookup:
        lookup[r] = len(nodes)
        nodes.append(p)
        node_normals.append(normals[i])
graph = defaultdict(set)
for a, b in edges:
    a, b = lookup[root(a)], lookup[root(b)]
    if a != b:
        graph[a].add(b)
        graph[b].add(a)
components, seen = [], set()
for i in graph:
    if i in seen:
        continue
    todo, component = [i], []
    while todo:
        k = todo.pop()
        if k in seen:
            continue
        seen.add(k)
        component.append(k)
        todo.extend(graph[k] - seen)
    if any(len(graph[k]) > 2 for k in component):
        raise ValueError('Ambiguous branch in recovered road centerline')
    ends = [k for k in component if len(graph[k]) == 1]
    if len(ends) != 2:
        raise ValueError('Expected an open UV-center road strip')
    components.append((component, ends))

# Ordered landmark seeds measured from the course model. These only choose the
# direction of each recovered strip; all route points/normals come from the OBJ.
seeds = [(4.7,25.4,-.36), (36.454,24.975,-45.512),
         (38.781,24.943,-45.522), (54.984,24.875,-27.775),
         (38.705,25.864,-27.768), (36.475,26.171,-27.778),
         (12.044,32.416,-27.777), (-53.113,37.744,45.38),
         (-24.956,28.858,45.38)]
origin, scale = (4.699,25.4,0), 2.5
rows = [(origin, (0,1,0), 0)]
used, joins = set(), []
for section, seed in enumerate(seeds):
    choices = [(math.dist(nodes[end], seed), c, end)
               for c, (_, ends) in enumerate(components) if c not in used for end in ends]
    distance, component, current = min(choices)
    if distance > .08:
        raise ValueError(f'Course landmark {section} no longer matches source: {distance}')
    used.add(component)
    gap = math.dist(nodes[current], rows[-1][0])
    # Explicitly distinguish the real launch gap from the two boost-strip seams.
    if gap > 4 and section != 7:
        raise ValueError(f'Unexpected course seam before section {section}: {gap}')
    joins.append({'section': section, 'gap': gap})
    previous = None
    while True:
        if math.dist(nodes[current], rows[-1][0]) > .03:
            rows.append((nodes[current], node_normals[current], section))
        choices = [i for i in graph[current] if i != previous]
        if not choices:
            break
        previous, current = current, choices[0]
if len(used) != len(components):
    raise ValueError('Unused road-center component; inspect changed source topology')
rows.append(rows[0])
distances = [0]
for a, b in zip(rows, rows[1:]):
    distances.append(distances[-1] + math.dist(a[0], b[0]))
count = int(distances[-1]/.3) + 1
samples = []
for index in range(count):
    distance = distances[-1] * index / (count-1)
    i = min(len(rows)-2, bisect_right(distances, distance)-1)
    t = (distance-distances[i])/(distances[i+1]-distances[i])
    p = mix(rows[i][0], rows[i+1][0], t)
    n = normalized(mix(rows[i][1], rows[i+1][1], t))
    samples.append({'s': distance*scale, 'p': [(v-o)*scale for v, o in zip(p, origin)], 'n': n})
anti = [i for i, row in enumerate(rows) if row[2] == 6]
route = {'source': 'Measured UV-center intersections from Nintendo MK8 course OBJ; local geometry conversion',
         'origin': origin, 'scale': scale, 'length': distances[-1]*scale,
         'antiStart': distances[anti[0]]*scale, 'antiEnd': distances[anti[-1]]*scale,
         'gapStart': distances[anti[-1]]*scale, 'gapEnd': distances[anti[-1]+1]*scale,
         'joins': joins, 'points': samples}
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(route))
print(f'Recovered {len(samples)} samples, {route["length"]:.3f} m, {len(components)} road strips')
