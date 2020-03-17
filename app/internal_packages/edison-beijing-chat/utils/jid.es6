export const jidlocal = jid => {
  if (typeof jid === 'string') {
    if (jid.indexOf('@') > 0) {
      return jid.split('@')[0];
    } else {
      return jid;
    }
  } else if (jid) {
    return jid.local;
  }
  return '';
};
export const jidbare = jid => {
  if (typeof jid === 'string') {
    return jid;
  } else if (typeof jid === 'object') {
    return jid.bare;
  }
  return '';
};
