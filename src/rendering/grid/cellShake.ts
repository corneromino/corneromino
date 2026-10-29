/** Shared damped motion for lock feedback and verification waves. Times are seconds. */
export function getCellShakeOffset(time: number, duration: number, amplitude: number, frequencyHz: number) {
  if (duration <= 0 || time < 0 || time >= duration) return { x: 0, y: 0 }
  const fade = (1 - time / duration) ** 2
  const phase = time * frequencyHz * Math.PI * 2
  return {
    x: Math.sin(phase) * amplitude * fade,
    y: Math.sin(phase * 1.3) * amplitude * fade * 0.6,
  }
}
