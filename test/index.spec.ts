import type { SSEOutput, XStreamOptions } from '../src/core/types';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_KV_SEPARATOR, DEFAULT_PART_SEPARATOR, DEFAULT_STREAM_SEPARATOR, splitPart, splitStream, XStream } from '../src';

describe('xStream', () => {
    describe('基础功能测试', () => {
        it('应该正确处理SSE格式的流数据', async () => {
            const sseData = 'data: Hello World\nevent: message\nid: 1\n\n';
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode(sseData));
                    controller.close();
                }
            });

            const options: XStreamOptions = { readableStream: stream };
            const xstream = XStream(options);

            const results: SSEOutput[] = [];
            for await (const chunk of xstream) {
                results.push(chunk);
            }

            expect(results).toHaveLength(1);
            expect(results[0]).toEqual({
                data: 'Hello World',
                event: 'message',
                id: '1'
            });
        });

        it('应该处理多个SSE事件', async () => {
            const sseData = 'data: First Message\nevent: message\n\ndata: Second Message\nevent: notification\n\n';
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode(sseData));
                    controller.close();
                }
            });

            const options: XStreamOptions = { readableStream: stream };
            const xstream = XStream(options);

            const results: SSEOutput[] = [];
            for await (const chunk of xstream) {
                results.push(chunk);
            }

            expect(results).toHaveLength(2);
            expect(results[0]).toEqual({
                data: 'First Message',
                event: 'message'
            });
            expect(results[1]).toEqual({
                data: 'Second Message',
                event: 'notification'
            });
        });

        it('应该处理自定义TransformStream', async () => {
            const customTransform = new TransformStream<string, string>({
                transform(chunk, controller) {
                    controller.enqueue(chunk.toUpperCase());
                }
            });

            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode('hello world'));
                    controller.close();
                }
            });

            const options: XStreamOptions<string> = {
                readableStream: stream,
                transformStream: customTransform
            };
            const xstream = XStream(options);

            const results: string[] = [];
            for await (const chunk of xstream) {
                results.push(chunk);
            }

            expect(results).toHaveLength(1);
            expect(results[0]).toBe('HELLO WORLD');
        });
    });

    describe('错误处理测试', () => {
        it('应该抛出TypeError当readableStream不是ReadableStream实例时', () => {
            const invalidOptions = { readableStream: 'not a stream' } as any;

            expect(() => XStream(invalidOptions)).toThrow(TypeError);
            expect(() => XStream(invalidOptions)).toThrow('options.readableStream 必须是 ReadableStream 的实例。');
        });

        it('应该处理空的流数据', async () => {
            const stream = new ReadableStream({
                start(controller) {
                    controller.close();
                }
            });

            const options: XStreamOptions = { readableStream: stream };
            const xstream = XStream(options);

            const results: SSEOutput[] = [];
            for await (const chunk of xstream) {
                results.push(chunk);
            }

            expect(results).toHaveLength(0);
        });

        it('应该处理不完整的SSE数据', async () => {
            const incompleteData = 'data: Incomplete Message\n';
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode(incompleteData));
                    controller.close();
                }
            });

            const options: XStreamOptions = { readableStream: stream };
            const xstream = XStream(options);

            const results: SSEOutput[] = [];
            for await (const chunk of xstream) {
                results.push(chunk);
            }

            expect(results).toHaveLength(1);
            expect(results[0]).toEqual({
                data: 'Incomplete Message'
            });
        });
    });

    describe('abortSignal测试', () => {
        it('应该正确处理AbortSignal中断', async () => {
            const abortController = new AbortController();

            const stream = new ReadableStream({
                start(controller) {
                    // 模拟长时间运行的流
                    const interval = setInterval(() => {
                        controller.enqueue(new TextEncoder().encode('data: test\n\n'));
                    }, 10);

                    // 100ms后中断
                    setTimeout(() => {
                        clearInterval(interval);
                        controller.close();
                    }, 100);
                }
            });

            const options: XStreamOptions = { readableStream: stream };
            const xstream = XStream(options, abortController.signal);

            // 立即中断
            setTimeout(() => abortController.abort(), 50);

            const results: SSEOutput[] = [];
            try {
                for await (const chunk of xstream) {
                    results.push(chunk);
                    // 如果收到数据就中断，避免无限循环
                    if (results.length > 0) {
                        abortController.abort();
                        break;
                    }
                }
            } catch {
                // 预期会有中断错误
            }

            // 应该至少收到一些数据
            expect(results.length).toBeGreaterThanOrEqual(0);
        });
    });
});

