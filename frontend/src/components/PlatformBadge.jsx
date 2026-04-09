import React from 'react';

const COLORS = {
  google: 'bg-blue-100 text-blue-700',
  meta: 'bg-indigo-100 text-indigo-700',
  tiktok: 'bg-pink-100 text-pink-700',
  manual: 'bg-gray-100 text-gray-700',
};

const LABELS = { google: 'Google', meta: 'Meta', tiktok: 'TikTok', manual: 'Manual' };

export default function PlatformBadge({ platform }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${COLORS[platform] || COLORS.manual}`}>
      {LABELS[platform] || platform}
    </span>
  );
}
