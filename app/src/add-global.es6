import path from 'path'
const module = require('module')
const cwd = process.cwd()
console.log(' cwd: ', cwd)
const globalPath = path.join(cwd, 'app', 'src', 'global')
module.globalPaths.push(globalPath)
console.log(' add-global: module: ', module)
console.log(' module.globalPaths: ', module.globalPaths)

export default {}
