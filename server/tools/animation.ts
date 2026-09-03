import { axes, keyframeValues, setKeyframeValues, addAnimationKeyframe, handleVector, bakeTimes, MAX_BAKED_KEYFRAMES, getAnimationClass, selectAnimationKeyframes } from "@/lib/animation";
/// <reference types="three" />
/// <reference types="blockbench-types" />
import { z } from "zod";
import { createTool, type ToolSpec } from "@/lib/factories";
import { findGroupOrThrow } from "@/lib/util";
import { STATUS_EXPERIMENTAL, STATUS_STABLE } from "@/lib/constants";
import {
  vector3Schema,
  animationIdOptionalSchema,
  animationChannelEnum,
  interpolationEnum,
  axisEnum,
  axisWithAllEnum,
  timeRangeSchema,
  boneNameSchema,
  loopModeEnum,
  keyframeDataSchema,
} from "@/lib/zodObjects";

// Detached native keyframe copies retain Molang, pre/post values and handles.
// Kept inside the plugin; reload clears this transient clipboard.
type CopiedKeyframe = ReturnType<_Keyframe["getUndoCopy"]> & { time: number };
let animationClipboard: Record<string, CopiedKeyframe[]> | null = null;

export const createAnimationParameters = z.object({
  name: z.string().describe("Name of the animation"),
  loop: z
    .boolean()
    .default(false)
    .describe("Whether the animation should loop"),
  animation_length: z
    .number()
    .optional()
    .describe("Length of the animation in seconds"),
  bones: z
    .record(
      z.array(
        z.object({
          time: z.number(),
          position: vector3Schema.optional(),
          rotation: vector3Schema.optional(),
          scale: z.union([vector3Schema, z.number()]).optional(),
        })
      )
    )
    .describe("Keyframes for each bone"),
  particle_effects: z
    .record(z.string().describe("Effect name"))
    .optional()
    .describe("Particle effects with timestamps as keys"),
});

export const manageKeyframesParameters = z.object({
  animation_id: animationIdOptionalSchema,
  action: z
    .enum(["create", "delete", "edit", "select"])
    .describe("Action to perform on keyframes."),
  bone_name: boneNameSchema.describe("Name of the bone/group to manage keyframes for."),
  channel: animationChannelEnum.describe("Animation channel to modify."),
  keyframes: z
    .array(keyframeDataSchema)
    .describe("Keyframe data for the action."),
});

export const animationGraphEditorParameters = z.object({
  animation_id: animationIdOptionalSchema,
  bone_name: boneNameSchema.describe("Name of the bone/group to modify curves for."),
  channel: animationChannelEnum.describe("Animation channel to modify."),
  axis: axisWithAllEnum.default("all").describe("Axes for generated Bezier handles. Native interpolation type is shared by all axes of each keyframe."),
  action: z
    .enum([
      "smooth",
      "linear",
      "ease_in",
      "ease_out",
      "ease_in_out",
      "stepped",
      "custom",
    ])
    .describe("Type of curve modification to apply."),
  keyframe_range: timeRangeSchema
    .optional()
    .describe(
      "Time range to apply the curve modification. If not provided, applies to all keyframes."
    ),
  custom_curve: z
    .object({
      control_point_1: z
        .array(z.number())
        .length(2)
        .describe("First normalized control point [time, value]; time must be 0–1. Values may overshoot."),
      control_point_2: z
        .array(z.number())
        .length(2)
        .describe("Second normalized control point [time, value]; time must be 0–1. Values may overshoot."),
    })
    .optional()
    .describe(
      "Custom bezier curve control points (only for 'custom' action)."
    ),
});

export const boneRiggingParameters = z.object({
  action: z
    .enum([
      "create",
      "parent",
      "unparent",
      "delete",
      "rename",
      "set_pivot",
      "set_ik",
      "mirror",
    ])
    .describe("Action to perform on the bone structure."),
  bone_data: z
    .object({
      name: z.string().describe("Name of the bone."),
      parent: z.string().optional().describe("Parent bone name."),
      origin: vector3Schema.optional().describe("Pivot point of the bone."),
      rotation: vector3Schema.optional().describe("Initial rotation of the bone."),
      children: z
        .array(z.string())
        .optional()
        .describe("Names of elements to add to this bone."),
      ik_enabled: z
        .boolean()
        .optional()
        .describe("Enable inverse kinematics for this bone."),
      ik_target: z
        .string()
        .optional()
        .describe("Target bone for IK chain."),
      mirror_axis: axisEnum.optional().describe("Axis to mirror the bone across."),
    })
    .describe("Bone configuration data."),
});

