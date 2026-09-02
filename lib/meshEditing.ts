/** Explicit mesh operations; editor actions ignore extra click arguments. */
export function extrudeMesh(mesh: Mesh, mode: string, distance: number): void {
  const faces = mode === "faces" ? [...mesh.getSelectedFaces()] : [];
  const edges = mode === "edges" ? mesh.getSelectedEdges().map(edge => [...edge]) : [];
  const vertices = mode === "faces" ? [...new Set(faces.flatMap(key => mesh.faces[key].vertices))] :
    mode === "edges" ? [...new Set(edges.flat())] : [...mesh.getSelectedVertices()];
  if (!vertices.length) throw new Error(`No ${mode} selected on the requested mesh.`);
  const normals: Record<string, number[]> = Object.fromEntries(vertices.map(key => [key, [0, 0, 0]]));
  for (const [key, face] of Object.entries(mesh.faces)) {
    if (faces.length && !faces.includes(key)) continue;
    const normal = face.getNormal(true);
    for (const vertex of face.vertices) if (normals[vertex]) {
      normal.forEach((value, axis) => { normals[vertex][axis] += value; });
    }
  }
  const boundary = new Map<string, { edge: string[]; face: MeshFace; count: number }>();
  for (const key of faces) {
    const face = mesh.faces[key], ordered = face.getSortedVertices();
    for (let i = 0; i < ordered.length; i++) {
      const edge = [ordered[i], ordered[(i + 1) % ordered.length]];
      const id = [...edge].sort().join(":");
      const existing = boundary.get(id);
      if (existing) existing.count++;
      else boundary.set(id, { edge, face, count: 1 });
    }
  }
  Undo.initEdit({ elements: [mesh], selection: true });
  const copies: Record<string, string> = {};
  for (const key of vertices) {
    const normal = normals[key], length = Math.hypot(...normal);
    const direction = length ? normal.map(value => value / length) : [0, 1, 0];
    copies[key] = mesh.addVertices(mesh.vertices[key].map((value, axis) => value + direction[axis] * distance) as ArrayVector3)[0];
  }
  const newFaces: string[] = [];
  for (const key of faces) {
    const face = mesh.faces[key];
    const cap = new MeshFace(mesh, face);
    cap.vertices = face.vertices.map(vertex => copies[vertex]);
    cap.uv = Object.fromEntries(face.vertices.map(vertex => [copies[vertex], [...face.uv[vertex]]]));
    newFaces.push(...mesh.addFaces(cap));
    delete mesh.faces[key];
  }
  const sides = mode === "edges" ? edges.map(edge => ({ edge, face: Object.values(mesh.faces).find(face => edge.every(key => face.vertices.includes(key))), count: 1 })) : [...boundary.values()];
  for (const { edge: [a, b], face, count } of sides) {
    if (count !== 1) continue;
    const side = new MeshFace(mesh, { texture: face?.texture, vertices: [a, b, copies[b], copies[a]], uv: {
      [a]: [0, 0], [b]: [Math.hypot(...mesh.vertices[a].map((value, axis) => value - mesh.vertices[b][axis])), 0],
      [copies[b]]: [Math.hypot(...mesh.vertices[a].map((value, axis) => value - mesh.vertices[b][axis])), Math.abs(distance)],
      [copies[a]]: [0, Math.abs(distance)],
    } });
    newFaces.push(...mesh.addFaces(side));
  }
  if (mode === "vertices") for (const key of vertices) mesh.addFaces(new MeshFace(mesh, { vertices: [key, copies[key]] }));
  Project!.mesh_selection[mesh.uuid] = { vertices: Object.values(copies), edges: [], faces: newFaces };
  Undo.finishEdit("Extrude mesh");
  Canvas.updateView({ elements: [mesh], element_aspects: { geometry: true, uv: true, faces: true }, selection: true });
}

