(async function (){
    // new Request()
    const res = await fetch('https://jsonplaceholder.typicode.com/todos/1');
    res.headers
    const json = await res.json()
    // console.log(body)
    // console.log('user id ===> ', body.userId);
})();
