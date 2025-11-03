import { TodShiftColorScale } from '../types/shift.types';

export const COLOR_DEFICIT_LIGHT = '#FFEBEE';
export const COLOR_DEFICIT_HEAVY = '#C62828';
export const COLOR_EXCESS_LIGHT = '#E8F5E9';
export const COLOR_EXCESS_HEAVY = '#2E7D32';
export const COLOR_BALANCED = '#ECEFF1';

export function colorForValue(value: number, scale: TodShiftColorScale | null): string {
  if (!scale || value === 0) {
    return COLOR_BALANCED;
  }

  if (value < 0) {
    const ratio = scale.min < 0 ? Math.min(1, Math.abs(value / scale.min)) : 1;
    return blendColors(COLOR_DEFICIT_LIGHT, COLOR_DEFICIT_HEAVY, ratio);
  }

  const ratio = scale.max > 0 ? Math.min(1, value / scale.max) : 1;
  return blendColors(COLOR_EXCESS_LIGHT, COLOR_EXCESS_HEAVY, ratio);
}

export function excelColorForValue(value: number, scale: TodShiftColorScale | null): string {
  return toArgb(colorForValue(value, scale));
}

export function blendColors(startHex: string, endHex: string, ratio: number): string {
  const [sr, sg, sb] = hexToRgb(startHex);
  const [er, eg, eb] = hexToRgb(endHex);
  const r = Math.round(sr + (er - sr) * ratio);
  const g = Math.round(sg + (eg - sg) * ratio);
  const b = Math.round(sb + (eb - sb) * ratio);
  return rgbToHex(r, g, b);
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(component => component.toString(16).padStart(2, '0')).join('')}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  return [
    parseInt(normalized.substring(0, 2), 16),
    parseInt(normalized.substring(2, 4), 16),
    parseInt(normalized.substring(4, 6), 16)
  ];
}

export function toArgb(hex: string): string {
  return `FF${hex.replace('#', '').toUpperCase()}`;
}
