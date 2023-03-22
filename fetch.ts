
var vv = JSON.parse(`{"request_id":"5da382f8-5cba-9908-9821-30009553e183","lease_id":"","renewable":false,"lease_duration":2764800,"data":{"password":"veguita99","username":"imq"},"wrap_info":null,"warnings":null,"auth":null}
`)



fetch("http://google.com", {
    method: "GET",
    // body: 'hello body',
    headers: {
        // X-Vault-Token: s.MYY5rhBNkx6gwHijnvNRjnu3
        "X-Vault-Token": "s.MYY5rhBNkx6gwHijnvNRjnu3",
    },
    redirect: "follow"
}).then(async (res) => {
    // res.arrayBuffer()
    console.log("headers are ===> ", res.headers)
    // console.log(await res.text())
    // console.log(await res.json())
    console.log(res.statusText)
    // console.log(await res.text())
}).catch(err => {
    console.log("error xxxxxx", err)
})
