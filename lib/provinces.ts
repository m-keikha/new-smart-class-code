export const DEFAULT_PROVINCE = 'سیستان و بلوچستان';

export const PROVINCES: readonly string[] = [DEFAULT_PROVINCE];

const RAW_SISTAN_BALUCHESTAN_CITIES: readonly string[] = [
  'زابل',
  'زهک',
  'هامون',
  'هیرمند',
  'نیمروز',
  'زاهدان (مرکز استان)',
  'میرجاوه',
  'خاش',
  'تفتان',
  'ایرانشهر',
  'بمپور',
  'دلگان',
  'فنوج',
  'سراوان',
  'سیب و سوران',
  'مهرستان',
  'چابهار',
  'کنارک',
  'دشتیاری',
  'زرآباد',
  'نیکشهر',
  'قصرقند',
  'لاشار',
  'راسک',
  'سرباز',
];

const persianCollator = new Intl.Collator('fa', { sensitivity: 'base' });

export const SISTAN_BALUCHESTAN_CITIES: readonly string[] = [
  ...RAW_SISTAN_BALUCHESTAN_CITIES,
].sort((a, b) => persianCollator.compare(a, b));

export const GRADE_LEVEL_OPTIONS: readonly string[] = [
  'اول',
  'دوم',
  'سوم',
  'چهارم',
  'پنجم',
  'ششم',
  'هفتم',
  'هشتم',
  'نهم',
  'دهم',
  'یازدهم',
  'دوازدهم',
];

/**
 * Normalizes city names for comparison (handles Arabic variants and optional parenthetical notes like "(مرکز استان)").
 */
export function normalizeCityName(city: string | undefined | null): string {
  if (!city) return '';
  return city
    .replace(/\([^)]*\)/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/[أإ]/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim();
}
