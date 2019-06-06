/* eslint global-require: 0 */
/* eslint import/no-dynamic-require: 0 */
import DatabaseObjectRegistry from '../registries/database-object-registry';

// This module exports an empty object, with a ton of defined properties that
// `require` files the first time they're called.
module.exports = exports = window.$c = {};

const resolveExport = requireValue => {
  return requireValue.default || requireValue;
};

const lazyLoadWithGetter = (prop, getter) => {
  const key = `${prop}`;

  if (exports[key]) {
    throw new Error(`Fatal error: Duplicate entry in chat-exports: ${key}`);
  }
  Object.defineProperty(exports, prop, {
    configurable: true,
    enumerable: true,
    get: () => {
      const value = getter();
      Object.defineProperty(exports, prop, { enumerable: true, value });
      return value;
    },
  });
};

const chatPath = '../../internal_packages/edison-beijing-chat';

const lazyLoad = (prop, path) => {
  lazyLoadWithGetter(prop, () => resolveExport(require(`${chatPath}/${path}`)));
};

const _resolveNow = [];
const load = (klassName, path) => {
  lazyLoad(klassName, path);
  _resolveNow.push(klassName);
};

// Actions
lazyLoad(`ChatActions`, 'flux-actions/actions');

// API Endpoints
//lazyLoad(`MailspringAPIRequest`, 'flux/mailspring-api-request');
// The Database
//lazyLoad(`Matcher`, 'flux/attributes/matcher');
//lazyLoad(`DatabaseStore`, 'flux/stores/database-store');

// Stores
// These need to be required immediately since some Stores are
// listen-only and not explicitly required from anywhere. Stores
// currently set themselves up on require.
lazyLoad(`ProgressBarStore`, 'store/ProgressBarStore');
lazyLoad(`MessageStore`, 'store/MessageStore');
lazyLoad(`ConversationStore`, 'store/ConversationStore');
lazyLoad(`RoomStore`, 'store/RoomStore');
lazyLoad(`ContactStore`, 'store/ContactStore');
lazyLoad(`OnlineUserStore`, 'store/OnlineUserStore');

process.nextTick(() => {
  let c = 0;
  for (const key of _resolveNow) {
    c += exports[key] ? 1 : 0;
  }
  return c;
});