export const animationTimelineParameters = z.object({
  action: z
    .enum([
      "play",
      "pause",
      "stop",
      "set_time",
      "set_length",
      "set_fps",
      "loop",
      "select_range",
    ])
    .describe("Timeline action to perform."),
  time: z
    .number()
    .optional()
    .describe("Time in seconds (for set_time action)."),
  length: z
    .number()
    .optional()
    .describe("Animation length in seconds (for set_length action)."),
  fps: z
    .number()
    .min(1)
    .max(120)
    .optional()
    .describe("Frames per second (for set_fps action)."),
  loop_mode: loopModeEnum.optional().describe("Loop mode for the animation."),
  range: timeRangeSchema.optional().describe("Time range for selection."),
});

export const batchKeyframeOperationsParameters = z.object({
  selection: z
    .enum(["all", "selected", "range", "pattern"])
    .default("selected")
    .describe("Selection within the active animation, including collapsed/hidden animators. Selected uses its currently selected keys."),
  range: timeRangeSchema.optional().describe("Time range for keyframe selection."),
  pattern: z
    .object({
      interval: z.number().finite().positive().describe("Time interval between keyframes."),
      offset: z
        .number()
        .optional()
        .default(0)
        .describe("Time offset for the pattern."),
    })
    .optional()
    .describe("Pattern-based selection."),
  operation: z
    .enum(["offset", "scale", "reverse", "mirror", "smooth", "bake"])
    .describe("Operation to perform on keyframes."),
  parameters: z
    .object({
      offset_time: z.number().optional().describe("Time offset to apply."),
      offset_values: vector3Schema.optional().describe("Value offset to apply."),
      scale_factor: z
        .number()
        .optional()
        .describe("Positive time scale factor. Scales Bezier time handles too; use reverse for time reversal."),
      scale_pivot: z
        .number()
        .optional()
        .describe("Pivot point for scaling."),
      mirror_axis: axisEnum.optional().describe("Axis to mirror values across."),
      bake_interval: z
        .number().finite().positive()
        .optional()
        .describe("Interval for baking keyframes."),
    })
    .optional()
    .describe("Operation-specific parameters."),
});

export const animationCopyPasteParameters = z.object({
  action: z
    .enum(["copy", "paste", "mirror_paste"])
    .describe("Copy or paste action."),
  source: z
    .object({
      animation: z
        .string()
        .optional()
        .describe("Source animation name or UUID."),
      bone: z.string().describe("Source bone name."),
      channels: z
        .array(animationChannelEnum)
        .optional()
        .default(["rotation", "position", "scale"])
        .describe("Channels to copy."),
      time_range: timeRangeSchema
        .optional()
        .describe(
          "Time range to copy. If not provided, copies all keyframes."
        ),
    })
    .optional()
    .describe("Source data for copy operation."),
  target: z
    .object({
      animation: z
        .string()
        .optional()
        .describe("Target animation name or UUID."),
      bone: z.string().describe("Target bone name."),
      time_offset: z
        .number()
        .optional()
        .default(0)
        .describe("Time offset for pasted keyframes."),
      mirror_axis: axisEnum.optional().describe("Axis to mirror across for mirror_paste."),
    })
    .optional()
    .describe("Target data for paste operation."),
});

export const animationToolDocs: ToolSpec[] = [
  {
    name: "create_animation",
    description: "Creates a new animation with keyframes for bones.",
    annotations: {
      title: "Create Animation",
      destructiveHint: true,
    },
    parameters: createAnimationParameters,
    status: STATUS_STABLE,
  },
  {
    name: "manage_keyframes",
    description:
      "Creates, deletes, or edits keyframes in the animation timeline for specific bones and channels.",
    annotations: {
      title: "Manage Keyframes",
      destructiveHint: true,
    },
    parameters: manageKeyframesParameters,
    status: STATUS_STABLE,
  },
  {
    name: "animation_graph_editor",
    description:
      "Controls native keyframe interpolation. Interpolation type applies to all axes; axis scopes generated Bezier handles. Easing/custom curves require numeric values on affected axes; linear/smooth/stepped retain Molang. Ranges select complete keys, so adjacent segments may change too.",
    annotations: {
      title: "Animation Graph Editor",
      destructiveHint: true,
    },
    parameters: animationGraphEditorParameters,
    status: STATUS_STABLE,
  },
  {
    name: "bone_rigging",
    description:
      "Creates and manipulates the bone structure (rig) of a model for animation.",
    annotations: {
      title: "Bone Rigging",
      destructiveHint: true,
    },
    parameters: boneRiggingParameters,
    status: STATUS_EXPERIMENTAL,
  },
  {
    name: "animation_timeline",
    description:
      "Controls the animation timeline, including playback, time scrubbing, and timeline settings.",
    annotations: {
      title: "Animation Timeline",
      destructiveHint: true,
    },
    parameters: animationTimelineParameters,
    status: STATUS_STABLE,
  },
  {
    name: "batch_keyframe_operations",
    description: "Operates on active-animation keys, including collapsed animators. Time edits reject negative times and same-channel collisions. Scale changes time and Bezier time handles; reverse uses native key/data-point/handle reversal semantics. Bake replaces each selected transform channel's span with numeric linear samples including its end. Mirror/smooth/bake/value offsets require transform keys.",
    annotations: {
      title: "Batch Keyframe Operations",
      destructiveHint: true,
    },
    parameters: batchKeyframeOperationsParameters,
    status: STATUS_STABLE,
  },
  {
    name: "animation_copy_paste",
    description:
      "Copies and pastes animation data between bones or animations.",
    annotations: {
      title: "Animation Copy/Paste",
      destructiveHint: true,
    },
    parameters: animationCopyPasteParameters,
    status: STATUS_STABLE,
  },
];

