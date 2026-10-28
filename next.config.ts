import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Produces a small self-contained server in .next/standalone (used by the Dockerfile).
  output: 'standalone',
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  // Older addresses now live inside one of the seven sections. Query strings carry over.
  async redirects() {
    const to = (source: string, destination: string) => ({ source, destination, permanent: false });
    return [
      to('/ai', '/study?tool=solve'),
      to('/ai/chat', '/study?tool=chat'),
      to('/ai/concepts', '/study?tool=concepts'),
      to('/ai/notes', '/study?tool=notes'),
      to('/ai/assignments', '/study?tool=assignments'),
      to('/ai/writing', '/study?tool=writing'),
      to('/games', '/study?tool=practice'),
      to('/planner', '/calendar?plan=deadlines'),
      to('/sounds', '/focus'),
      to('/wellbeing', '/you'),
      to('/reset', '/you?tab=reset'),
      to('/grades', '/you'),
      to('/profile', '/you?tab=profile'),
      to('/ranks', '/leaderboard'),
      to('/rewards', '/leaderboard?tab=achievements'),
      to('/garden', '/leaderboard?tab=garden'),
      to('/exams', '/calendar?plan=exams'),
      to('/routine', '/calendar?plan=routine'),
      to('/spots', '/drop'),
      to('/partners', '/drop?tab=partners'),
      to('/rooms', '/drop?tab=rooms'),
      to('/friends', '/drop?tab=friends'),
      to('/leaderboards', '/leaderboard'),
      to('/messages', '/drop?tab=friends'),
      to('/chat', '/drop?tab=friends'),
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
        ],
      },
    ];
  },
};

export default nextConfig;
