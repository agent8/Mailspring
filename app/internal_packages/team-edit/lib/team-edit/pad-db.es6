import path from "path";
const Sequelize = require('sequelize');

let db;

export function getdb() {
  console.log('pad-db.getdb: ', db)
  if (db) {
    return db;
  }
  let configDirPath = AppEnv.getConfigDirPath();
  console.log('****storage', `${configDirPath}/pad-db.sqlite`);
  db = new Sequelize({
    dialect: 'sqlite',
    storage: `${configDirPath}/pad-db.sqlite`
  });
  return db;
}

export default getdb;
