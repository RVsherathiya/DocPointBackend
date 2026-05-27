import { Request } from 'express';
import { translate } from './translations';

export const localizeMessage = (req: Request, key: string): string => {
  const lang = (req.headers['x-localization'] as string) || 'en';
  return translate(key, lang);
};
