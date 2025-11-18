# XStream

一个强大的流数据处理库，专门用于解析和处理 Server-Sent Events (SSE) 格式数据，支持自定义分割符、异步迭代和事件回调。

## ✨ 特性

- 🚀 **高性能流处理** - 基于 Web Streams API 构建，支持大文件流式处理
- 📡 **SSE 格式支持** - 原生支持 Server-Sent Events 格式解析
- 🔧 **高度可配置** - 支持自定义分割符、键值分隔符等
- 🔄 **异步迭代器** - 支持 `for await` 循环和异步迭代
- 🛑 **中断控制** - 支持 AbortSignal 中断流处理
- 📊 **事件回调** - 提供完整的生命周期事件回调
- 🎯 **TypeScript 支持** - 完整的类型定义和泛型支持
- 🌐 **浏览器兼容** - 支持现代浏览器和 Node.js 环境

## 📦 安装

```bash
npm install @janone/xstream
# 或
pnpm add @janone/xstream
# 或
yarn add @janone/xstream
```

## 🚀 快速开始

### 基础用法

```typescript
import { XStream } from '@janone/xstream';

// 从 fetch 响应创建流
const response = await fetch('/api/events');
const stream = XStream({
    readableStream: response.body!,
    onSSEOutput: data => console.log('收到数据:', data),
    onSSEComplete: () => console.log('流处理完成')
});

// 使用异步迭代器处理数据
for await (const event of stream) {
    console.log('事件数据:', event.data);
    console.log('事件类型:', event.event);
    console.log('事件ID:', event.id);
}
```

### 处理标准 SSE 格式

```typescript
import { XStream } from '@janone/xstream';

const stream = XStream({
    readableStream: response.body!,
    onSSEOutput: data => {
        // 处理不同类型的 SSE 事件
        switch (data.event) {
            case 'message':
                console.log('消息:', data.data);
                break;
            case 'notification':
                showNotification(data.data);
                break;
            case 'error':
                console.error('服务器错误:', data.data);
                break;
        }
    }
});

for await (const event of stream) {
    // 实时处理每个事件
    handleSSEEvent(event);
}
```

## 🔧 高级配置

### 自定义分割符

```typescript
import { XStream } from '@janone/xstream';

// 处理非标准 SSE 格式（如使用 CRLF 和等号分隔）
const stream = XStream({
    readableStream: response.body!,
    STREAM_SEPARATOR: '\r\n\r\n', // 使用 CRLF 作为流分割符
    PART_SEPARATOR: '\r\n', // 使用 CRLF 作为行分割符
    KV_SEPARATOR: '=' // 使用等号作为键值分割符
});

for await (const event of stream) {
    console.log('解析的事件:', event);
}
```

### 使用自定义 TransformStream

```typescript
import { XStream } from '@janone/xstream';

// 创建 JSON 解析转换流
const jsonTransform = new TransformStream({
    transform(chunk, controller) {
        try {
            const parsed = JSON.parse(chunk);
            controller.enqueue(parsed);
        } catch (error) {
            controller.error(error);
        }
    }
});

const stream = XStream({
    readableStream: response.body!,
    transformStream: jsonTransform,
    onSSEOutput: data => console.log('解析的JSON:', data)
});

for await (const jsonData of stream) {
    console.log('JSON数据:', jsonData);
}
```

### 中断控制

```typescript
import { XStream } from '@janone/xstream';

const abortController = new AbortController();

const stream = XStream(
    {
        readableStream: response.body!,
        onSSEAbort: () => console.log('流被中断'),
        onSSEStart: () => console.log('开始处理流')
    },
    abortController.signal
);

// 5秒后中断流
setTimeout(() => abortController.abort(), 5000);

try {
    for await (const event of stream) {
        console.log('事件:', event);
    }
} catch (error) {
    console.log('流处理被中断');
}
```

## 📚 API 参考

### XStream

主要的流处理函数，用于创建可异步迭代的流。

```typescript
function XStream<Output = SSEOutput>(options: XStreamOptions<Output>, signal?: AbortSignal): XReadableStream<Output>;
```

#### 参数

- `options`: 配置选项对象
- `signal`: 可选的 AbortSignal，用于中断流处理

#### 返回值

返回一个 `XReadableStream<Output>` 对象，支持异步迭代。

### XStreamOptions

配置选项接口。

```typescript
interface XStreamOptions<Output = SSEOutput> {
    // 必需参数
    readableStream: ReadableStream<Uint8Array>;

    // 可选参数
    transformStream?: TransformStream<string, Output>;
    onSSEOutput?: (output: Output) => void;
    onSSEError?: (error: Error) => void;
    onSSEComplete?: () => void;
    onSSEAbort?: () => void;
    onSSEStart?: () => void;
    STREAM_SEPARATOR?: string; // 默认: '\n\n'
    PART_SEPARATOR?: string; // 默认: '\n'
    KV_SEPARATOR?: string; // 默认: ':'
}
```

### 事件回调

- `onSSEStart`: 开始处理流时调用
- `onSSEOutput`: 每次处理完数据时调用
- `onSSEError`: 发生错误时调用
- `onSSEComplete`: 流处理完成时调用
- `onSSEAbort`: 流被中断时调用

### 工具函数

#### splitStream

将流按指定分割符分割成多个部分。

```typescript
function splitStream(separator?: string): TransformStream<string, string>;
```

#### splitPart

解析 SSE 格式数据，将文本按行分割并解析为键值对对象。

```typescript
function splitPart(separator?: string, kvSeparator?: string): TransformStream<string, SSEOutput>;
```

## 🎯 使用场景

- **实时数据流处理** - 处理服务器推送的实时数据
- **SSE 客户端** - 构建 Server-Sent Events 客户端
- **日志流解析** - 解析和处理日志流数据
- **API 响应处理** - 处理流式 API 响应
- **数据转换管道** - 构建复杂的数据转换管道

## 🔍 类型定义

### SSEOutput

```typescript
type SSEOutput = Partial<Record<SSEFields, any>>;

type SSEFields = 'data' | 'event' | 'id' | 'retry';
```

### XReadableStream

```typescript
type XReadableStream<R = SSEOutput> = ReadableStream<R> & {
    [Symbol.asyncIterator]: () => AsyncGenerator<R>;
    reader?: ReadableStreamDefaultReader<R>;
};
```

## 🛠️ 开发

```bash
# 安装依赖
pnpm install

# 运行测试
pnpm test

# 运行测试并生成覆盖率报告
pnpm test:coverage

# 代码格式化
pnpm format

# 代码检查
pnpm lint

# 构建
pnpm build
```

## 📄 许可证

ISC

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📝 更新日志

### v1.0.0

- 🎉 初始版本发布
- ✨ 支持 SSE 格式解析
- ✨ 支持自定义分割符
- ✨ 支持异步迭代器
- ✨ 支持中断控制
- ✨ 完整的事件回调系统
- ✨ TypeScript 支持
