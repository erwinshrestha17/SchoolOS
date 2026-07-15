export const Queue = jest.fn().mockImplementation(() => ({
  add: jest.fn().mockResolvedValue({ id: 'job-id' }),
  on: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  onModuleDestroy: jest.fn().mockResolvedValue(undefined),
  onApplicationShutdown: jest.fn().mockResolvedValue(undefined),
}));

export const Worker = jest.fn().mockImplementation(() => ({
  on: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  onModuleDestroy: jest.fn().mockResolvedValue(undefined),
  onApplicationShutdown: jest.fn().mockResolvedValue(undefined),
}));

export const Job = jest.fn();

export class DelayedError extends Error {}
