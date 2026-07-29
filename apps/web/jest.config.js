module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.tsx?$',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'ES2021',
          module: 'commonjs',
          lib: ['ES2021', 'DOM'],
          esModuleInterop: true,
          jsx: 'react-jsx',
          strict: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testEnvironment: 'node',
};
