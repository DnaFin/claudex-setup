module.exports = {
  testMatch: ['**/test/**/*.test.js'],
  testTimeout: 30000,
  coveragePathIgnorePatterns: ['/node_modules/', '/test/', '/docs/', '/content/', '/action/'],
  collectCoverageFrom: ['src/**/*.js', 'bin/cli.js'],
};
