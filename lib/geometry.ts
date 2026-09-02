/** Elements (including descendants) that must be captured before removal. */
export interface MeshComponentSelection {
  vertices: string[];
  edges: [string, string][];
  faces: string[];
}
export function meshSelectionState(): Record<string, MeshComponentSelection> {
  return Project!.mesh_selection as unknown as Record<string, MeshComponentSelection>;
}

export function elementTree(element: OutlinerNode): OutlinerElement[] {
  return outlinerTree(element).filter(node => !(node instanceof Group)) as OutlinerElement[];
}

export function outlinerTree(element: OutlinerNode): OutlinerNode[] {
  const children = (element as OutlinerNode & { children?: OutlinerNode[] }).children ?? [];
  return [element, ...children.flatMap(outlinerTree)];
}

/** Run a synchronous editor API against one mesh, restoring UI selection. */
export function withMeshSelection<T>(mesh: Mesh, faces: string[], run: () => T): T {
  for (const key of faces) {
    if (!mesh.faces[key]) throw new Error(`Face "${key}" not found in mesh "${mesh.name}".`);
  }
  const selected = [...Outliner.selected];
  const selection = Project!.mesh_selection[mesh.uuid];
  const savedSelection = selection ? structuredClone(selection) : undefined;
  try {
    Outliner.selected.empty();
    Outliner.selected.push(mesh);
    Project!.mesh_selection[mesh.uuid] = {
      vertices: [...new Set(faces.flatMap((key) => mesh.faces[key].vertices))],
      edges: [], faces: [...faces],
    };
    return run();
  } finally {
    Outliner.selected.empty();
    Outliner.selected.push(...selected);
    if (savedSelection) Project!.mesh_selection[mesh.uuid] = savedSelection;
    else delete Project!.mesh_selection[mesh.uuid];
    updateSelection();
  }
}
