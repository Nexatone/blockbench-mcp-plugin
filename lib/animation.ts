type AxisValue = number | string;
export const axes = ["x", "y", "z"] as const;

export function getAnimationClass(): typeof _Animation {
  return (globalThis as unknown as { Animation: typeof _Animation }).Animation;
}

export function keyframeValues(values: AxisValue | AxisValue[]) {
  const vector = Array.isArray(values) ? values : [values, values, values];
  return { x: vector[0], y: vector[1], z: vector[2] };
}

export function setKeyframeValues(keyframe: _Keyframe, values: AxisValue | AxisValue[]) {
  const data = keyframeValues(values);
  // Disable uniform editing before applying a nonuniform scale.
  keyframe.uniform = !Array.isArray(values);
  for (const axis of axes) keyframe.set(axis, data[axis]);
}

/** addKeyframe does not depend on Animation.selected, unlike createKeyframe. */
export function addAnimationKeyframe(animator: GeneralAnimator, data: any, time: number, channel: string) {
  const keyframe = animator.addKeyframe({ ...data, time, channel });
  if (!keyframe) throw new Error(`Unsupported animation channel: ${channel}`);
  keyframe.replaceOthers([]);
  animator.animation.setLength();
  return keyframe;
}

export function handleVector(value: number | number[]): ArrayVector3 {
  return (Array.isArray(value) ? [...value] : [value, value, value]) as ArrayVector3;
}

export const MAX_BAKED_KEYFRAMES = 5000;
export function bakeTimes(start: number, end: number, interval: number): number[] {
  if (![start, end, interval].every(Number.isFinite) || start < 0 || end < start || interval <= 0) {
    throw new Error("Bake requires a finite positive interval and an ordered, nonnegative time range.");
  }
  const count = Math.floor((end - start) / interval + 1e-9) + 1;
  if (count > MAX_BAKED_KEYFRAMES) throw new Error(`Bake exceeds ${MAX_BAKED_KEYFRAMES} keys. Increase bake_interval.`);
  return Array.from({ length: count }, (_, i) => start + i * interval);
}
