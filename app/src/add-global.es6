import path from 'path'
const module = require('module')
const cwd = process.cwd()
const globalPath = path.join(cwd, 'app', 'src', 'global')
module.globalPaths.push(globalPath)

export default {}