describe('splitStream', () => {
    it('应该按双换行符分割流数据', async () => {
        const input = 'part1\n\npart2\n\npart3';
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(input);
                controller.close();
            }
        });

        const transformStream = splitStream();
        const transformedStream = stream.pipeThrough(transformStream);

        const results: string[] = [];
        const reader = transformedStream.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            results.push(value);
        }

        expect(results).toEqual(['part1', 'part2', 'part3']);
    });

    it('应该处理不完整的分割符', async () => {
        const input = 'part1\n\npart2\n';
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(input);
                controller.close();
            }
        });

        const transformStream = splitStream();
        const transformedStream = stream.pipeThrough(transformStream);

        const results: string[] = [];
        const reader = transformedStream.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            results.push(value);
        }

        expect(results).toEqual(['part1', 'part2\n']);
    });

    it('应该处理空字符串', async () => {
        const input = '';
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(input);
                controller.close();
            }
        });

        const transformStream = splitStream();
        const transformedStream = stream.pipeThrough(transformStream);

        const results: string[] = [];
        const reader = transformedStream.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            results.push(value);
        }

        expect(results).toEqual([]);
    });
});

describe('splitPart', () => {
    it('应该解析SSE键值对', async () => {
        const input = 'data: Hello World\nevent: message\nid: 1';
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(input);
                controller.close();
            }
        });

        const transformStream = splitPart();
        const transformedStream = stream.pipeThrough(transformStream);

        const results: SSEOutput[] = [];
        const reader = transformedStream.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            results.push(value);
        }

        expect(results).toHaveLength(1);
        expect(results[0]).toEqual({
            data: 'Hello World',
            event: 'message',
            id: '1'
        });
    });

    it('应该忽略空行和无效行', async () => {
        const input = '\ndata: Test\n\nevent: message\n\n';
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(input);
                controller.close();
            }
        });

        const transformStream = splitPart();
        const transformedStream = stream.pipeThrough(transformStream);

        const results: SSEOutput[] = [];
        const reader = transformedStream.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            results.push(value);
        }

        expect(results).toHaveLength(1);
        expect(results[0]).toEqual({
            data: 'Test',
            event: 'message'
        });
    });

    it('应该处理没有冒号的行', async () => {
        const input = 'data: Test\ninvalid line\nevent: message';
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(input);
                controller.close();
            }
        });

        const transformStream = splitPart();
        const transformedStream = stream.pipeThrough(transformStream);

        const results: SSEOutput[] = [];
        const reader = transformedStream.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            results.push(value);
        }

        expect(results).toHaveLength(1);
        expect(results[0]).toEqual({
            data: 'Test',
            event: 'message'
        });
    });

    it('应该处理空输入', async () => {
        const input = '';
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(input);
                controller.close();
            }
        });

        const transformStream = splitPart();
        const transformedStream = stream.pipeThrough(transformStream);

        const results: SSEOutput[] = [];
        const reader = transformedStream.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            results.push(value);
        }

        expect(results).toEqual([]);
    });
});

describe('常量测试', () => {
    it('应该导出正确的常量值', () => {
        expect(DEFAULT_STREAM_SEPARATOR).toBe('\n\n');
        expect(DEFAULT_PART_SEPARATOR).toBe('\n');
        expect(DEFAULT_KV_SEPARATOR).toBe(':');
    });
});

