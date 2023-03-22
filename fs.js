import * as fs from 'fs'

const data = fs.readFileSync('/home/mamod/Desktop/e/proj/node_modules/bert-tokenizer/assets/vocab.json')

console.log(data.toString().length)
