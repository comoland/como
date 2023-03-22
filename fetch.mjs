import fetch from 'node-fetch'

fetch("http://google.com", {
    method: "GET",
    redirect: "follow"
}).then(async (res) => {
    // res.arrayBuffer()
    console.log(res.headers)
    // console.log(await res.text())
    // console.log(await res.arrayBuffer())
}).catch(err => {
    console.log("error xxxxxx", err)
})

