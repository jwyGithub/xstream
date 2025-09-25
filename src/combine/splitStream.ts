import { DEFAULT_STREAM_SEPARATOR } from '../const';

/**
 * @description 分割流，将流按指定分割符分割成多个部分
 * @param {string} [separator='\n\n'] 分割符，默认为双换行符
 * @returns {TransformStream<string, string>} 返回分割后的流
 * 
 * @example
 * // 基础用法：按双换行符分割SSE流
 * ```typescript
 * const input = 'data: message1\n\ndata: message2\n\n';
 * const stream = new ReadableStream({
 *   start(controller) {
 *     controller.enqueue(input);
 *     controller.close();
 *   }
 * });
 * 
 * const splitStream = splitStream();
 * const result = stream.pipeThrough(splitStream);
 * 
 * const reader = result.getReader();
 * while (true) {
 *   const { done, value } = await reader.read();
 *   if (done) break;
 *   console.log('分割的部分:', value); // 'data: message1', 'data: message2'
 * }
 * ```
 * 
 * @example
 * // 自定义分割符：按CRLF分割
 * ```typescript
 * const input = 'part1\r\n\r\npart2\r\n\r\npart3';
 * const stream = new ReadableStream({
 *   start(controller) {
 *     controller.enqueue(input);
 *     controller.close();
 *   }
 * });
 * 
 * const splitStream = splitStream('\r\n\r\n');
 * const result = stream.pipeThrough(splitStream);
 * 
 * const reader = result.getReader();
 * while (true) {
 *   const { done, value } = await reader.read();
 *   if (done) break;
 *   console.log('分割的部分:', value); // 'part1', 'part2', 'part3'
 * }
 * ```
 */
export function splitStream(separator: string = DEFAULT_STREAM_SEPARATOR): TransformStream<string, string> {
    let buffer = '';

    return new TransformStream<string, string>({
        transform(chunk, controller) {
            buffer += chunk;
            const parts = buffer.split(separator);
            parts.slice(0, -1).forEach(part => {
                if ((part ?? '').trim() !== '') controller.enqueue(part);
            });
            buffer = parts[parts.length - 1];
        },
        flush(controller) {
            if ((buffer ?? '').trim() !== '') controller.enqueue(buffer);
        }
    });
}
