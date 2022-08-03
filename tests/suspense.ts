console.log('before suspense');

Como.process.suspense((done) => {
    setTimeout(() => {
        console.log('suspense')
        done()
    }, 1000);

})

console.log('after suspense')
console.log('before');

Como.process.suspense((done) => {
    setTimeout(() => {
        console.log('suspense')
        done()
    }, 1000);
})

console.log('after')