export function registerAnimationTools() {
const Animation = getAnimationClass();
createTool(
  animationToolDocs[0].name,
  {
    ...animationToolDocs[0],
    async execute({ name, loop, animation_length, bones, particle_effects }) {
      const animationData = {
        loop,
        ...(animation_length !== undefined && { animation_length }),
        bones: Object.fromEntries(
          Object.entries(bones).map(([boneName, keyframes]) => {
            const boneData: Record<
              string,
              Record<string, number | number[]>
            > = keyframes.reduce((acc, keyframe) => {
              const timeKey = keyframe.time.toString();
              if (keyframe.position) {
                (acc.position ??= {})[timeKey] = keyframe.position;
              }
              if (keyframe.rotation) {
                (acc.rotation ??= {})[timeKey] = keyframe.rotation;
              }
              if (keyframe.scale !== undefined) {
                (acc.scale ??= {})[timeKey] = keyframe.scale;
              }
              return acc;
            }, {} as Record<string, Record<string, number | number[]>>);

            return [boneName, boneData];
          })
        ),
        ...(particle_effects && { particle_effects }),
      };

      const before = new Set(Animation.all);
      Undo.initEdit({ animations: [] });
      Animator.loadFile({
        content: JSON.stringify({
          format_version: "1.8.0",
          animations: {
            [`animation.${name}`]: animationData,
          },
        }),
      });

      const created = Animation.all.filter(a => !before.has(a));
      Undo.finishEdit("Create animation", { animations: created });
      created[0]?.select();

      return `Created animation "${name}" with keyframes for ${
        Object.keys(bones).length
      } bones${
        particle_effects
          ? ` and ${Object.keys(particle_effects).length} particle effects`
          : ""
      }`;
    },
  },
  animationToolDocs[0].status
);

createTool(
  animationToolDocs[1].name,
  {
    ...animationToolDocs[1],
    async execute({ animation_id, action, bone_name, channel, keyframes }) {
      // Find or select animation
      const animation = animation_id
        ? Animation.all.find(
            (a) => a.uuid === animation_id || a.name === animation_id
          )
        : Animation.selected;

      if (!animation) {
        throw new Error("No animation found or selected.");
      }

      // Find the bone
      const group = findGroupOrThrow(bone_name);
      if (!keyframes.length) throw new Error("Provide at least one keyframe.");
      if (keyframes.some((kf: { time: number }) => !Number.isFinite(kf.time) || kf.time < 0)) throw new Error("Keyframe times must be finite and nonnegative.");
      let animator = animation.animators[group.uuid];
      const matches = action === "create" ? [] : keyframes.map((kf: { time: number }) => {
        const match = animator?.[channel]?.find((key: _Keyframe) => Math.abs(key.time - kf.time) < 0.001);
        if (!match) throw new Error(`No keyframe at ${kf.time} for ${bone_name}.${channel}.`);
        return match;
      });
      if (action === "select") {
        animation.select();
        animator.select();
        selectAnimationKeyframes(matches);
        return `Successfully performed ${action} on ${matches.length} keyframes for ${bone_name}.${channel}`;
      }

      Undo.initEdit({ animations: [animation] });
      if (!animator) {
        animator = new BoneAnimator(group.uuid, animation, bone_name);
        animation.animators[group.uuid] = animator;
      }


      switch (action) {
        case "create":
          keyframes.forEach((kf) => {
            const keyframe = addAnimationKeyframe(animator,
              {
                time: kf.time,
                channel,
                ...(kf.values !== undefined ? keyframeValues(kf.values) : {}),
                interpolation: kf.interpolation,
              },
              kf.time,
              channel
            );

            if (kf.interpolation === "bezier" && kf.bezier_handles) {
              // @ts-ignore
              if (kf.bezier_handles.left_time !== undefined)
                keyframe.bezier_left_time = handleVector(kf.bezier_handles.left_time);
              // @ts-ignore
              if (kf.bezier_handles.left_value !== undefined)
                keyframe.bezier_left_value = handleVector(kf.bezier_handles.left_value);
              // @ts-ignore
              if (kf.bezier_handles.right_time !== undefined)
                keyframe.bezier_right_time = handleVector(kf.bezier_handles.right_time);
              // @ts-ignore
              if (kf.bezier_handles.right_value !== undefined)
                keyframe.bezier_right_value = handleVector(kf.bezier_handles.right_value);
            }
          });
          break;

        case "delete":
          keyframes.forEach((kf) => {
            const keyframe = animator[channel]?.find(
              (k) => Math.abs(k.time - kf.time) < 0.001
            );
            if (keyframe) {
              keyframe.remove();
            }
          });
          break;

        case "edit":
          keyframes.forEach((kf) => {
            const keyframe = animator[channel]?.find(
              (k) => Math.abs(k.time - kf.time) < 0.001
            );
            if (keyframe) {
              if (kf.values !== undefined) {
                setKeyframeValues(keyframe, kf.values);
              }
              if (kf.interpolation) {
                keyframe.interpolation = kf.interpolation;
              }
              if (kf.interpolation === "bezier" && kf.bezier_handles) {
                // @ts-ignore
                if (kf.bezier_handles.left_time !== undefined)
                  keyframe.bezier_left_time = handleVector(kf.bezier_handles.left_time);
                // @ts-ignore
                if (kf.bezier_handles.left_value !== undefined)
                  keyframe.bezier_left_value = handleVector(kf.bezier_handles.left_value);
                // @ts-ignore
                if (kf.bezier_handles.right_time !== undefined)
                  keyframe.bezier_right_time = handleVector(kf.bezier_handles.right_time);
                // @ts-ignore
                if (kf.bezier_handles.right_value !== undefined)
                  keyframe.bezier_right_value = handleVector(kf.bezier_handles.right_value);
              }
            }
          });
          break;

      }

      Undo.finishEdit(`${action} keyframes`);
      updateKeyframeSelection();
      Animator.preview();

      return `Successfully performed ${action} on ${keyframes.length} keyframes for ${bone_name}.${channel}`;
    },
  },
  animationToolDocs[1].status
);

createTool(
  animationToolDocs[2].name,
  {
    ...animationToolDocs[2],
    async execute({
      animation_id,
      bone_name,
      channel,
      axis,
      action,
      keyframe_range,
      custom_curve,
    }) {
      const animation = animation_id
        ? Animation.all.find(
            (a) => a.uuid === animation_id || a.name === animation_id
          )
        : Animation.selected;

      if (!animation) {
        throw new Error("No animation found or selected.");
      }

      const group = findGroupOrThrow(bone_name);

      const animator = animation.animators[group.uuid];
      if (!animator || !animator[channel]) {
        throw new Error(`No keyframes found for ${bone_name}.${channel}`);
      }

      if (action === "custom" && !custom_curve) throw new Error("custom_curve is required.");
      if (keyframe_range && (![keyframe_range.start, keyframe_range.end].every(Number.isFinite) || keyframe_range.start < 0 || keyframe_range.end < keyframe_range.start)) throw new Error("Keyframe range must be finite, ordered and nonnegative.");
      if (custom_curve && [custom_curve.control_point_1, custom_curve.control_point_2].some(point => !point.every(Number.isFinite) || point[0] < 0 || point[0] > 1)) throw new Error("Custom curve times must be 0–1 and values must be finite.");

      const keyframes: _Keyframe[] = animator[channel].filter((kf: _Keyframe) => {
        if (!keyframe_range) return true;
        return kf.time >= keyframe_range.start && kf.time <= keyframe_range.end;
      });

      keyframes.sort((a: _Keyframe, b: _Keyframe) => a.time - b.time);
      if (!keyframes.length) throw new Error("No keyframes in the requested range.");
      const bezier = ["ease_in", "ease_out", "ease_in_out", "custom"].includes(action);
      const components = axis === "all" ? [0, 1, 2] : [axes.indexOf(axis)];
      if (bezier) {
        if (keyframes.length < 2) throw new Error("Bezier easing requires at least two keyframes.");
        if (keyframes.some(kf => kf.data_points.some(point => components.some(component => !Number.isFinite(Number(point[axes[component]])))))) throw new Error("Bezier easing requires numeric values on the affected axes. Use linear/smooth/stepped for Molang expressions.");
        if (keyframes.some((kf, i) => i > 0 && kf.time <= keyframes[i - 1].time)) throw new Error("Bezier easing requires distinct keyframe times.");
      }
      Undo.initEdit({ animations: [animation] });
      keyframes.forEach(kf => {
        switch (action) {
          case "linear":
            kf.interpolation = "linear";
            break;

          case "stepped":
            kf.interpolation = "step";
            break;

          case "smooth":
            kf.interpolation = "catmullrom";
            break;

          case "ease_in":
          case "ease_out":
          case "ease_in_out":
            kf.interpolation = "bezier";
            break;

          case "custom":
            kf.interpolation = "bezier";
            break;
        }
      });

      if (bezier) {
        const curve = action === "custom" ? [custom_curve!.control_point_1, custom_curve!.control_point_2] :
          action === "ease_in" ? [[0.42, 0], [1, 1]] :
          action === "ease_out" ? [[0, 0], [0.58, 1]] : [[0.42, 0], [0.58, 1]];
        for (let i = 0; i < keyframes.length - 1; i++) {
          const left = keyframes[i], right = keyframes[i + 1];
          const duration = right.time - left.time;
          for (const component of components) {
            const delta = Number(right.data_points[0][axes[component]]) - Number(left.data_points.at(-1)![axes[component]]);
            left.bezier_right_time[component] = duration * curve[0][0];
            left.bezier_right_value[component] = delta * curve[0][1];
            right.bezier_left_time[component] = duration * (curve[1][0] - 1);
            right.bezier_left_value[component] = delta * (curve[1][1] - 1);
          }
          left.bezier_linked = right.bezier_linked = false;
        }
      }

      Undo.finishEdit("Modify animation curves");
      Animator.preview();
      updateKeyframeSelection();

      return `Applied ${action} curve to ${keyframes.length} keyframes in ${bone_name}.${channel}`;
    },
  },
  animationToolDocs[2].status
);

createTool(
  animationToolDocs[3].name,
  {
    ...animationToolDocs[3],
    async execute({ action, bone_data }) {
      Undo.initEdit({
        outliner: true,
        elements: [],
        groups: [],
      });

      let result = "";

      switch (action) {
        case "create": {
          const group = new Group({
            name: bone_data.name,
            origin: bone_data.origin || [0, 0, 0],
            rotation: bone_data.rotation || [0, 0, 0],
          }).init();

          // Set parent
          if (bone_data.parent) {
            const parent = Group.all.find((g) => g.name === bone_data.parent);
            if (parent) {
              group.addTo(parent);
            }
          }

          // Add children elements
          if (bone_data.children) {
            bone_data.children.forEach((childName) => {
              const element = Outliner.elements.find(
                (e) => e.name === childName
              );
              if (element) {
                element.addTo(group);
              }
            });
          }

          // Set up IK if requested
          if (bone_data.ik_enabled && bone_data.ik_target) {
            // @ts-ignore
            group.ik_enabled = true;
            // @ts-ignore
            group.ik_target = bone_data.ik_target;
          }

          result = `Created bone "${group.name}" with UUID ${group.uuid}`;
          break;
        }

        case "parent": {
          const child = findGroupOrThrow(bone_data.name);
          const parent = bone_data.parent
            ? Group.all.find((g) => g.name === bone_data.parent)
            : "root";

          child.addTo(parent);
          result = `Parented "${bone_data.name}" to "${
            bone_data.parent || "root"
          }"`;
          break;
        }

        case "unparent": {
          const bone = findGroupOrThrow(bone_data.name);

          bone.addTo("root");
          result = `Unparented "${bone_data.name}"`;
          break;
        }

        case "delete": {
          const bone = findGroupOrThrow(bone_data.name);

          bone.remove();
          result = `Deleted bone "${bone_data.name}"`;
          break;
        }

        case "rename": {
          const bone = findGroupOrThrow(bone_data.name);

          const newName = bone_data.children?.[0] || "new_name";
          bone.name = newName;
          result = `Renamed bone to "${newName}"`;
          break;
        }

        case "set_pivot": {
          const bone = findGroupOrThrow(bone_data.name);

          if (bone_data.origin) {
            bone.origin = bone_data.origin;
          }
          result = `Set pivot point for "${bone_data.name}"`;
          break;
        }

        case "set_ik": {
          const bone = findGroupOrThrow(bone_data.name);

          // @ts-ignore
          bone.ik_enabled = bone_data.ik_enabled || false;
          if (bone_data.ik_target) {
            // @ts-ignore
            bone.ik_target = bone_data.ik_target;
          }
          result = `Updated IK settings for "${bone_data.name}"`;
          break;
        }

        case "mirror": {
          const bone = findGroupOrThrow(bone_data.name);

          const axis = bone_data.mirror_axis || "x";
          const mirroredBone = bone.duplicate();

          // Mirror position
          const axisIndex = axis === "x" ? 0 : axis === "y" ? 1 : 2;
          mirroredBone.origin[axisIndex] *= -1;

          // Update name
          mirroredBone.name = bone.name.includes("left")
            ? bone.name.replace("left", "right")
            : bone.name.includes("right")
            ? bone.name.replace("right", "left")
            : bone.name + "_mirrored";

          result = `Mirrored bone "${bone_data.name}" across ${axis} axis`;
          break;
        }
      }

      Undo.finishEdit(`Bone rigging: ${action}`);
      Canvas.updateAll();

      return result;
    },
  },
  animationToolDocs[3].status
);

createTool(
  animationToolDocs[4].name,
  {
    ...animationToolDocs[4],
    async execute({ action, time, length, fps, loop_mode, range }) {
      if (!Animation.selected) {
        throw new Error("No animation selected.");
      }

      let result = "";
      if (action === "set_time" && (time === undefined || !Number.isFinite(time) || time < 0)) throw new Error("A finite nonnegative time is required.");
      if (action === "set_length" && (length === undefined || !Number.isFinite(length) || length < 0)) throw new Error("A finite nonnegative length is required.");
      if (action === "set_fps" && fps === undefined) throw new Error("FPS parameter required for set_fps action.");
      if (action === "select_range" && (!range || range.start < 0 || range.end < range.start || !Number.isFinite(range.end))) throw new Error("An ordered nonnegative range is required.");
      const changesAnimation = ["set_length", "set_fps"].includes(action) || (action === "loop" && loop_mode !== undefined);
      if (changesAnimation) Undo.initEdit({ animations: [Animation.selected] });

      switch (action) {
        case "play":
          Timeline.start();
          result = "Started animation playback";
          break;

        case "pause":
          Timeline.pause();
          result = "Paused animation playback";
          break;

        case "stop":
          Timeline.setTime(0);
          Timeline.pause();
          result = "Stopped animation playback";
          break;

        case "set_time":
          if (time === undefined) {
            throw new Error("Time parameter required for set_time action.");
          }
          Timeline.setTime(time);
          result = `Set timeline to ${time} seconds`;
          break;

        case "set_length":
          if (length === undefined) {
            throw new Error("Length parameter required for set_length action.");
          }
          Animation.selected.setLength(length);
          result = `Set animation length to ${Animation.selected.length} seconds`;
          break;

        case "set_fps":
          if (fps === undefined) {
            throw new Error("FPS parameter required for set_fps action.");
          }
          Animation.selected.snapping = fps;
          result = `Set animation FPS to ${fps}`;
          break;

        case "loop":
          if (loop_mode) {
            Animation.selected.loop = loop_mode;
          }
          result = `Set loop mode to ${loop_mode || Animation.selected.loop}`;
          break;

        case "select_range":
          if (!range) {
            throw new Error(
              "Range parameter required for select_range action."
            );
          }
          // Select keyframes in range
          selectAnimationKeyframes(Timeline.keyframes.filter(kf => kf.time >= range.start && kf.time <= range.end));
          result = `Selected keyframes between ${range.start} and ${range.end} seconds`;
          break;
      }

      if (changesAnimation) Undo.finishEdit(`Animation timeline: ${action}`);
      Animator.preview();

      return result;
    },
  },
  animationToolDocs[4].status
);

createTool(
  animationToolDocs[5].name,
  {
    ...animationToolDocs[5],
    async execute({ selection, range, pattern, operation, parameters = {} }) {
      if (!Animation.selected) {
        throw new Error("No animation selected.");
      }

      // A collapsed/hidden timeline does not remove its animation keyframes.
      const allKeyframes: _Keyframe[] = Object.values(Animation.selected.animators).flatMap(animator => animator.keyframes);
      let keyframes: _Keyframe[] = [];
      if (range && (!Number.isFinite(range.start) || !Number.isFinite(range.end) || range.start < 0 || range.end < range.start)) throw new Error("Range must be finite, ordered and nonnegative.");

      switch (selection) {
        case "all":
          keyframes = allKeyframes;
          break;

        case "selected":
          keyframes = allKeyframes.filter(kf => Timeline.selected.includes(kf));
          break;

        case "range":
          if (!range) {
            throw new Error("Range required for range selection.");
          }
          keyframes = allKeyframes.filter(
            (kf) => kf.time >= range.start && kf.time <= range.end
          );
          break;

        case "pattern":
          if (!pattern) {
            throw new Error("Pattern required for pattern selection.");
          }
          if (!Number.isFinite(pattern.offset)) throw new Error("Pattern offset must be finite.");
          keyframes = allKeyframes.filter((kf) => {
            const step = (kf.time - pattern.offset) / pattern.interval;
            return Math.abs(step - Math.round(step)) * pattern.interval < 0.001;
          });
          break;
      }

      if (keyframes.length === 0) {
        throw new Error("No keyframes found matching selection criteria.");
      }
      if (operation === "mirror" && !parameters.mirror_axis) throw new Error("Mirror axis required for mirror operation.");
      if (Object.values(parameters).some(value => typeof value === "number" && !Number.isFinite(value))) throw new Error("Operation parameters must be finite.");
      if (parameters.offset_values?.some((value: number) => !Number.isFinite(value))) throw new Error("Value offsets must be finite.");
      if ((["mirror", "smooth", "bake"].includes(operation) || parameters.offset_values) && keyframes.some(kf => !["rotation", "position", "scale"].includes(kf.channel))) throw new Error("This operation requires transform keyframes; narrow the selection.");
      const pivot = parameters.scale_pivot ?? 0, factor = parameters.scale_factor ?? 1;
      if (operation === "scale" && factor <= 0) throw new Error("Time scale must be positive; use reverse for time reversal.");
      const minTime = Math.min(...keyframes.map(kf => kf.time)), maxTime = Math.max(...keyframes.map(kf => kf.time));
      const plannedTimes = new Map(keyframes.map(kf => [kf, operation === "offset" ? kf.time + (parameters.offset_time ?? 0) : operation === "scale" ? pivot + (kf.time - pivot) * factor : operation === "reverse" ? minTime + maxTime - kf.time : kf.time]));
      if ([...plannedTimes.values()].some(time => !Number.isFinite(time) || time < 0)) throw new Error("Resulting keyframe times must be finite and nonnegative.");
      if (["offset", "scale", "reverse"].includes(operation)) {
        for (const key of keyframes) for (const other of allKeyframes) {
          if (key !== other && key.animator === other.animator && key.channel === other.channel && Math.abs(plannedTimes.get(key)! - (plannedTimes.get(other) ?? other.time)) < 0.00001) throw new Error("Operation would collide with another keyframe in the same channel.");
        }
      }

      const bakeSamples: Array<{ animator: BoneAnimator; channel: string; time: number; values: number[] }> = [];
      if (operation === "bake") {
        const interval = parameters.bake_interval ?? 1 / Animation.selected.snapping;
        const plans: Array<{ animator: BoneAnimator; channel: string; times: number[] }> = [];
        let count = 0;
        for (const animator of new Set(keyframes.map(kf => kf.animator))) {
          for (const channel of ["rotation", "position", "scale"]) {
            const selected = keyframes.filter(kf => kf.animator === animator && kf.channel === channel);
            if (selected.length < 2) continue;
            const end = Math.max(...selected.map(kf => kf.time));
            const times = bakeTimes(Math.min(...selected.map(kf => kf.time)), end, interval);
            if (Math.abs(times.at(-1)! - end) > 1e-9) times.push(end);
            count += times.length;
            if (count > MAX_BAKED_KEYFRAMES) throw new Error("Bake exceeds total keyframe limit; increase bake_interval.");
            plans.push({ animator: animator as BoneAnimator, channel, times });
          }
        }
        const previousTime = Timeline.time;
        try {
          for (const { animator, channel, times } of plans) for (const time of times) {
            Timeline.time = time;
            const values = animator.interpolate(channel, false);
            if (!Array.isArray(values) || values.some(value => !Number.isFinite(value))) throw new Error(`Cannot sample ${channel} at ${time}`);
            bakeSamples.push({ animator, channel, time, values });
          }
        } finally { Timeline.time = previousTime; }
        if (!bakeSamples.length) throw new Error("Baking requires at least two selected keys in a transform channel.");
      }
      Undo.initEdit({ animations: [Animation.selected] });
      try {
      switch (operation) {
        case "offset":
          keyframes.forEach((kf) => {
            if (parameters.offset_time !== undefined) {
              kf.time = plannedTimes.get(kf)!;
            }
            if (parameters.offset_values) {
              kf.uniform = false;
              kf.data_points.forEach((_, point) => axes.forEach((axis, index) => kf.offset(axis, parameters.offset_values![index], point)));
            }
          });
          break;

        case "scale":
          keyframes.forEach((kf) => {
            kf.time = plannedTimes.get(kf)!;
            kf.bezier_left_time = kf.bezier_left_time.map(value => value * factor) as ArrayVector3;
            kf.bezier_right_time = kf.bezier_right_time.map(value => value * factor) as ArrayVector3;
          });
          break;

        case "reverse":
          keyframes.forEach((kf) => {
            kf.time = plannedTimes.get(kf)!;
            if (kf.data_points.length > 1) kf.data_points.reverse();
            const leftTime = [...kf.bezier_left_time], leftValue = [...kf.bezier_left_value];
            kf.bezier_left_time = kf.bezier_right_time.map(value => -value) as ArrayVector3;
            kf.bezier_left_value = [...kf.bezier_right_value] as ArrayVector3;
            kf.bezier_right_time = leftTime.map(value => -value) as ArrayVector3;
            kf.bezier_right_value = leftValue as ArrayVector3;
          });
          break;

        case "mirror":
          const axisIndex =
            parameters.mirror_axis === "x"
              ? 0
              : parameters.mirror_axis === "y"
              ? 1
              : 2;
          keyframes.forEach((kf) => {
            (kf as unknown as { flip(axis: number): void }).flip(axisIndex);
          });
          break;

        case "smooth":
          // Apply catmullrom interpolation to all keyframes
          keyframes.forEach((kf) => {
            kf.interpolation = "catmullrom";
          });
          break;

        case "bake":
          for (const animator of new Set(bakeSamples.map(sample => sample.animator))) for (const channel of ["rotation", "position", "scale"] as const) {
            const samples = bakeSamples.filter(sample => sample.animator === animator && sample.channel === channel);
            if (!samples.length) continue;
            const start = samples[0].time, end = samples.at(-1)!.time;
            for (const keyframe of [...animator[channel]]) if (keyframe.time >= start && keyframe.time <= end) keyframe.remove();
          }
          for (const sample of bakeSamples) {
            addAnimationKeyframe(sample.animator, { ...keyframeValues(sample.values), interpolation: "linear" }, sample.time, sample.channel);
          }
          break;     }

      Animation.selected.setLength();
      Undo.finishEdit(`Batch keyframe operation: ${operation}`);
      } catch (error) { Undo.cancelEdit(); throw error; }
      updateKeyframeSelection();
      Animator.preview();

      return `Performed ${operation} on ${keyframes.length} keyframes`;
    },
  },
  animationToolDocs[5].status
);

createTool(
  animationToolDocs[6].name,
  {
    ...animationToolDocs[6],
    async execute({ action, source, target }) {
      switch (action) {
        case "copy": {
          if (!source) {
            throw new Error("Source data required for copy operation.");
          }

          const srcAnimation = source.animation
            ? Animation.all.find(
                (a) =>
                  a.uuid === source.animation || a.name === source.animation
              )
            : Animation.selected;

          if (!srcAnimation) {
            throw new Error("Source animation not found.");
          }

          const srcBone = findGroupOrThrow(source.bone);

          const animator = srcAnimation.animators[srcBone.uuid];
          if (!animator) {
            throw new Error(`No animation data for bone "${source.bone}".`);
          }

          // Copy keyframe data
          const copiedData: Record<string, CopiedKeyframe[]> = {};

          source.channels.forEach((channel: "rotation" | "position" | "scale") => {
            if (!animator[channel]) return;

            let keyframes = animator[channel];
            if (source.time_range) {
              keyframes = keyframes.filter(
                (kf: _Keyframe) =>
                  kf.time >= source.time_range.start &&
                  kf.time <= source.time_range.end
              );
            }

            copiedData[channel] = keyframes.map((kf: _Keyframe) => structuredClone({ ...kf.getUndoCopy(false), time: kf.time }));
          });
          if (!Object.values(copiedData).some(keys => keys.length)) throw new Error("No keyframes in the requested channels/range.");
          animationClipboard = copiedData;

          return `Copied animation data from "${source.bone}" (${Object.keys(
            copiedData
          ).join(", ")})`;
        }

        case "paste":
        case "mirror_paste": {
          if (!target) {
            throw new Error("Target data required for paste operation.");
          }

          if (!animationClipboard) {
            throw new Error("No animation data in clipboard. Copy first.");
          }

          const tgtAnimation = target.animation
            ? Animation.all.find(
                (a) =>
                  a.uuid === target.animation || a.name === target.animation
              )
            : Animation.selected;

          if (!tgtAnimation) {
            throw new Error("Target animation not found.");
          }

          const tgtBone = findGroupOrThrow(target.bone);
          const timeOffset = target.time_offset ?? 0;
          for (const keys of Object.values(animationClipboard)) for (const key of keys) {
            const time = key.time + timeOffset;
            if (!Number.isFinite(time) || time < 0) throw new Error("Pasted keyframe times must be finite and nonnegative.");
          }

          Undo.initEdit({ animations: [tgtAnimation] });
          let animator = tgtAnimation.animators[tgtBone.uuid];
          if (!animator) {
            animator = new BoneAnimator(
              tgtBone.uuid,
              tgtAnimation,
              target.bone
            );
            tgtAnimation.animators[tgtBone.uuid] = animator;
          }



          const clipboardData = animationClipboard;
          const mirrorAxis =
            action === "mirror_paste" ? target.mirror_axis || "x" : null;
          const axisIndex =
            mirrorAxis === "x"
              ? 0
              : mirrorAxis === "y"
              ? 1
              : mirrorAxis === "z"
              ? 2
              : -1;

          Object.entries(clipboardData).forEach(
            ([channel, keyframes]) => {
              keyframes.forEach((kfData) => {
                const keyframe = addAnimationKeyframe(animator,
                  structuredClone(kfData),
                  kfData.time + timeOffset,
                  channel
                );
                // Native reflection flips rotation about the other two axes,
                // position on the chosen axis, and associated value handles.
                // The 5.0.6 stub declares axis letters, but 5.1.6 uses 0/1/2.
                if (mirrorAxis) (keyframe as unknown as { flip(axis: number): void }).flip(axisIndex);
              });
            }
          );

          Undo.finishEdit(`${action} animation data`);
          updateKeyframeSelection();
          Animator.preview();

          return `Pasted animation data to "${target.bone}"${
            mirrorAxis ? ` (mirrored on ${mirrorAxis} axis)` : ""
          }`;
        }
      }
    },
  },
  animationToolDocs[6].status
);
}
