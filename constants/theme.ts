/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export const Brand = {
  bg:          '#F1F5F9',
  card:        '#FFFFFF',
  cardOrange:  '#FFF4ED',
  cardBlue:    '#EFF6FF',
  cardGreen:   '#F0FDF4',
  cardPurple:  '#F5F3FF',
  cardYellow:  '#FEFCE8',
  headerDark:  '#1E293B',
  text:        '#1E293B',
  subtext:     '#64748B',
  accent:      '#FF6B35',
  accentDark:  '#CC4E1A',
  green:       '#16a34a',
  greenLight:  '#86EFAC',
  red:         '#dc2626',
  redLight:    '#FECACA',
  blue:        '#2563eb',
  blueLight:   '#BFDBFE',
  purple:      '#7C3AED',
  border:      '#E2E8F0',
};

export const Colors = {
  light: {
    text: Brand.text,
    background: Brand.bg,
    tint: Brand.accent,
    icon: Brand.subtext,
    tabIconDefault: Brand.subtext,
    tabIconSelected: Brand.accent,
  },
  dark: {
    text: Brand.text,
    background: Brand.bg,
    tint: Brand.accent,
    icon: Brand.subtext,
    tabIconDefault: Brand.subtext,
    tabIconSelected: Brand.accent,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
