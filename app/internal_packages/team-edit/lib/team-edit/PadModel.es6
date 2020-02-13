const Sequelize = require('sequelize')
const Model = Sequelize.Model
const { getdb } = require('./pad-db')
const db = getdb()

export default class Pad extends Model {}
Pad.init(
  {
    id: {
      type: Sequelize.STRING,
      primaryKey: true,
    },
    chatRoomId: {
      type: Sequelize.STRING,
    },
    name: {
      type: Sequelize.STRING,
    },
    emaiOri: {
      type: Sequelize.STRING
    },
    emailExtr: {
      type: Sequelize.STRING
    },
    isContributor: {
      type: Sequelize.BOOLEAN,
    },
    ownerEmail: {
      type: Sequelize.STRING,
    },
    permission: {
      type: Sequelize.STRING,
    },
    status: {
      type: Sequelize.INTEGER,
      indexed: true,
    },
    time: {
      type: Sequelize.INTEGER,
    },
  },
  {
    sequelize: db,
    modelName: 'pads',
  }
)
Pad.sync()
db.pads = Pad
