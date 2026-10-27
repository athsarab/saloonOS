import type { NextConfig } from 'next';
import path from 'node:path';
const config: NextConfig = { outputFileTracingRoot: path.join(process.cwd(), '../..'), poweredByHeader: false };
export default config;
