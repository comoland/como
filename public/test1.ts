import { test } from './sub/test'

console.log({ test });

Como.path.walkFS('./public/sub', (path, { isDir, name }) => {
    console.log(path,  { isDir, name })
})
