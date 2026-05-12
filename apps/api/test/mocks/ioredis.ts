export default class Redis {
  status = 'ready';
  constructor() {}
  connect = jest.fn().mockResolvedValue(undefined);
  ping = jest.fn().mockResolvedValue('PONG');
  quit = jest.fn().mockResolvedValue(undefined);
  disconnect = jest.fn().mockResolvedValue(undefined);
  on = jest.fn();
  get = jest.fn().mockResolvedValue(null);
  set = jest.fn().mockResolvedValue('OK');
  del = jest.fn().mockResolvedValue(1);
}
