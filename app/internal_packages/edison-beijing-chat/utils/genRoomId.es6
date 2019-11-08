import uuid from 'uuid/v4';
import { GROUP_CHAT_DOMAIN } from './constant';

export default function() {
  return uuid() + GROUP_CHAT_DOMAIN;
}
