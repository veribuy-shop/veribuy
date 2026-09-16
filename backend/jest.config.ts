import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@veribuy/common$': '<rootDir>/../packages/common/src',
    '^@veribuy/logger$': '<rootDir>/../packages/logger/src',
    '^@veribuy/redis-cache$': '<rootDir>/../packages/redis-cache/src',
    '^@veribuy/common/(.*)$': '<rootDir>/../packages/common/src/$1',
  },
};

export default config;
