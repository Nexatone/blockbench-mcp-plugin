const epoch = Math.random().toString(36).slice(2);
const revisions = new WeakMap<ModelProject, number>();

export function projectRevision(project: ModelProject): string {
  return `${epoch}:${revisions.get(project) ?? 0}`;
}

export function touchProject(project: ModelProject | null | undefined): void {
  if (project) revisions.set(project, (revisions.get(project) ?? 0) + 1);
}

export function setupModelRevisions(): () => void {
  const changed = (): void => { touchProject(Project); };
  const events = ["finished_edit", "undo", "redo"] as const;
  for (const event of events) Blockbench.on(event, changed);
  return () => { for (const event of events) Blockbench.removeListener(event, changed); };
}

export function resolveProject(uuid?: string): ModelProject {
  const project = uuid ? ModelProject.all.find(p => p.uuid === uuid) : Project;
  if (!project) throw new Error("PROJECT_NOT_FOUND: open a project or supply an existing project_uuid.");
  return project;
}

export function requireActiveProject(uuid: string, revision?: string): ModelProject {
  const project = resolveProject(uuid);
  if (Project !== project) throw new Error("PROJECT_CHANGED: activate the intended project before editing.");
  if (revision !== undefined && projectRevision(project) !== revision) {
    throw new Error("STALE_REVISION: project changed. Inspect it and prepare a new operation.");
  }
  return project;
}

export function projectNodes(project: ModelProject): OutlinerNode[] {
  return [...project.groups, ...project.elements];
}

/** New APIs use exact UUID or a unique exact name; never silently choose a match. */
export function resolveUnique<T extends { uuid: string; name?: string }>(items: readonly T[], id: string, kind: string): T {
  const byId = items.find(item => item.uuid === id);
  if (byId) return byId;
  const matches = items.filter(item => item.name === id);
  if (matches.length > 1) throw new Error(`AMBIGUOUS_ID: ${kind} name "${id}" matches multiple objects. Use a UUID.`);
  if (!matches.length) throw new Error(`NOT_FOUND: ${kind} "${id}" does not exist.`);
  return matches[0];
}

export function nodeSummary(node: OutlinerNode, transforms = false): Record<string, unknown> {
  const data = node as OutlinerNode & { from?: number[]; to?: number[]; origin?: number[]; rotation?: number[]; children?: OutlinerNode[]; vertices?: Record<string, unknown>; faces?: Record<string, unknown>; visibility?: boolean };
  return {
    uuid: node.uuid, name: node.name, type: node.type,
    parent_uuid: typeof node.parent === "object" ? node.parent.uuid : null,
    ...(data.children ? { child_count: data.children.length } : {}),
    ...(data.vertices ? { vertex_count: Object.keys(data.vertices).length, face_count: Object.keys(data.faces ?? {}).length } : {}),
    ...(transforms ? { from: data.from, to: data.to, origin: data.origin, rotation: data.rotation, visibility: data.visibility } : {}),
  };
}

export function textureSummary(texture: Texture): Record<string, unknown> {
  return { uuid: texture.uuid, name: texture.name, width: texture.width, height: texture.height, group: texture.group || null, channel: texture.pbr_channel, layer_count: texture.layers?.length ?? 0 };
}

interface PageCursor { project: string; revision: string; query: string; offset: number }
export function pageRows<T>(rows: readonly T[], project: ModelProject, query: string, limit: number, cursor?: string, maxBytes = 16_384): { items: T[]; total: number; next_cursor: string | null } {
  const revision = projectRevision(project);
  let offset = 0;
  if (cursor) {
    let data: PageCursor;
    try { data = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")); } catch { throw new Error("INVALID_CURSOR: use next_cursor from the preceding page."); }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("INVALID_CURSOR: expected a query cursor.");
    if (data.project !== project.uuid || data.revision !== revision || data.query !== query) throw new Error("STALE_CURSOR: query or project changed; start a fresh query.");
    if (!Number.isSafeInteger(data.offset) || data.offset < 0 || data.offset > rows.length) throw new Error("INVALID_CURSOR: offset out of bounds.");
    offset = data.offset;
  }
  const items: T[] = [];
  let bytes = 2;
  for (; offset < rows.length && items.length < limit; offset++) {
    const size = Buffer.byteLength(JSON.stringify(rows[offset])) + 1;
    if (bytes + size > maxBytes) {
      if (!items.length) throw new Error("RESULT_TOO_LARGE: request a smaller field set or mesh component page.");
      break;
    }
    items.push(rows[offset]);
    bytes += size;
  }
  const next_cursor = offset < rows.length ? Buffer.from(JSON.stringify({ project: project.uuid, revision, query, offset })).toString("base64url") : null;
  return { items, total: rows.length, next_cursor };
}