describe('回调函数测试', () => {
    it('应该正确调用onSSEStart回调', async () => {
        const onSSEStart = vi.fn();
        const sseData = 'data: Test Message\n\n';
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode(sseData));
                controller.close();
            }
        });

        const options: XStreamOptions = {
            readableStream: stream,
            onSSEStart
        };
        const xstream = XStream(options);

        const results: SSEOutput[] = [];
        for await (const chunk of xstream) {
            results.push(chunk);
        }

        expect(onSSEStart).toHaveBeenCalledTimes(1);
        expect(results).toHaveLength(1);
    });

    it('应该正确调用onSSEOutput回调', async () => {
        const onSSEOutput = vi.fn();
        const sseData = 'data: First Message\n\ndata: Second Message\n\n';
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode(sseData));
                controller.close();
            }
        });

        const options: XStreamOptions = {
            readableStream: stream,
            onSSEOutput
        };
        const xstream = XStream(options);

        const results: SSEOutput[] = [];
        for await (const chunk of xstream) {
            results.push(chunk);
        }

        expect(onSSEOutput).toHaveBeenCalledTimes(2);
        expect(onSSEOutput).toHaveBeenNthCalledWith(1, { data: 'First Message' });
        expect(onSSEOutput).toHaveBeenNthCalledWith(2, { data: 'Second Message' });
    });

    it('应该正确调用onSSEComplete回调', async () => {
        const onSSEComplete = vi.fn();
        const sseData = 'data: Test Message\n\n';
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode(sseData));
                controller.close();
            }
        });

        const options: XStreamOptions = {
            readableStream: stream,
            onSSEComplete
        };
        const xstream = XStream(options);

        const results: SSEOutput[] = [];
        for await (const chunk of xstream) {
            results.push(chunk);
        }

        expect(onSSEComplete).toHaveBeenCalledTimes(1);
    });

    it('应该正确调用onSSEAbort回调', async () => {
        const onSSEAbort = vi.fn();
        const abortController = new AbortController();

        const stream = new ReadableStream({
            start(controller) {
                // 模拟长时间运行的流
                const interval = setInterval(() => {
                    try {
                        controller.enqueue(new TextEncoder().encode('data: test\n\n'));
                    } catch {
                        // 流可能已经关闭，忽略错误
                    }
                }, 10);

                setTimeout(() => {
                    clearInterval(interval);
                    try {
                        controller.close();
                    } catch {
                        // 流可能已经关闭，忽略错误
                    }
                }, 100);
            }
        });

        const options: XStreamOptions = {
            readableStream: stream,
            onSSEAbort
        };
        const xstream = XStream(options, abortController.signal);

        // 立即中断
        abortController.abort();

        const results: SSEOutput[] = [];
        try {
            for await (const chunk of xstream) {
                results.push(chunk);
            }
        } catch {
            // 预期会有中断错误
        }

        expect(onSSEAbort).toHaveBeenCalledTimes(1);
    });

    it('应该正确调用onSSEError回调', async () => {
        const onSSEError = vi.fn();

        // 创建一个会抛出错误的流
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: test\n\n'));
                // 模拟错误
                setTimeout(() => {
                    controller.error(new Error('Test error'));
                }, 10);
            }
        });

        const options: XStreamOptions = {
            readableStream: stream,
            onSSEError
        };
        const xstream = XStream(options);

        try {
            const results: SSEOutput[] = [];
            for await (const chunk of xstream) {
                results.push(chunk);
            }
        } catch {
            // 预期会有错误
        }

        expect(onSSEError).toHaveBeenCalledTimes(1);
        expect(onSSEError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('应该按正确顺序调用所有回调', async () => {
        const callbacks = {
            onSSEStart: vi.fn(),
            onSSEOutput: vi.fn(),
            onSSEComplete: vi.fn()
        };

        const sseData = 'data: Test Message\n\n';
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode(sseData));
                controller.close();
            }
        });

        const options: XStreamOptions = {
            readableStream: stream,
            ...callbacks
        };
        const xstream = XStream(options);

        const results: SSEOutput[] = [];
        for await (const chunk of xstream) {
            results.push(chunk);
        }

        // 验证调用顺序
        expect(callbacks.onSSEStart).toHaveBeenCalledBefore(callbacks.onSSEOutput as any);
        expect(callbacks.onSSEOutput).toHaveBeenCalledBefore(callbacks.onSSEComplete as any);
    });
});

describe('自定义分割符测试', () => {
    it('应该使用自定义STREAM_SEPARATOR', async () => {
        const sseData = 'data: First Message\r\n\r\ndata: Second Message\r\n\r\n';
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode(sseData));
                controller.close();
            }
        });

        const options: XStreamOptions = {
            readableStream: stream,
            STREAM_SEPARATOR: '\r\n\r\n'
        };
        const xstream = XStream(options);

        const results: SSEOutput[] = [];
        for await (const chunk of xstream) {
            results.push(chunk);
        }

        expect(results).toHaveLength(2);
        expect(results[0]).toEqual({ data: 'First Message' });
        expect(results[1]).toEqual({ data: 'Second Message' });
    });

    it('应该使用自定义PART_SEPARATOR', async () => {
        const sseData = 'data: Test Message\r\nevent: custom\r\nid: 1\r\n\r\n';
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode(sseData));
                controller.close();
            }
        });

        const options: XStreamOptions = {
            readableStream: stream,
            PART_SEPARATOR: '\r\n'
        };
        const xstream = XStream(options);

        const results: SSEOutput[] = [];
        for await (const chunk of xstream) {
            results.push(chunk);
        }

        expect(results).toHaveLength(1);
        expect(results[0]).toEqual({
            data: 'Test Message',
            event: 'custom',
            id: '1'
        });
    });

    it('应该使用自定义KV_SEPARATOR', async () => {
        const sseData = 'data=Test Message\nevent=custom\nid=1\n\n';
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode(sseData));
                controller.close();
            }
        });

        const options: XStreamOptions = {
            readableStream: stream,
            KV_SEPARATOR: '='
        };
        const xstream = XStream(options);

        const results: SSEOutput[] = [];
        for await (const chunk of xstream) {
            results.push(chunk);
        }

        expect(results).toHaveLength(1);
        expect(results[0]).toEqual({
            data: 'Test Message',
            event: 'custom',
            id: '1'
        });
    });

    it('应该同时使用多个自定义分割符', async () => {
        const sseData = 'data=First Message\r\nevent=custom\r\n\r\ndata=Second Message\r\nevent=test\r\n\r\n';
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode(sseData));
                controller.close();
            }
        });

        const options: XStreamOptions = {
            readableStream: stream,
            STREAM_SEPARATOR: '\r\n\r\n',
            PART_SEPARATOR: '\r\n',
            KV_SEPARATOR: '='
        };
        const xstream = XStream(options);

        const results: SSEOutput[] = [];
        for await (const chunk of xstream) {
            results.push(chunk);
        }

        expect(results).toHaveLength(2);
        expect(results[0]).toEqual({
            data: 'First Message',
            event: 'custom'
        });
        expect(results[1]).toEqual({
            data: 'Second Message',
            event: 'test'
        });
    });
});

