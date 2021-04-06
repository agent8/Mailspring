import { createAccount, syncCaldavAccount, transport, Credentials, request } from 'dav';
import { Actions, CalendarPluginStore } from 'mailspring-exports';
import { ICLOUD_ACCOUNT } from '../../constants';
import { parse, stringify } from 'flatted';

export const getCaldavAccount = async (username, password, url) => {
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
  // const stringResp = stringify(resp);
  return resp;
};

// export const syncCaldavCalendar = async (username, password) => {
//   const [auth] = CalendarPluginStore.getAuth(ICLOUD_ACCOUNT).filter(
//     account => account.username === username && account.password === password
//   );
//   if (auth === undefined) {
//     throw 'No account details found while sync-ing';
//   }
//   const accountObj = parse(auth.data);
//   for (const calendar of accountObj.calendars) {
//     var req = request.syncCollection({
//       syncLevel: 1,
//       syncToken: calendar.syncToken, //here you need to put your token
//       props: [
//         {
//           namespace: 'DAV:',
//           name: 'getcalendarData',
//         },
//       ],
//     });
//     const xhr = new transport.Basic(
//       new Credentials({
//         username: username,
//         password: password,
//       })
//     );
//     var result = await xhr.send(req, calendar.url);
//     console.log('sync results', result);
//   }
//   // const resp = await syncCaldavAccount(accountObj, {
//   //   xhr: new transport.Basic(
//   //     new Credentials({
//   //       username: username,
//   //       password: password,
//   //     })
//   //   ),
//   // });
//   // return resp;
// };
