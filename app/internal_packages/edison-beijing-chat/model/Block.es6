const Sequelize = require('sequelize');
const Model = Sequelize.Model;
const db = require('../db/index').default;
const { tableCompletedSync } = require('../utils/databaseCompleteInt');

export default class Block extends Model { }
Block.init(
  {
    curJid: {
      type: Sequelize.STRING,
    },
    jid: {
      type: Sequelize.STRING,
    },
  },
  {
    indexes: [
      {
        fields: ['curJid'],
      },
    ],
    sequelize: db,
    modelName: 'block',
  }
);
Block.sync().then(tableCompletedSync);
db.block = Block;
