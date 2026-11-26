export const INDEED_PROVINCE_LABELS = {
  bari: 'Bari',
  brindisi: 'Brindisi',
  lecce: 'Lecce',
  taranto: 'Taranto',
} as const;

export type IndeedProvince = keyof typeof INDEED_PROVINCE_LABELS;

export function parseIndeedProvince(value: unknown): IndeedProvince | null {
  if (value === undefined) return 'bari';
  if (typeof value !== 'string' || !Object.hasOwn(INDEED_PROVINCE_LABELS, value)) return null;
  return value as IndeedProvince;
}

export function indeedProvinceIsEnabled(province: IndeedProvince, extra: string | undefined): boolean {
  return province === 'bari' || (extra?.split(',').map(value => value.trim()).includes(province) ?? false);
}

export function architectIndeedIntroPath(province: IndeedProvince): string {
  return `/candidature/architetti-patrimoniali/indeed${province === 'bari' ? '' : `?provincia=${province}`}`;
}

export function architectIndeedStartupPath(province: IndeedProvince): string {
  return `/candidature/architetti-patrimoniali/startup?canale=indeed${province === 'bari' ? '' : `&provincia=${province}`}`;
}
