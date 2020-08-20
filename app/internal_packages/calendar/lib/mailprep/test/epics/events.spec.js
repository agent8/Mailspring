import { TestScheduler } from 'rxjs/testing';
import sinon from 'sinon';
import {
  Appointment,
  ItemId,
  DateTime,
  MessageBody,
  EmailAddress,
  AppointmentType,
  Item,
  WellKnownFolderName,
  SendInvitationsMode
} from 'ews-javascript-api';
import moment from 'moment';
import { clearAllEventsEpics } from '../../app/epics/events';
import { beginGetExchangeEventsEpics } from '../../app/epics/providers/exchange';
import * as ExchangeActions from '../../app/utils/client/exchange';
import { getEventsSuccess, postEventSuccess } from '../../app/actions/events';
import { filterIntoSchema } from '../../app/utils/constants';

const testScheduler = new TestScheduler((actual, expected) => {
  expect(actual).toEqual(expected);
});

// function once(fn) {
//   let returnValue;
//   let called = false;
//   return function() {
//     if (!called) {
//       called = true;
//       returnValue = fn.apply(this, arguments);
//     }
//     return returnValue;
//   };
// }

const getFakeEWSAppointment = (isRecurring, isException, isMaster) => {
  const testAppt = new Appointment();

  if (isRecurring) {
    // sinon.stub(testAppt, 'AppointmentType').get(() => AppointmentType.Occurrence);
  } else if (isException) {
    // sinon.stub(testAppt, 'AppointmentType').get(() => AppointmentType.Exception);
  } else if (isMaster) {
    // sinon.stub(testAppt, 'AppointmentType').get(() => AppointmentType.RecurringMaster);
  } else {
    sinon.stub(testAppt, 'AppointmentType').get(() => 'Single');
    // sinon.stub(testAppt, 'AppointmentType').get(() => AppointmentType.Single);
  }

  sinon.stub(testAppt, 'Subject').get(() => 'Test Subject');
  sinon
    .stub(testAppt, 'Id')
    .get(
      () =>
        new ItemId(
          'AAMkAGZlZDEyNmMxLTMyNDgtNDMzZi05ZmZhLTU5ODk3ZjA5ZjQyOAFRAAgI1x64BNOAAEYAAAAAP1zzVW4VSUm0RBGCtMSdxQcAitFLe5kDsU+VtVnfNmUrqgAAAAABDQAAitFLe5kDsU+VtVnfNmUrqgACAqwVrAAAEA=='
        )
    );
  sinon
    .stub(testAppt, 'Start')
    .get(() => new DateTime(moment.tz('2019-08-18 11:00', 'America/Toronto')));
  sinon
    .stub(testAppt, 'End')
    .get(() => new DateTime(moment.tz('2019-08-19 11:55', 'America/Toronto')));
  sinon
    .stub(testAppt, 'ICalUid')
    .get(
      () =>
        '040000008200E00074C5B7101A82E00800000000449E78AA5D51D5010000000000000000100000005702C358D08FA34EAEFABAAA2A65B328'
    );

  if (isRecurring || isException || isMaster) {
    sinon
      .stub(testAppt, 'RecurrenceMasterId')
      .get(
        () =>
          new ItemId(
            'AAMkAGZlZDEyNmMxLTMyNDgtNDMzZi05ZmZhLTU5ODk3ZjA5ZjQyOABGAAAAAAA/XPNVbhVJSbREEYK0xJ3FBwCK0Ut7mQOxT5W1Wd82ZSuqAAAAAAENAACK0Ut7mQOxT5W1Wd82ZSuqAAICrBWsAAA='
          )
      );
  }
  sinon.stub(testAppt, 'Body').get(() => new MessageBody('Message body goes here'));
  sinon.stub(testAppt, 'Location').get(() => '');
  sinon
    .stub(testAppt, 'WebClientReadFormQueryString')
    .get(
      () =>
        'https://outlook.office365.com/owa/?ItemID=AAMkAGZlZDEyNmMxLTMyNDgtNDMzZi05ZmZhLTU5ODk3ZjA5ZjQyOAFRAAgI1x64BNOAAEYAAAAAP1zzVW4VSUm0RBGCtMSdxQcAitFLe5kDsU%2BVtVnfNmUrqgAAAAABDQAAitFLe5kDsU%2BVtVnfNmUrqgACAqwVrAAAEA%3D%3D&exvsurl=1&viewmodel=ReadMessageItem'
    );
  sinon.stub(testAppt, 'IsAllDayEvent').get(() => true);
  sinon
    .stub(testAppt, 'DateTimeCreated')
    .get(() => new DateTime(moment.tz('2019-08-18 11:00', 'America/Toronto')));
  sinon
    .stub(testAppt, 'LastModifiedTime')
    .get(() => new DateTime(moment.tz('2019-08-18 11:00', 'America/Toronto')));
  sinon.stub(testAppt, 'IsCancelled').get(() => true);
  sinon.stub(testAppt, 'Organizer').get(() => new EmailAddress('e0176993@u.nus.edu'));

  // console.log('testAppt: ', testAppt);
  // console.log(
  //   'Some values: ',
  //   testAppt.AppointmentType,
  //   '\n',
  //   testAppt.Subject,
  //   '\n',
  //   testAppt.Id,
  //   '\n',
  //   testAppt.Start,
  //   '\n',
  //   testAppt.End,
  //   '\n',
  //   testAppt.Body,
  //   '\n',
  //   testAppt.Location,
  //   '\n',
  //   testAppt.WebClientReadFormQueryString,
  //   '\n',
  //   testAppt.IsAllDayEvent,
  //   '\n',
  //   testAppt.DateTimeCreated,
  //   '\n',
  //   testAppt.LastModifiedTime,
  //   '\n',
  //   testAppt.IsCancelled,
  //   '\n',
  //   testAppt.Organizer
  // );

  return testAppt;
};

