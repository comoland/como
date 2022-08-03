

export default () => {
    const start = Date.now();

    return () => {
        const end = Date.now();
        console.log('ended in ===> ', end - start);
    }
}
