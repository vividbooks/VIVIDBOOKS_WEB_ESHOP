export interface Notification {
  id: string;
  type: 'custom' | 'slider';
  title: string;
  subtitle?: string;
  emoji?: string;
  link?: string;
  isActive: boolean;
  order: number;
  /** Only for type 'slider' */
  sliderBg?: string;
  sliderBadges?: string[];
  sliderBottom?: string;
  sliderLayout?: 'center' | 'left-image';
  sliderImage?: string;
  createdAt?: string;
}

export const DEFAULT_NOTIFICATIONS: Notification[] = [];
