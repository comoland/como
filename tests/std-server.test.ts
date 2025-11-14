import { describe, expect } from './runner';
// @ts-ignore Como runtime module
import { createServer, ServerRequest, ServerResponse } from 'std:server';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('std:server', async ({ test }) => {
    test('handles basic request/response lifecycle', async () => {
        const messages: string[] = [];
        const server = createServer({ address: '127.0.0.1:0' }, async (req: ServerRequest, res: ServerResponse) => {
            messages.push(`${req.method} ${req.path}`);
            const body = await req.text();
            messages.push(body);
            res.setHeader('content-type', 'text/plain');
            res.status(201);
            await res.end(`echo:${body}`);
        });

        await server.listen();

        const url = `http://${server.address}/hello`;
        const response = await fetch(url, {
            method: 'POST',
            body: 'como',
        });

        expect(response.status).toBe(201);
        expect(await response.text()).toBe('echo:como');
        expect(messages).toMatchObject(['POST /hello', 'como']);

        await server.close();
    });

    test('supports streaming response chunks', async () => {
        const server = createServer({ address: '127.0.0.1:0' }, async (_req: ServerRequest, res: ServerResponse) => {
            res.setHeader('content-type', 'text/plain');
            await res.write('part-1');
            await sleep(10);
            await res.write('-part-2');
            await res.end('-done');
        });

        await server.listen();

        const response = await fetch(`http://${server.address}/stream`);
        expect(response.status).toBe(200);
        expect(await response.text()).toBe('part-1-part-2-done');

        await server.close();
    });
});
