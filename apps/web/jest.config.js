module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'ES2021',
          module: 'commonjs',
          lib: ['ES2021', 'DOM'],
          esModuleInterop: true,
          strict: true,
        },
      },
    ],
  },
  testEnvironment: 'node',
};
