export const MESSENGER_OPTIONS = [
  'شاد',
  'سروش',
  'روبیکا',
  'بله',
  'ایتا',
  'تلگرام',
  'واتساپ',
  'سایر',
] as const;

export const REMOTE_ACCESS_OPTIONS = [
  'دسترسی به اینترنت',
  'درسنامه',
  'تلویزیون',
] as const;

export type RemoteAccessOption = (typeof REMOTE_ACCESS_OPTIONS)[number];
