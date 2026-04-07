import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // .memory/ 경로를 환경변수로 주입
  env: {
    MEMORY_ROOT: process.env.MEMORY_ROOT || '/Users/sid/git/ai-team/.memory',
  },
};

export default nextConfig;
