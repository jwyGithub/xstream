/* eslint-disable no-console */
import type { SSEOutput } from '../src';
import { XStream } from '../src';

function isJson(v: string) {
    try {
        JSON.parse(v);
        return true;
    } catch {
        return false;
    }
}

let d = '';

function onSSEOutput(output: SSEOutput) {
    console.log('onSSEOutput', output);
}

function onSSEError(error: Error) {
    console.log('onSSEError', error);
}

function onSSEComplete() {
    console.log('onSSEComplete');
}

function onSSEAbort() {
    console.log('onSSEAbort');
}

function onSSEStart() {
    console.log('onSSEStart');
}

const abort = new AbortController();

async function start() {
    try {
        const response = await fetch('https://testsse.element-ui-x.com/api/sse', {
            headers: new Headers({
                'Content-Type': 'text/event-stream'
            })
        });
        const readableStream = response.body!;
        const currentStream = XStream<SSEOutput>(
            {
                readableStream,
                onSSEOutput,
                onSSEError,
                onSSEComplete,
                onSSEAbort,
                onSSEStart
            },
            abort.signal
        );

        for await (const item of currentStream) {
            if (item.data && isJson(item.data)) {
                const jsonData = JSON.parse(item.data);
                d += jsonData.content;
            }
        }
        console.log('Final content:', d);
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

start();

setTimeout(() => {
    abort.abort();
}, 1000);
