import {z} from "zod";
const byte = z.number().finite().int().min(0).max(255);
const rgb = z.tuple([byte,byte,byte]), rgba = z.tuple([byte,byte,byte,byte]);
export const textureSetSchema = z.object({
  "minecraft:texture_set": z.object({
    color: z.union([z.string().min(1),rgb,rgba]).optional(),
    normal: z.string().min(1).optional(),
    heightmap: z.string().min(1).optional(),
    metalness_emissive_roughness: z.union([z.string().min(1),rgb]).optional(),
    metalness_emissive_roughness_subsurface: z.union([z.string().min(1),rgba]).optional(),
  }).refine(value=>Object.keys(value).length>0,"Texture set must define at least one channel.")
    .refine(value=>!(value.normal&&value.heightmap),"Choose normal or heightmap, not both.")
    .refine(value=>!(value.metalness_emissive_roughness&&value.metalness_emissive_roughness_subsurface),"Choose MER or MERS, not both."),
});
