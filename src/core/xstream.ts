import type { SSEOutput, XReadableStream, XStreamOptions } from './types';
import { splitPart } from '../combine/splitPart';
import { splitStream } from '../combine/splitStream';
import { DEFAULT_KV_SEPARATOR, DEFAULT_PART_SEPARATOR, DEFAULT_STREAM_SEPARATOR } from '../const';

/**
 * @description 处理流数据，支持SSE格式解析和自定义转换
 * @template Output 输出数据类型，默认为SSEOutput
 * @param {XStreamOptions<Output>} options 配置选项
 * @param {AbortSignal} [signal] 可选的中断信号
 * @returns {XReadableStream<Output>} 处理后的可读流，支持异步迭代
 *
 * @example
 * // 基础SSE流处理
 * ```typescript
 * const response = await fetch('/api/events');
 * const stream = XStream({
 *   readableStream: response.body!,
 *   onSSEOutput: (data) => console.log('收到数据:', data),
 *   onSSEComplete: () => console.log('流处理完成'),
 *   onSSEError: (error) => console.error('处理错误:', error)
 * });
 *
 * for await (const event of stream) {
 *   console.log('事件:', event.data);
 * }
 * ```
 *
 * @example
 * // 使用自定义分割符处理非标准SSE格式
 * ```typescript
 * const stream = XStream({
 *   readableStream: response.body!,
 *   STREAM_SEPARATOR: '\r\n\r\n',  // 使用CRLF作为流分割符
 *   PART_SEPARATOR: '\r\n',        // 使用CRLF作为行分割符
 *   KV_SEPARATOR: '='              // 使用等号作为键值分割符
 * });
 *
 * for await (const event of stream) {
 *   console.log('解析的事件:', event);
 * }
 * ```
 *
 * @example
 * // 使用自定义TransformStream进行数据转换
 * ```typescript
 * const jsonTransform = new TransformStream({
 *   transform(chunk, controller) {
 *     try {
 *       const parsed = JSON.parse(chunk);
 *       controller.enqueue(parsed);
 *     } catch (error) {
 *       controller.error(error);
 *     }
 *   }
 * });
 *
 * const stream = XStream({
 *   readableStream: response.body!,
 *   transformStream: jsonTransform,
 *   onSSEOutput: (data) => console.log('解析的JSON:', data)
 * });
 *
 * for await (const jsonData of stream) {
 *   console.log('JSON数据:', jsonData);
 * }
 * ```
 *
 * @example
 * // 使用AbortSignal中断流处理
 * ```typescript
 * const abortController = new AbortController();
 *
 * const stream = XStream({
 *   readableStream: response.body!,
 *   onSSEAbort: () => console.log('流被中断'),
 *   onSSEStart: () => console.log('开始处理流')
 * }, abortController.signal);
 *
 * // 5秒后中断流
 * setTimeout(() => abortController.abort(), 5000);
 *
 * try {
 *   for await (const event of stream) {
 *     console.log('事件:', event);
 *   }
 * } catch (error) {
 *   console.log('流处理被中断');
 * }
 * ```
 *
 * @example
 * // 处理分块传输的流数据
 * ```typescript
 * const stream = XStream({
 *   readableStream: response.body!,
 *   onSSEOutput: (data) => {
 *     // 实时处理每个SSE事件
 *     if (data.event === 'message') {
 *       console.log('消息:', data.data);
 *     } else if (data.event === 'error') {
 *       console.error('服务器错误:', data.data);
 *     }
 *   }
 * });
 *
 * for await (const event of stream) {
 *   // 处理完整的事件对象
 *   switch (event.event) {
 *     case 'message':
 *       handleMessage(event.data);
 *       break;
 *     case 'notification':
 *       showNotification(event.data);
 *       break;
 *   }
 * }
 * ```
 */
export function XStream<Output = SSEOutput>(options: XStreamOptions<Output>, signal?: AbortSignal): XReadableStream<Output> {
    const {
        readableStream,
        transformStream,
        onSSEOutput,
        onSSEError,
        onSSEComplete,
        onSSEAbort,
        onSSEStart,
        STREAM_SEPARATOR = DEFAULT_STREAM_SEPARATOR,
        PART_SEPARATOR = DEFAULT_PART_SEPARATOR,
        KV_SEPARATOR = DEFAULT_KV_SEPARATOR
    } = options;
    if (!(readableStream instanceof ReadableStream)) {
        throw new TypeError('options.readableStream 必须是 ReadableStream 的实例。');
    }

    const decoderStream = new TextDecoderStream();
    const processedStream = transformStream
        ? readableStream.pipeThrough(decoderStream).pipeThrough(transformStream)
        : (readableStream
              .pipeThrough(decoderStream)
              .pipeThrough(splitStream(STREAM_SEPARATOR))
              .pipeThrough(splitPart(PART_SEPARATOR, KV_SEPARATOR)) as XReadableStream<Output>);

    // 为流添加异步迭代器并处理中断信号
    (processedStream as XReadableStream<Output>)[Symbol.asyncIterator] = async function* (): AsyncGenerator<Output, undefined, unknown> {
        const reader = this.getReader();
        (this as XReadableStream<Output>).reader = reader;
        try {
            onSSEStart?.();
            while (true) {
                if (signal?.aborted) {
                    await reader.cancel();
                    onSSEAbort?.();
                    break;
                }
                const { done, value } = await reader.read();
                if (done) {
                    onSSEComplete?.();
                    break;
                }
                if (value) {
                    onSSEOutput?.(value);
                    yield value;
                }
            }
        } catch (error) {
            onSSEError?.(error as Error);
        } finally {
            reader.releaseLock();
        }
    };

    return processedStream as XReadableStream<Output>;
}