// Mocked user data
const ewsSampleUser = {
  personId: '9896e06a-6c39-4643-aea7-b74d0231f9d0',
  originalId: 'a5849d52-8dd5-47f4-9b77-99888ca1c5b8',
  email: 'e0176993@u.nus.edu',
  providerType: 'EXCHANGE',
  accessToken: '',
  accessTokenExpiry: 0,
  password: 'Ggrfw4406@nus6',
  url: '',
  caldavType: ''
};

describe('Events Epics', () => {
  // it('Should handle Clearing all events', () => {
  //   testScheduler.run(({ hot, cold, expectObservable }) => {
  //     const action$ = hot('-a', {
  //       a: { type: 'CLEAR_ALL_EVENTS' }
  //     });
  //     const state$ = null;
  //     const dependencies = {};

  //     const output$ = clearAllEventsEpics(action$, state$, dependencies);

  //     expectObservable(output$).toBe('-a', {
  //       a: {
  //         type: 'CLEAR_ALL_EVENTS_SUCCESS'
  //       }
  //     });
  //   });
  // });

  // // Test to ensure the proper input/output for getting of exchange events
  // it('Get Exchange Events', async () => {
  //   await testScheduler.run(async ({ hot, cold, expectObservable }) => {
  //     const action$ = hot('-a', {
  //       a: {
  //         type: 'GET_EXCHANGE_EVENTS_BEGIN',
  //         payload: [ewsSampleUser]
  //       }
  //     });
  //     const state$ = null;
  //     const dependencies = {};

  //     sinon.stub(ExchangeActions, 'asyncCreateExchangeEvent').returns();

  //     sinon.stub(ExchangeActions, 'asyncGetRecurrAndSingleExchangeEvents').returns();
  //     const output$ = beginGetExchangeEventsEpics(action$);

  //     ExchangeActions.asyncCreateExchangeEvent.restore();
  //     ExchangeActions.asyncGetRecurrAndSingleExchangeEvents.restore();

  //     output$.subscribe((val) =>
  //       expect(val).toBe(
  //         getEventsSuccess({
  //           data: [],
  //           providerType: 'EXCHANGE',
  //           users: [ewsSampleUser]
  //         })
  //       )
  //     );

  //     // expectObservable(output$).toBe('-a', {
  //     //   a: {
  //     //     type: 'GET_EVENTS_SUCCESS',
  //     //     payload: {
  //     //       data: [],
  //     //       providerType: 'EXCHANGE',
  //     //       users: [ewsSampleUser]
  //     //     }
  //     //   }
  //     // });
  //   });
  // });

  it('Testing', async () => {
    await testScheduler.run(async ({ hot, cold, expectObservable }) => {
      const action$ = hot('-a', {
        a: { type: 'CLEAR_ALL_EVENTS' }
      });
      const state$ = null;
      const dependencies = {};

      // const db = await createDb();
      // const results = await db.events.find().exec();
      // console.log('prev', results.map((e) => e.toJSON()));

      // await clearDb();

      // const newdb = await createDb();
      // const newresults = await newdb.events.find().exec();
      // console.log('new', newresults.map((e) => e.toJSON()));

      const output$ = clearAllEventsEpics(action$, state$, dependencies);

      expectObservable(output$).toBe('-a', {
        a: {
          type: 'CLEAR_ALL_EVENTS_SUCCESS'
        }
      });
    });
  });
});
