import { CircleEllipsis, HeartPulse, House, Popcorn, ShoppingBag, TrainFront, Utensils } from 'lucide-react';
import type { Category } from '../types';

export const categories = {
  food: { label: 'Food & drinks', icon: Utensils, color: '#ee9a4a', background: '#fff1e2' },
  transport: { label: 'Transport', icon: TrainFront, color: '#6199e8', background: '#eaf2ff' },
  shopping: { label: 'Shopping', icon: ShoppingBag, color: '#9b7be7', background: '#f1ebff' },
  housing: { label: 'Housing & bills', icon: House, color: '#5dad98', background: '#e8f5ef' },
  health: { label: 'Health', icon: HeartPulse, color: '#e6809c', background: '#ffedf2' },
  entertainment: { label: 'Entertainment', icon: Popcorn, color: '#d6ae4a', background: '#fff8df' },
  other: { label: 'Other', icon: CircleEllipsis, color: '#8c94a4', background: '#eef0f4' },
} satisfies Record<Category, { label: string; icon: typeof Utensils; color: string; background: string }>;

export const categoryKeys = Object.keys(categories) as Category[];
