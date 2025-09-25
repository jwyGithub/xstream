import type { SSEOutput } from '../core/types';
import { DEFAULT_KV_SEPARATOR, DEFAULT_PART_SEPARATOR } from '../const';

/**
 * @description 解析SSE格式数据，将文本按行分割并解析为键值对对象
 * @param {string} [separator='\n'] 行分割符，默认为换行符
 * @param {string} [kvSeparator=':'] 键值分割符，默认为冒号
 * @returns {TransformStream<string, SSEOutput>} 返回解析后的SSE事件对象流
 * 
 * @example
 * // 基础用法：解析标准SSE格式
 * ```typescript
 * const input = 'data: Hello World\nevent: message\nid: 1';
 * const stream = new ReadableStream({
 *   start(controller) {
 *     controller.enqueue(input);
 *     controller.close();
 *   }
 * });
 * 
 * const splitPart = splitPart();
 * const result = stream.pipeThrough(splitPart);
 * 
 * const reader = result.getReader();
 * while (true) {
 *   const { done, value } = await reader.read();
 *   if (done) break;
 *   console.log('解析的事件:', value);
 *   // 输出: { data: 'Hello World', event: 'message', id: '1' }
 * }
 * ```
 * 
 * @example
 * // 自定义分割符：解析等号分隔的格式
 * ```typescript
 * const input = 'data=Test Message\nevent=custom\nid=123';
 * const stream = new ReadableStream({
 *   start(controller) {
 *     controller.enqueue(input);
 *     controller.close();
 *   }
 * });
 * 
 * const splitPart = splitPart('\n', '=');
 * const result = stream.pipeThrough(splitPart);
 * 
 * const reader = result.getReader();
 * while (true) {
 *   const { done, value } = await reader.read();
 *   if (done) break;
 *   console.log('解析的事件:', value);
 *   // 输出: { data: 'Test Message', event: 'custom', id: '123' }
 * }
 * ```
 * 
 * @example
 * // 处理不完整的SSE数据
 * ```typescript
 * const input = 'data: Incomplete Message\n';
 * const stream = new ReadableStream({
 *   start(controller) {
 *     controller.enqueue(input);
 *     controller.close();
 *   }
 * });
 * 
 * const splitPart = splitPart();
 * const result = stream.pipeThrough(splitPart);
 * 
 * const reader = result.getReader();
 * while (true) {
 *   const { done, value } = await reader.read();
 *   if (done) break;
 *   console.log('解析的事件:', value);
 *   // 输出: { data: 'Incomplete Message' }
 * }
 * ```
 * 
 * @example
 * // 忽略无效行和空行
 * ```typescript
 * const input = '\ndata: Valid Message\n\nevent: test\n\n';
 * const stream = new ReadableStream({
 *   start(controller) {
 *     controller.enqueue(input);
 *     controller.close();
 *   }
 * });
 * 
 * const splitPart = splitPart();
 * const result = stream.pipeThrough(splitPart);
 * 
 * const reader = result.getReader();
 * while (true) {
 *   const { done, value } = await reader.read();
 *   if (done) break;
 *   console.log('解析的事件:', value);
 *   // 输出: { data: 'Valid Message', event: 'test' }
 * }
 * ```
 */
export function splitPart(
    separator: string = DEFAULT_PART_SEPARATOR,
    kvSeparator: string = DEFAULT_KV_SEPARATOR
): TransformStream<string, SSEOutput> {
    return new TransformStream<string, SSEOutput>({
        transform(partChunk, controller) {
            const lines = partChunk.split(separator);
            const sseEvent = lines.reduce<SSEOutput>((acc, line) => {
                const sepIndex = line.indexOf(kvSeparator);
                if (sepIndex === -1) return acc;

                const key = line.slice(0, sepIndex);
                if ((key ?? '').trim() === '') return acc;

                const value = line.slice(sepIndex + 1).trim();
                return { ...acc, [key]: value };
            }, {});

            if (Object.keys(sseEvent).length > 0) controller.enqueue(sseEvent);
        }
    });
}
