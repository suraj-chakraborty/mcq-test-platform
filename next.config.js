/** @type {import('next').NextConfig} */
const nextConfig = {
    devIndicators: false,
    webpack: (config, { isServer }) => {
        // Ignore system folders during watch
        config.watchOptions = {
            ignored: ['**/node_modules/**', '**/.next/**', '**/System Volume Information/**', '**/found.*/**'],
        };
        return config;
    },
};

module.exports = nextConfig;
