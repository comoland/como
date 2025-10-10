export const Child2 = async () => {
    return new Promise((resolve, reject) => {
        reject({ msg: 'error from child 2'})
    })
}
