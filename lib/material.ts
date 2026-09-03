import { findTextureOrThrow } from "@/lib/util";

type MaterialChannel = "color" | "normal" | "height" | "mer";
export function resolveMaterialChannels(channels: Record<MaterialChannel, string | undefined>) {
  const resolved = Object.entries(channels).filter(([, id]) => id !== undefined)
    .map(([channel, id]) => ({ channel: channel as MaterialChannel, texture: id === "none" ? undefined : findTextureOrThrow(id!) }));
  const ids = resolved.flatMap(entry => entry.texture ? [entry.texture.uuid] : []);
  if (new Set(ids).size !== ids.length) throw new Error("A texture can occupy only one material channel.");
  return resolved;
}

/** Detach replaced textures, preserving their data and channel for later reuse. */
export function assignMaterialChannel(group: TextureGroup, texture: Texture | undefined, channel: MaterialChannel) {
  for (const previous of group.getTextures()) {
    if (previous.pbr_channel === channel && previous !== texture) previous.group = "";
  }
  // Texture.extend in 5.1.6 calls layers.find(selected_layer) when a layer is
  // selected. These plain Property fields need no layer reconstruction.
  if (texture) {
    texture.group = group.uuid;
    texture.pbr_channel = channel;
  }
}

export function refreshMaterials(groups: TextureGroup[]) {
  for (const group of groups) {
    group.material_config.saved = false;
    group.updateMaterial();
  }
}
