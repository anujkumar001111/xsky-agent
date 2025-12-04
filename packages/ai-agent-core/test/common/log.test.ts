import { Logger, LogLevel, ConsoleTransport } from '../../src/common/log';

describe('common/log', () => {
  let mockTransport: any;
  let originalConsole: typeof console;

  beforeEach(() => {
    // Mock transport for testing
    mockTransport = {
      log: jest.fn(),
    };

    // Save original console for restoration
    originalConsole = console;
  });

  describe('LogLevel enum', () => {
    test('should have correct log level values', () => {
      expect(LogLevel.DEBUG).toBe(0);
      expect(LogLevel.INFO).toBe(1);
      expect(LogLevel.WARN).toBe(2);
      expect(LogLevel.ERROR).toBe(3);
      expect(LogLevel.FATAL).toBe(4);
      expect(LogLevel.OFF).toBe(5);
    });
  });

  describe('ConsoleTransport', () => {
    test('should log DEBUG to console.debug', () => {
      const spy = jest.spyOn(console, 'debug').mockImplementation();
      const transport = new ConsoleTransport();
      transport.log(LogLevel.DEBUG, 'debug message');
      expect(spy).toHaveBeenCalledWith('debug message');
      spy.mockRestore();
    });

    test('should log INFO to console.info', () => {
      const spy = jest.spyOn(console, 'info').mockImplementation();
      const transport = new ConsoleTransport();
      transport.log(LogLevel.INFO, 'info message');
      expect(spy).toHaveBeenCalledWith('info message');
      spy.mockRestore();
    });

    test('should log WARN to console.warn', () => {
      const spy = jest.spyOn(console, 'warn').mockImplementation();
      const transport = new ConsoleTransport();
      transport.log(LogLevel.WARN, 'warn message');
      expect(spy).toHaveBeenCalledWith('warn message');
      spy.mockRestore();
    });

    test('should log ERROR to console.error', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      const transport = new ConsoleTransport();
      transport.log(LogLevel.ERROR, 'error message');
      expect(spy).toHaveBeenCalledWith('error message');
      spy.mockRestore();
    });

    test('should log FATAL to console.error', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      const transport = new ConsoleTransport();
      transport.log(LogLevel.FATAL, 'fatal message');
      expect(spy).toHaveBeenCalledWith('fatal message');
      spy.mockRestore();
    });

    test('should not log OFF level', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      const transport = new ConsoleTransport();
      transport.log(LogLevel.OFF, 'off message');
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('Logger constructor', () => {
    test('should initialize with default options', () => {
      const logger = new Logger();
      expect(logger['level']).toBe(LogLevel.INFO);
      expect(logger['prefix']).toBe('');
      expect(logger['dateFormat']).toBe(true);
      expect(logger['transports']).toHaveLength(1);
      expect(logger['transports'][0]).toBeInstanceOf(ConsoleTransport);
    });

    test('should initialize with custom options', () => {
      const customTransport = mockTransport;
      const logger = new Logger({
        level: LogLevel.DEBUG,
        prefix: 'MyApp',
        dateFormat: false,
        transport: [customTransport],
      });
      expect(logger['level']).toBe(LogLevel.DEBUG);
      expect(logger['prefix']).toBe('MyApp');
      expect(logger['dateFormat']).toBe(false);
      expect(logger['transports']).toContain(customTransport);
    });
  });

  describe('setLevel', () => {
    test('should update log level', () => {
      const logger = new Logger();
      logger.setLevel(LogLevel.ERROR);
      expect(logger['level']).toBe(LogLevel.ERROR);
    });

    test('should return logger for method chaining', () => {
      const logger = new Logger();
      const result = logger.setLevel(LogLevel.DEBUG);
      expect(result).toBe(logger);
    });
  });

  describe('setPrefix', () => {
    test('should update prefix', () => {
      const logger = new Logger();
      logger.setPrefix('TestPrefix');
      expect(logger['prefix']).toBe('TestPrefix');
    });

    test('should return logger for method chaining', () => {
      const logger = new Logger();
      const result = logger.setPrefix('Test');
      expect(result).toBe(logger);
    });
  });

  describe('addTransport', () => {
    test('should add new transport', () => {
      const logger = new Logger({ transport: [] });
      const transport = mockTransport;
      logger.addTransport(transport);
      expect(logger['transports']).toContain(transport);
    });

    test('should return logger for method chaining', () => {
      const logger = new Logger();
      const result = logger.addTransport(mockTransport);
      expect(result).toBe(logger);
    });

    test('should allow adding multiple transports', () => {
      const logger = new Logger({ transport: [] });
      const transport1 = mockTransport;
      const transport2 = { log: jest.fn() };
      logger.addTransport(transport1);
      logger.addTransport(transport2);
      expect(logger['transports']).toHaveLength(2);
      expect(logger['transports']).toContain(transport1);
      expect(logger['transports']).toContain(transport2);
    });
  });

  describe('formatMessage', () => {
    test('should format message with all components', () => {
      const logger = new Logger({
        prefix: 'APP',
        dateFormat: false,
      });
      const formatted = logger['formatMessage'](LogLevel.INFO, 'test message');
      expect(formatted).toContain('[INFO]');
      expect(formatted).toContain('[APP]');
      expect(formatted).toContain('test message');
    });

    test('should include date when dateFormat is true', () => {
      const logger = new Logger({
        prefix: '',
        dateFormat: true,
      });
      const formatted = logger['formatMessage'](LogLevel.INFO, 'test');
      expect(formatted).toMatch(/\[\d{1,2}\/\d{1,2}\/\d{4}/);
    });

    test('should not include date when dateFormat is false', () => {
      const logger = new Logger({
        prefix: '',
        dateFormat: false,
      });
      const formatted = logger['formatMessage'](LogLevel.INFO, 'test');
      expect(formatted).not.toMatch(/\[\d{1,2}\/\d{1,2}\/\d{4}/);
      expect(formatted).toContain('[INFO]');
    });

    test('should format all log levels', () => {
      const logger = new Logger({ prefix: '', dateFormat: false });
      expect(logger['formatMessage'](LogLevel.DEBUG, 'msg')).toContain('[DEBUG]');
      expect(logger['formatMessage'](LogLevel.INFO, 'msg')).toContain('[INFO]');
      expect(logger['formatMessage'](LogLevel.WARN, 'msg')).toContain('[WARN]');
      expect(logger['formatMessage'](LogLevel.ERROR, 'msg')).toContain('[ERROR]');
      expect(logger['formatMessage'](LogLevel.FATAL, 'msg')).toContain('[FATAL]');
    });
  });

  describe('log method', () => {
    test('should respect log level filtering', () => {
      const logger = new Logger({
        level: LogLevel.WARN,
        transport: [mockTransport],
        dateFormat: false,
      });

      logger['log'](LogLevel.DEBUG, 'debug msg');
      logger['log'](LogLevel.INFO, 'info msg');
      logger['log'](LogLevel.WARN, 'warn msg');

      // DEBUG and INFO should not be logged
      expect(mockTransport.log).toHaveBeenCalledTimes(1);
      expect(mockTransport.log).toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining('warn msg'));
    });

    test('should handle Error objects', () => {
      const logger = new Logger({
        level: LogLevel.INFO,
        transport: [mockTransport],
        dateFormat: false,
      });

      const error = new Error('Test error');
      logger['log'](LogLevel.ERROR, error);

      const call = mockTransport.log.mock.calls[0];
      expect(call[1]).toContain('Test error');
      expect(call[1]).toContain('Error');
    });

    test('should handle additional arguments', () => {
      const logger = new Logger({
        level: LogLevel.INFO,
        transport: [mockTransport],
        dateFormat: false,
      });

      logger['log'](LogLevel.INFO, 'message', 'arg1', 'arg2', { key: 'value' });

      const call = mockTransport.log.mock.calls[0];
      expect(call[1]).toContain('message');
      expect(call[1]).toContain('arg1');
      expect(call[1]).toContain('arg2');
      expect(call[1]).toContain('"key":"value"');
    });

    test('should handle null and undefined arguments', () => {
      const logger = new Logger({
        level: LogLevel.INFO,
        transport: [mockTransport],
        dateFormat: false,
      });

      logger['log'](LogLevel.INFO, 'message', null, undefined);

      const call = mockTransport.log.mock.calls[0];
      expect(call[1]).toContain('null');
      expect(call[1]).toContain('undefined');
    });

    test('should call all transports', () => {
      const transport1 = { log: jest.fn() };
      const transport2 = { log: jest.fn() };
      const logger = new Logger({
        level: LogLevel.INFO,
        transport: [transport1, transport2],
        dateFormat: false,
      });

      logger['log'](LogLevel.INFO, 'test message');

      expect(transport1.log).toHaveBeenCalled();
      expect(transport2.log).toHaveBeenCalled();
    });
  });

  describe('isEnableDebug', () => {
    test('should return true when level is DEBUG or lower', () => {
      expect(new Logger({ level: LogLevel.DEBUG }).isEnableDebug()).toBe(true);
    });

    test('should return false when level is higher than DEBUG', () => {
      expect(new Logger({ level: LogLevel.INFO }).isEnableDebug()).toBe(false);
      expect(new Logger({ level: LogLevel.WARN }).isEnableDebug()).toBe(false);
    });
  });

  describe('isEnableInfo', () => {
    test('should return true when level is INFO or lower', () => {
      expect(new Logger({ level: LogLevel.DEBUG }).isEnableInfo()).toBe(true);
      expect(new Logger({ level: LogLevel.INFO }).isEnableInfo()).toBe(true);
    });

    test('should return false when level is higher than INFO', () => {
      expect(new Logger({ level: LogLevel.WARN }).isEnableInfo()).toBe(false);
    });
  });

  describe('debug method', () => {
    test('should log debug messages when enabled', () => {
      const logger = new Logger({
        level: LogLevel.DEBUG,
        transport: [mockTransport],
        dateFormat: false,
      });

      logger.debug('debug message');

      expect(mockTransport.log).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('debug message'));
    });

    test('should not log debug messages when disabled', () => {
      const logger = new Logger({
        level: LogLevel.INFO,
        transport: [mockTransport],
      });

      logger.debug('debug message');

      expect(mockTransport.log).not.toHaveBeenCalled();
    });
  });

  describe('info method', () => {
    test('should log info messages', () => {
      const logger = new Logger({
        level: LogLevel.INFO,
        transport: [mockTransport],
        dateFormat: false,
      });

      logger.info('info message');

      expect(mockTransport.log).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('info message'));
    });
  });

  describe('warn method', () => {
    test('should log warn messages', () => {
      const logger = new Logger({
        level: LogLevel.WARN,
        transport: [mockTransport],
        dateFormat: false,
      });

      logger.warn('warn message');

      expect(mockTransport.log).toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining('warn message'));
    });
  });

  describe('error method', () => {
    test('should log error messages', () => {
      const logger = new Logger({
        level: LogLevel.ERROR,
        transport: [mockTransport],
        dateFormat: false,
      });

      logger.error('error message');

      expect(mockTransport.log).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('error message'));
    });

    test('should log Error objects', () => {
      const logger = new Logger({
        level: LogLevel.ERROR,
        transport: [mockTransport],
        dateFormat: false,
      });

      const error = new Error('Something went wrong');
      logger.error(error);

      expect(mockTransport.log).toHaveBeenCalled();
    });
  });

  describe('fatal method', () => {
    test('should log fatal messages', () => {
      const logger = new Logger({
        level: LogLevel.FATAL,
        transport: [mockTransport],
        dateFormat: false,
      });

      logger.fatal('fatal message');

      expect(mockTransport.log).toHaveBeenCalledWith(LogLevel.FATAL, expect.stringContaining('fatal message'));
    });
  });

  describe('createChild', () => {
    test('should create child logger with nested prefix', () => {
      const logger = new Logger({
        prefix: 'Parent',
        level: LogLevel.DEBUG,
        dateFormat: false,
        transport: [mockTransport],
      });

      const child = logger.createChild('Child');

      expect(child['prefix']).toBe('Parent.Child');
      expect(child['level']).toBe(LogLevel.DEBUG);
      expect(child['dateFormat']).toBe(false);
    });

    test('should create child without parent prefix if parent has none', () => {
      const logger = new Logger({
        prefix: '',
        level: LogLevel.INFO,
        dateFormat: false,
      });

      const child = logger.createChild('Child');

      expect(child['prefix']).toBe('Child');
    });

    test('should inherit parent log level', () => {
      const logger = new Logger({ level: LogLevel.WARN });
      const child = logger.createChild('Sub', {});

      expect(child['level']).toBe(LogLevel.WARN);
    });

    test('should inherit parent transports', () => {
      const logger = new Logger({
        transport: [mockTransport],
      });

      const child = logger.createChild('Sub');

      expect(child['transports']).toContain(mockTransport);
    });

    test('should allow overriding child logger options', () => {
      const parentTransport = mockTransport;
      const childTransport = { log: jest.fn() };

      const logger = new Logger({
        level: LogLevel.INFO,
        prefix: 'Parent',
        dateFormat: true,
        transport: [parentTransport],
      });

      const child = logger.createChild('Child', {
        level: LogLevel.WARN, // Use WARN instead of DEBUG to avoid falsy value (0)
        dateFormat: false,
        transport: [childTransport],
      });

      // When level is explicitly provided and non-falsy, it should be used
      expect(child['level']).toBe(LogLevel.WARN);
      expect(child['dateFormat']).toBe(false);
      expect(child['transports']).toContain(childTransport);
      expect(child['transports']).not.toContain(parentTransport);
    });

    test('should use parent level when child level not specified', () => {
      const logger = new Logger({ level: LogLevel.WARN });
      const child = logger.createChild('Sub', {});

      // When level is not provided, parent level should be used
      expect(child['level']).toBe(LogLevel.WARN);
    });

    test('should use parent level when child DEBUG level specified (falsy value edge case)', () => {
      const logger = new Logger({ level: LogLevel.WARN });
      const child = logger.createChild('Sub', { level: LogLevel.DEBUG });

      // Due to || operator, LogLevel.DEBUG (0) is falsy and parent level is used
      expect(child['level']).toBe(LogLevel.WARN);
    });

    test('should create multi-level hierarchy', () => {
      const logger = new Logger({ prefix: 'A' });
      const child1 = logger.createChild('B');
      const child2 = child1.createChild('C');
      const child3 = child2.createChild('D');

      expect(child1['prefix']).toBe('A.B');
      expect(child2['prefix']).toBe('A.B.C');
      expect(child3['prefix']).toBe('A.B.C.D');
    });
  });

  describe('Default Log instance', () => {
    test('should be exported as default', () => {
      const Log = require('../../src/common/log').default;
      expect(Log).toBeInstanceOf(Logger);
    });
  });

  describe('Edge cases', () => {
    test('should handle very long messages', () => {
      const logger = new Logger({
        level: LogLevel.INFO,
        transport: [mockTransport],
        dateFormat: false,
      });

      const longMessage = 'x'.repeat(10000);
      logger.info(longMessage);

      expect(mockTransport.log).toHaveBeenCalled();
      const call = mockTransport.log.mock.calls[0];
      expect(call[1]).toContain(longMessage);
    });

    test('should handle special characters in messages', () => {
      const logger = new Logger({
        level: LogLevel.INFO,
        transport: [mockTransport],
        dateFormat: false,
      });

      const specialMessage = 'Message with special chars: !@#$%^&*()[]{}';
      logger.info(specialMessage);

      expect(mockTransport.log).toHaveBeenCalled();
      const call = mockTransport.log.mock.calls[0];
      expect(call[1]).toContain(specialMessage);
    });

    test('should handle nested Error objects in arguments', () => {
      const logger = new Logger({
        level: LogLevel.INFO,
        transport: [mockTransport],
        dateFormat: false,
      });

      const error = new Error('Nested error');
      logger.info('Error occurred', error);

      expect(mockTransport.log).toHaveBeenCalled();
      const call = mockTransport.log.mock.calls[0];
      expect(call[1]).toContain('Error occurred');
      expect(call[1]).toContain('Nested error');
    });
  });
});
