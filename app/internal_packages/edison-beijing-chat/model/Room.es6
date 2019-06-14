import Message from './Message';

const Sequelize = require('sequelize');
const Model = Sequelize.Model;
const { getdb } = require('../chat-components/db/index');
const db = getdb();

export default class Room extends Model { }
Room.init({
  // attributes
  jid: {
    type: Sequelize.STRING,
    primaryKey: true
  },
  name: {
    type: Sequelize.STRING,
    indexed: true,
  },
  members: {
    type: Sequelize.JSON,
  }
}, {
    sequelize:db,
    modelName: 'rooms'
    // options
  });
Room.sync();
db.rooms = Room;
