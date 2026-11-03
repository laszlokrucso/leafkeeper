export const rangeKeys = ['temp', 'light_lux', 'env_humid', 'soil_moist', 'soil_ec'] as const;
export const careKeys = ['sunlight', 'watering', 'soil', 'fertilization', 'pruning'] as const;
export type PlantbookDetails = {
  pid: string; display_pid: string; alias: string | null; origin: string | null;
  scientific_synonyms: string | null; image_url: string | null;
  image_source: string | null; image_license: string | null;
} & Partial<Record<`min_${typeof rangeKeys[number]}` | `max_${typeof rangeKeys[number]}`, number | null>>
  & Partial<Record<typeof careKeys[number], string | null>>;

// Preserve zero and negative temperatures; never turn missing bounds into zero.
export function formatRange(min: number | null | undefined, max: number | null | undefined, unit: string) {
  const valid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  const fmt = (n: number) => n.toLocaleString('hu-HU');
  if (valid(min) && valid(max)) return min <= max ? `${fmt(min)}–${fmt(max)} ${unit}` : null;
  if (valid(min)) return `legalább ${fmt(min)} ${unit}`;
  if (valid(max)) return `legfeljebb ${fmt(max)} ${unit}`;
  return null;
}
