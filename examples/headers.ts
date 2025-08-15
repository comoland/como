// // const h = new Headers()

// // h.set("X-CODE", "hello")

// // var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']
// // function normalizeMethod(method) {
// //     var upcased = method.toUpperCase()
// //     return (methods.indexOf(upcased) > -1) ? upcased : method
// // }

// // function Request(url, options) {
// //     options = options || {}
// //     this.url = url

// //     this.credentials = options.credentials || 'omit'
// //     this.headers = new Headers(options.headers)
// //     this.method = normalizeMethod(options.method || 'GET')
// //     this.mode = options.mode || null
// //     this.referrer = null

// //     if ((this.method === 'GET' || this.method === 'HEAD') && options.body) {
// //       throw new TypeError('Body not allowed for GET or HEAD requests')
// //     }
// // }

// export function createOAuth2Request(endpoint: string, body: URLSearchParams): Request {
// 	// const bodyBytes = new TextEncoder().encode(body.toString());
// 	const request = new Request(endpoint, {
// 		method: "POST",
// 		body: body
// 	});

// 	request.headers.set("Content-Type", "application/x-www-form-urlencoded");
// 	request.headers.set("Accept", "application/json");
// 	// Required by GitHub, and probably by others as well
// 	request.headers.set("User-Agent", "arctic");
// 	// Required by Reddit
// 	// request.headers.set("Content-Length", bodyBytes.byteLength.toString());
// 	return request;
// }



// const bb = new URLSearchParams()
// bb.set("xxxxxxx", "666666666")
// bb.set("hhhhh", "878")

// const req = createOAuth2Request("http://localhost:8080", bb)
// console.log(req)

// const res = await fetch(req)
// console.log(res)
// // const toAsync =(myArray: any) =>  {
// //     const fn = function() {
// //         let index = 0;
// //         return {
// //           async next() {
// //             if (index < myArray.length) {
// //               // Simulate an asynchronous operation (e.g., fetching data)
// //             //   await new Promise(resolve => setTimeout(resolve, 100));
// //               return { value: myArray[index++], done: false };
// //             } else {
// //               return { done: true };
// //             }
// //           }
// //         };
// //     }

// //     return {
// //         toArray: () => myArray,
// //         [Symbol.asyncIterator]: fn
// //     }
// // };

// // for await (const i of h.values()) {
// // console.log(i)
// // }

// // console.log(toAsync(h.values()).toArray())


const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", "ssss");
  url.searchParams.set("redirect_uri", "sASASAss");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "login");
  url.searchParams.set("access_type", "offline");

  console.log(url.toString())


  const random = crypto.randomUUID()
  console.log(random)