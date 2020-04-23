const Sequelize = require('sequelize');
const Model = Sequelize.Model;
const db = require('../db/index').default;
const { tableCompletedSync } = require('../utils/databaseCompleteInt');

export default class Conversation extends Model { }
Conversation.init(
  {
    // attributes
    jid: {
      type: Sequelize.STRING,
      primaryKey: true,
    },
    curJid: {
      type: Sequelize.STRING,
    },
    name: {
      type: Sequelize.STRING,
    },
    avatar: {
      type: Sequelize.STRING,
    },
    isGroup: {
      type: Sequelize.BOOLEAN,
    },
    isHiddenNotification: {
      type: Sequelize.BOOLEAN,
    },
    at: {
      // be '@'
      type: Sequelize.BOOLEAN,
    },
    unreadMessages: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    },
    avatarMembers: {
      type: Sequelize.JSON,
    },
    lastMessageTime: {
      type: Sequelize.INTEGER,
    },
    lastMessageText: {
      type: Sequelize.STRING,
    },
    lastMessageSender: {
      // Jid of last sender
      type: Sequelize.STRING,
    },
    lastMessageSenderName: {
      type: Sequelize.STRING,
    },
  },
  {
    sequelize: db,
    modelName: 'conversations',
    // options
  }
);
Conversation.sync().then(tableCompletedSync);
db.conversations = Conversation;