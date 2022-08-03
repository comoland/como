// import * as e from './tests/reflect'
// import * as e2 from './tests/reflect'
import path from './path';
// import './tests/pp'

console.log( path.resolve('./xx/rrr', '../../../test') )
console.log( Como.path.resolve('./xx/rrr', '../../../test') )

console.log( path.resolve(import.meta.dir, './test') );


Como.path.walk(Como.path.resolve(import.meta.dir, './tests'), function(path, ee){
    console.log(path)
    console.log(ee)
});

// const { dirWalk } = Como.fs

// // console.log(import.meta)
// dirWalk(import.meta.url, function(p){
//     console.log(import.meta)
//     // console.log(p)
// })

