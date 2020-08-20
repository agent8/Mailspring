import * as dav from 'dav'; // caldav library

export const getCaldavAccount = async (username, password, url, caldavType) => {
  const resp = await dav.createAccount({
    server: url,
    xhr: new dav.transport.Basic(
      new dav.Credentials({
        username,
        password
      })
    ),
    loadObjects: true
  });
  return resp;
};

export const ignorefunc = {};
