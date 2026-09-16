export const palette = { night: '#081521', mineral: '#3e5968', teal: '#628780', ivory: '#f2eee3', gold: '#d9bf8f' };
export const quality = { mobileWidth: 768, desktopDpr: 1.5, mobileDpr: 1.25, desktopPillars: 74, mobilePillars: 38 };
export const cameraStops = [
  { at: 0, position: [11, 8, 31], target: [0, 2, -42] },
  { at: .23, position: [7, 6, 15], target: [-3, 2, -40] },
  { at: .48, position: [15, 13, -2], target: [0, 1, -40] },
  { at: .74, position: [4, 7, -25], target: [0, 2, -66] },
  { at: 1, position: [0, 6, -48], target: [0, 3, -100] },
];
export function clamp(value: number) { return Math.max(0, Math.min(1, value)); }
