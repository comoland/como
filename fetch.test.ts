import { suite, assert } from './mod';
import { createServer } from 'http';

const test = suite('fetch');

test.only('fetch requests', async () => {
    // Create a test server
    const server = createServer((req, res) => {
        switch (req.url) {
            case '/test':
                // res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ message: 'test response' }));
                break;
            case '/redirect':
                res.writeHead(302, { Location: '/test' });
                res.end();
                break;
            case '/error':
                res.writeHead(500);
                res.end('error response');
                break;
            case '/timeout':
                setTimeout(() => {
                    res.end('timeout response');
                }, 2000);
                break;
            default:
                res.writeHead(404);
                res.end();
        }
    });

    await new Promise<void>((resolve) => {
        server.listen(8080, () => {
            resolve();
        });
    });

    const port = 8080;
    const baseUrl = `http://localhost:${port}`;

    try {
        // Test GET request
        const getResponse = await fetch(`${baseUrl}/test`, { method: 'GET' });
        const getData = await getResponse.json();
        assert.equal(getData, { message: 'test response' });

        // Test POST request
        const postResponse = await fetch(`${baseUrl}/test`, {
            method: 'POST',
            body: 'test body'
        });
        const postData = await postResponse.json();
        assert.equal(postData, { message: 'test response' });

        // Test redirect
        const redirectResponse = await fetch(`${baseUrl}/redirect`, {
            redirect: 'follow'
        });
        const redirectData = await redirectResponse.json();
        assert.equal(redirectData, { message: 'test response' });

        // Test error response
        const errorResponse = await fetch(`${baseUrl}/error`, { method: 'GET' });
        const errorText = await errorResponse.text();
        assert.equal(errorText, 'error response');

        // Test timeout
        const timeoutResponse = await fetch(`${baseUrl}/timeout`, { method: 'GET' });
        const timeoutText = await timeoutResponse.text();
        assert.equal(timeoutText, 'timeout response');
    } catch(e) {
        console.log(e)
    } finally {
        // server.close();
    }
});

test('headers', async () => {
    const headers = new Headers({
        'Content-Type': 'application/json',
        'X-Custom': 'value'
    });

    headers.append('X-Custom', 'value2');
    headers.set('X-New', 'new-value');

    assert.ok(headers.has('Content-Type'));
    assert.equal(headers.get('Content-Type'), 'application/json');
    assert.equal(headers.get('X-Custom'), 'value, value2');
    assert.equal(headers.get('X-New'), 'new-value');
});

test('form data', async () => {
    const formData = new FormData();
    formData.append('text', 'value');
    formData.append('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'text/plain' }));
});

test.run()