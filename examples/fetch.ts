fetch("http://google.com", {
    method: "GET",
    // body: 'hello body',
    headers: {
        // "X-Vault-Token": "s.MYY5rhBNkx6gwHijnvNRjnu3",
    },
    redirect: "follow"
}).then(async (res) => {
    console.log("headers are ===> ", res.headers)
    console.log(res.statusText)
    // console.log(await res.arrayBuffer())
    // console.log(await res.json())
    console.log(await res.text())
}).catch(err => {
    console.log("error xxxxxx", err)
})
