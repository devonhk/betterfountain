module.exports = {
    testMatch: [
      '**/*.spec.ts',
    ],
    modulePathIgnorePatterns: [
      "<rootDir>/out/"
    ],
    moduleNameMapper: {
      '^blob$': '<rootDir>/src/__mocks__/blob.ts',
    },
    verbose: true,
    reporters: [
      'default',
    ],
    preset: 'ts-jest',
  }
