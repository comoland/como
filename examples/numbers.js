var m = Number.MAX_SAFE_INTEGER
var num =  9007199254740991

console.log(m, num)

console.log(((BigInt.asUintN(64, BigInt(Number.MAX_SAFE_INTEGER))) >> BigInt(32)).toString());

console.log((Number.MAX_SAFE_INTEGER >> 32).toString())