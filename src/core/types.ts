/**
 * SSE字段类型，包含标准的Server-Sent Events字段
 */
export type SSEFields = 'data' | 'event' | 'id' | 'retry';

/**
 * SSE输出对象类型，包含可选的SSE字段
 * @example
 * ```typescript
 * const sseEvent: SSEOutput = {
 *   data: 'Hello World',
 *   event: 'message',
 *   id: '1',
 *   retry: '3000'
 * };
 * ```
 */
export type SSEOutput = Partial<Record<SSEFields, any>>;

/**
 * XStream配置选项接口
 * @template Output 输出数据类型，默认为SSEOutput
 *
 * @example
 * ```typescript
 * const options: XStreamOptions = {
 *   readableStream: response.body!,
 *   onSSEOutput: (data) => console.log(data),
 *   onSSEComplete: () => console.log('完成'),
 *   STREAM_SEPARATOR: '\n\n'
 * };
 * ```
 */
export interface XStreamOptions<Output = SSEOutput> {
    /**
     * @description 可读流，必须是ReadableStream<Uint8Array>实例
     * @example
     * ```typescript
     * readableStream: response.body!
     * ```
     */
    readableStream: ReadableStream<Uint8Array<ArrayBuffer>>;

    /**
     * @description 可选的转换流，用于自定义数据转换
     * @example
     * ```typescript
     * transformStream: new TransformStream({
     *   transform(chunk, controller) {
     *     controller.enqueue(JSON.parse(chunk));
     *   }
     * })
     * ```
     */
    transformStream?: TransformStream<string, Output>;

    /**
     * @description 输出回调，每次处理完数据时调用
     * @param output 处理后的数据
     * @example
     * ```typescript
     * onSSEOutput: (data) => {
     *   console.log('收到数据:', data);
     *   updateUI(data);
     * }
     * ```
     */
    onSSEOutput?: (output: Output) => void;

    /**
     * @description 错误回调，发生错误时调用
     * @param error 错误对象
     * @example
     * ```typescript
     * onSSEError: (error) => {
     *   console.error('处理错误:', error);
     *   showErrorMessage(error.message);
     * }
     * ```
     */
    onSSEError?: (error: Error) => void;

    /**
     * @description 完成回调，流处理完成时调用
     * @example
     * ```typescript
     * onSSEComplete: () => {
     *   console.log('流处理完成');
     *   hideLoadingIndicator();
     * }
     * ```
     */
    onSSEComplete?: () => void;

    /**
     * @description 中断回调，流被中断时调用
     * @example
     * ```typescript
     * onSSEAbort: () => {
     *   console.log('流被中断');
     *   showAbortMessage();
     * }
     * ```
     */
    onSSEAbort?: () => void;

    /**
     * @description 开始回调，开始处理流时调用
     * @example
     * ```typescript
     * onSSEStart: () => {
     *   console.log('开始处理流');
     *   showLoadingIndicator();
     * }
     * ```
     */
    onSSEStart?: () => void;

    /**
     * @description 流分割符，用于分割不同的SSE事件，默认为'\n\n'
     * @example
     * ```typescript
     * STREAM_SEPARATOR: '\r\n\r\n'  // 使用CRLF分割
     * ```
     */
    STREAM_SEPARATOR?: string;

    /**
     * @description 部分分割符，用于分割SSE事件的字段，默认为'\n'
     * @example
     * ```typescript
     * PART_SEPARATOR: '\r\n'  // 使用CRLF分割字段
     * ```
     */
    PART_SEPARATOR?: string;

    /**
     * @description 键值分割符，用于分割SSE字段的键和值，默认为':'
     * @example
     * ```typescript
     * KV_SEPARATOR: '='  // 使用等号分割键值
     * ```
     */
    KV_SEPARATOR?: string;
}

/**
 * 扩展的可读流类型，支持异步迭代
 * @template R 流数据类型，默认为SSEOutput
 *
 * @example
 * ```typescript
 * const stream: XReadableStream = XStream(options);
 *
 * // 使用for await循环
 * for await (const event of stream) {
 *   console.log(event);
 * }
 *
 * // 使用异步迭代器
 * const iterator = stream[Symbol.asyncIterator]();
 * const result = await iterator.next();
 * ```
 */
export type XReadableStream<R = SSEOutput> = ReadableStream<R> & {
    /**
     * 异步迭代器，支持for await循环
     */
    [Symbol.asyncIterator]: () => AsyncGenerator<R>;

    /**
     * 可选的流读取器引用
     */
    reader?: ReadableStreamDefaultReader<R>;
};
