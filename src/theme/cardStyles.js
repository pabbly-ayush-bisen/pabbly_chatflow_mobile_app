import { colors } from './colors';

/**
 * Base card styles (background + borderRadius only).
 * For shadow cards, use the <ShadowCard> component instead.
 * These base styles are kept for non-shadow usage (Skeleton, etc.).
 */
export const cardStyles = {
  card: {
    backgroundColor: colors.common.white,
    borderRadius: 16,
  },

  cardFlat: {
    backgroundColor: colors.common.white,
    borderRadius: 16,
  },
};
