import { createResource, type ResourceSpec } from "@/lib/factories";
import { nodeSummary, projectNodes, projectRevision, resolveProject, resolveUnique, textureSummary } from "@/lib/modelState";

export const modelResourceDocs: ResourceSpec[] = [
  { name: "model-element", uriTemplate: "model://{project}/elements/{id}", title: "Compact model element", description: "Project-scoped element identity, transform and counts. No render graph or recursive children. Use query_model for geometry pages." },
  { name: "model-texture", uriTemplate: "model://{project}/textures/{id}", title: "Texture metadata", description: "Project-scoped texture dimensions, channel and layer count without bitmap data." },
];
export function registerModelResources(): void {
  for (const spec of modelResourceDocs) createResource(spec.name, {
    ...spec, async readCallback(uri, variables) {
      const project = resolveProject(variables.project);
      const value = spec.name === "model-element" ? nodeSummary(resolveUnique(projectNodes(project), variables.id, "element"), true) : textureSummary(resolveUnique(project.textures, variables.id, "texture"));
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify({ project_uuid: project.uuid, revision: projectRevision(project), ...value }) }] };
    }
  });
}
