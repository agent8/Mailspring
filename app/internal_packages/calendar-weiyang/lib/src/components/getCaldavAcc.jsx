import { createAccount, transport, Credentials } from 'dav'; // caldav library

export const getCaldavAccount = async (username, password, url) => {
  console.log(username, password, url);
  const resp = await createAccount({
    server: url,
    xhr: new transport.Basic(
      new Credentials({
        username: username,
        password: password,
      })
    ),
    loadObjects: true,
  });
  return resp;
};