export function subdivideMesh(mesh: Mesh, cuts: number): void {
  const keys = mesh.getSelectedFaces().length ? [...mesh.getSelectedFaces()] : Object.keys(mesh.faces);
  if (!keys.length) throw new Error("The requested mesh has no faces to subdivide.");
  if (keys.some(key => ![3, 4].includes(mesh.faces[key].vertices.length))) throw new Error("Subdivision requires triangular or quad faces.");
  const n = cuts + 1;
  if (keys.length * n * n > 50000) throw new Error("Subdivision exceeds 50000 output faces; reduce cuts or select fewer faces.");
  Undo.initEdit({ elements: [mesh], selection: true });
  const edgeVertices = new Map<string, string>();
  const created: string[] = [];
  for (const key of keys) {
    const face = mesh.faces[key], corners = face.getSortedVertices();
    const quad = corners.length === 4;
    const grid = new Map<string, string>();
    const uvs: Record<string, number[]> = {};
    const point = (i: number, j: number): string => {
      const id = `${i},${j}`;
      if (grid.has(id)) return grid.get(id)!;
      const u = i / n, v = j / n;
      const weights = quad ? [(1-u)*(1-v), u*(1-v), u*v, (1-u)*v] : [1-u-v, u, v];
      const nonzero = weights.map((weight, index) => ({ weight, key: corners[index] })).filter(entry => entry.weight > 1e-9);
      const edgeId = nonzero.length <= 2 ? nonzero.sort((a, b) => a.key.localeCompare(b.key)).map(entry => `${entry.key}:${entry.weight.toFixed(8)}`).join("|") : undefined;
      let vertex = nonzero.length === 1 ? nonzero[0].key : edgeId ? edgeVertices.get(edgeId) : undefined;
      if (!vertex) {
        vertex = mesh.addVertices([0, 1, 2].map(axis => weights.reduce((sum, weight, index) => sum + mesh.vertices[corners[index]][axis] * weight, 0)) as ArrayVector3)[0];
        if (edgeId) edgeVertices.set(edgeId, vertex);
      }
      grid.set(id, vertex);
      uvs[vertex] = [0, 1].map(axis => weights.reduce((sum, weight, index) => sum + (face.uv[corners[index]]?.[axis] ?? 0) * weight, 0));
      return vertex;
    };
    const addFace = (vertices: string[]) => {
      const copy = new MeshFace(mesh, face);
      copy.vertices = vertices;
      copy.uv = Object.fromEntries(vertices.map(vertex => [vertex, [...uvs[vertex]] as ArrayVector2]));
      created.push(...mesh.addFaces(copy));
    };
    for (let j = 0; j < n; j++) for (let i = 0; i < (quad ? n : n-j); i++) {
      if (quad) addFace([point(i,j), point(i+1,j), point(i+1,j+1), point(i,j+1)]);
      else {
        addFace([point(i,j), point(i+1,j), point(i,j+1)]);
        if (i+j < n-1) addFace([point(i+1,j), point(i+1,j+1), point(i,j+1)]);
      }
    }
    delete mesh.faces[key];
  }
  Project!.mesh_selection[mesh.uuid] = { vertices: [...new Set(created.flatMap(key => mesh.faces[key].vertices))], edges: [], faces: created };
  Undo.finishEdit("Subdivide mesh");
  Canvas.updateView({ elements: [mesh], element_aspects: { geometry: true, uv: true, faces: true }, selection: true });
}

export function deleteMeshSelection(mesh: Mesh, mode: string, keepVertices: boolean): void {
  const vertices = new Set(mesh.getSelectedVertices());
  const selectedFaces = new Set(mesh.getSelectedFaces());
  const edges = mesh.getSelectedEdges();
  const removed = Object.entries(mesh.faces).filter(([key, face]) => mode === "faces" ? selectedFaces.has(key) :
    mode === "edges" ? edges.some(edge => edge.every(key => face.vertices.includes(key))) : face.vertices.some(key => vertices.has(key)));
  if (!removed.length && !vertices.size) throw new Error("No components selected on the requested mesh.");
  Undo.initEdit({ elements: [mesh], selection: true });
  const candidates = new Set([...vertices, ...removed.flatMap(([, face]) => face.vertices)]);
  for (const [key] of removed) delete mesh.faces[key];
  if (!keepVertices) for (const key of candidates) {
    if (!Object.values(mesh.faces).some(face => face.vertices.includes(key))) delete mesh.vertices[key];
  }
  Project!.mesh_selection[mesh.uuid] = { vertices: [], edges: [], faces: [] };
  Undo.finishEdit("Delete mesh components");
  Canvas.updateView({ elements: [mesh], element_aspects: { geometry: true, uv: true, faces: true }, selection: true });
}
