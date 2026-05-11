import { useTranslation } from 'react-i18next';
import i18n from 'i18next';

/**
 * Module-level tc() — can be used outside React components (e.g. in static arrays).
 * Reads language from the i18n singleton directly.
 */
export function tc(ar: string, en: string): string {
  return i18n.language === 'en' ? en : ar;
}

/**
 * React hook version — returns a tc() function that re-renders when language changes.
 * Use this INSIDE React components for reactive language switching.
 */
export function useTranslate() {
  const { i18n } = useTranslation();
  return (ar: string, en: string): string => i18n.language === 'en' ? en : ar;
}

export default useTranslate;