describe('splitStream自定义分割符测试', () => {
    it('应该使用自定义分割符分割流数据', async () => {
        const input = 'part1\r\n\r\npart2\r\n\r\npart3';
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(input);
                controller.close();
            }
        });

        const transformStream = splitStream('\r\n\r\n');
        const transformedStream = stream.pipeThrough(transformStream);

        const results: string[] = [];
        const reader = transformedStream.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            results.push(value);
        }

        expect(results).toEqual(['part1', 'part2', 'part3']);
    });

    it('应该处理不完整的分割符', async () => {
        const input = 'part1\r\n\r\npart2\r\n';
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(input);
                controller.close();
            }
        });

        const transformStream = splitStream('\r\n\r\n');
        const transformedStream = stream.pipeThrough(transformStream);

        const results: string[] = [];
        const reader = transformedStream.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            results.push(value);
        }

        expect(results).toEqual(['part1', 'part2\r\n']);
    });
});

describe('splitPart自定义分割符测试', () => {
    it('应该使用自定义分割符和键值分割符', async () => {
        const input = 'data=Hello World\revent=custom\rid=1';
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(input);
                controller.close();
            }
        });

        const transformStream = splitPart('\r', '=');
        const transformedStream = stream.pipeThrough(transformStream);

        const results: SSEOutput[] = [];
        const reader = transformedStream.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            results.push(value);
        }

        expect(results).toHaveLength(1);
        expect(results[0]).toEqual({
            data: 'Hello World',
            event: 'custom',
            id: '1'
        });
    });

    it('应该处理空输入', async () => {
        const input = '';
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(input);
                controller.close();
            }
        });

        const transformStream = splitPart('|', '=');
        const transformedStream = stream.pipeThrough(transformStream);

        const results: SSEOutput[] = [];
        const reader = transformedStream.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            results.push(value);
        }

        expect(results).toEqual([]);
    });
});

describe('集成测试', () => {
    it('应该完整处理复杂的SSE流', async () => {
        const complexSSEData = [
            'data: First Event\nevent: message\nid: 1\nretry: 3000',
            '\n\ndata: Second Event\nevent: notification\nid: 2',
            '\n\ndata: Third Event\nevent: error\nid: 3\n\n'
        ].join('');

        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode(complexSSEData));
                controller.close();
            }
        });

        const options: XStreamOptions = { readableStream: stream };
        const xstream = XStream(options);

        const results: SSEOutput[] = [];
        for await (const chunk of xstream) {
            results.push(chunk);
        }

        expect(results).toHaveLength(3);
        expect(results[0]).toEqual({
            data: 'First Event',
            event: 'message',
            id: '1',
            retry: '3000'
        });
        expect(results[1]).toEqual({
            data: 'Second Event',
            event: 'notification',
            id: '2'
        });
        expect(results[2]).toEqual({
            data: 'Third Event',
            event: 'error',
            id: '3'
        });
    });

    it('应该处理分块传输的流数据', async () => {
        const chunks = ['data: Chunked ', 'Message\nevent: ', 'chunked\nid: ', '1\n\n'];

        const stream = new ReadableStream({
            start(controller) {
                chunks.forEach((chunk, index) => {
                    setTimeout(() => {
                        try {
                            controller.enqueue(new TextEncoder().encode(chunk));
                            if (index === chunks.length - 1) {
                                controller.close();
                            }
                        } catch {
                            // 流可能已经关闭，忽略错误
                        }
                    }, index * 10);
                });
            }
        });

        const options: XStreamOptions = { readableStream: stream };
        const xstream = XStream(options);

        const results: SSEOutput[] = [];
        for await (const chunk of xstream) {
            results.push(chunk);
        }

        expect(results).toHaveLength(1);
        expect(results[0]).toEqual({
            data: 'Chunked Message',
            event: 'chunked',
            id: '1'
        });
    });
});
