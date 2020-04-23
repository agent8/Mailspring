const Sequelize = require('sequelize');
const Model = Sequelize.Model;
const db = require('../db/index').default;
const { tableCompletedSync } = require('../utils/databaseCompleteInt');

export default class UserCache extends Model { }
UserCache.init(
  {
    jid: {
      type: Sequelize.STRING,
      primaryKey: true,
    },
    email: {
      type: Sequelize.STRING,
    },
    name: {
      type: Sequelize.STRING,
    },
    avatar: {
      type: Sequelize.STRING,
    },
    info: {
      type: Sequelize.JSON,
    },
  },
  {
    sequelize: db,
    modelName: 'usercache_v2',
  }
);
UserCache.sync().then(tableCompletedSync);
db.userCache = UserCache;