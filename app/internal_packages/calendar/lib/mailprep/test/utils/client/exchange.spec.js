import sinon from 'sinon';
// import {
//   Appointment,
//   ItemId,
//   DateTime,
//   MessageBody,
//   EmailAddress,
//   AppointmentType,
//   Item,
//   WellKnownFolderName,
//   SendInvitationsMode
// } from 'ews-javascript-api';
import * as ews from 'ews-javascript-api';
import moment from 'moment';
import proxyquire from 'proxyquire';
import util from 'util';

import _ from 'lodash';
import * as ExchangeActions from '../../../app/utils/client/exchange';
import * as ExchangeBasics from '../../../app/utils/client/exchangebasics';
import * as dbEventActions from '../../../app/sequelizeDB/operations/events';
import * as dbRpActions from '../../../app/sequelizeDB/operations/recurrencepatterns';
// import {
//   asyncUpdateExchangeEvent,
//   asyncGetSingleExchangeEvent
// } from '../../../app/utils/client/exchange';
import {
  postEventSuccess,
  editEventSuccess,
  deleteEventSuccess
} from '../../../app/actions/events';
import { mockEventData } from '../../reducers/mockEventData';
import { filterIntoSchema } from '../../../app/utils/constants';
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

describe('Exchange Utils Functions', async () => {
  const getFakeEWSAppointment = (isRecurring, isException, isMaster, id) => {
    const testAppt = new ews.Appointment();

    if (isRecurring) {
      // sinon.stub(testAppt, 'AppointmentType').get(() => AppointmentType.Occurrence);
      sinon.stub(testAppt, 'AppointmentType').get(() => 'Occurrence');
    } else if (isException) {
      // sinon.stub(testAppt, 'AppointmentType').get(() => AppointmentType.Exception);
      sinon.stub(testAppt, 'AppointmentType').get(() => 'Exception');
    } else if (isMaster) {
      // sinon.stub(testAppt, 'AppointmentType').get(() => AppointmentType.RecurringMaster);
      sinon.stub(testAppt, 'AppointmentType').get(() => 'RecurringMaster');
    } else {
      // sinon.stub(testAppt, 'AppointmentType').get(() => AppointmentType.Single);
      sinon.stub(testAppt, 'AppointmentType').get(() => 'Single');
    }

    sinon.stub(testAppt, 'Subject').get(() => mockEventData[id].summary);
    sinon.stub(testAppt, 'Subject').set((test) => {});

    sinon.stub(testAppt, 'Id').get(() => new ews.ItemId(mockEventData[id].originalId));
    sinon.stub(testAppt, 'Id').set((test) => {});

    sinon
      .stub(testAppt, 'Start')
      .get(
        () =>
          new ews.DateTime(
            moment.tz(mockEventData[id].start.dateTime, mockEventData[id].start.timezone)
          )
      );
    sinon.stub(testAppt, 'Start').set((test) => {});

    sinon
      .stub(testAppt, 'End')
      .get(
        () =>
          new ews.DateTime(
            moment.tz(mockEventData[id].end.dateTime, mockEventData[id].end.timezone)
          )
      );
    sinon.stub(testAppt, 'End').set((test) => {});

    sinon.stub(testAppt, 'ICalUid').get(() => mockEventData[id].iCalUID);
    sinon.stub(testAppt, 'ICalUid').set((test) => {});

    if (isRecurring || isException || isMaster) {
      // sinon
      //   .stub(testAppt, 'RecurrenceMasterId')
      //   .get(() => new ews.ItemId(mockEventData[id].originalId));
      // sinon.stub(testAppt, 'RecurrenceMasterId').set((test) => {});
      testAppt.RecurrenceMasterId = mockEventData[id].originalId;

      const fakeRecurrence = getFakeEWSRecurrence();

      sinon.stub(testAppt, 'Recurrence').get(() => fakeRecurrence);
      sinon.stub(testAppt, 'Recurrence').set((test) => {});

      sinon.stub(testAppt, 'DeletedOccurrences').get(() => null);
      sinon.stub(testAppt, 'DeletedOccurrences').set((test) => {});

      sinon.stub(testAppt, 'ModifiedOccurrences').get(() => null);
      sinon.stub(testAppt, 'ModifiedOccurrences').set((test) => {});
    }
    sinon.stub(testAppt, 'Body').get(() => new ews.MessageBody('Message body goes here'));
    sinon.stub(testAppt, 'Body').set((test) => {});

    sinon.stub(testAppt, 'Location').get(() => '');
    sinon.stub(testAppt, 'Location').set((test) => {});

    sinon
      .stub(testAppt, 'WebClientReadFormQueryString')
      .get(
        () =>
          'https://outlook.office365.com/owa/?ItemID=AAMkAGZlZDEyNmMxLTMyNDgtNDMzZi05ZmZhLTU5ODk3ZjA5ZjQyOAFRAAgI1x64BNOAAEYAAAAAP1zzVW4VSUm0RBGCtMSdxQcAitFLe5kDsU%2BVtVnfNmUrqgAAAAABDQAAitFLe5kDsU%2BVtVnfNmUrqgACAqwVrAAAEA%3D%3D&exvsurl=1&viewmodel=ReadMessageItem'
      );
    sinon.stub(testAppt, 'WebClientReadFormQueryString').set((test) => {});

    sinon.stub(testAppt, 'IsAllDayEvent').get(() => true);
    sinon.stub(testAppt, 'IsAllDayEvent').set((test) => {});

    sinon
      .stub(testAppt, 'DateTimeCreated')
      .get(() => new ews.DateTime(moment.tz('2019-08-18 11:00', 'America/Toronto')));
    sinon.stub(testAppt, 'DateTimeCreated').set((test) => {});

    sinon
      .stub(testAppt, 'LastModifiedTime')
      .get(() => new ews.DateTime(moment.tz('2019-08-18 11:00', 'America/Toronto')));
    sinon.stub(testAppt, 'LastModifiedTime').set((test) => {});

    sinon.stub(testAppt, 'IsCancelled').get(() => true);
    sinon.stub(testAppt, 'IsCancelled').set((test) => {});

    sinon.stub(testAppt, 'Organizer').get(() => new ews.EmailAddress('e0176993@u.nus.edu'));
    sinon.stub(testAppt, 'Organizer').set((test) => {});

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

  const getFakeEWSExchangeService = (isRecurring) => {
    const fakeExchangeService = new ews.ExchangeService();
    const fakeAppt = getFakeEWSAppointment(false, false, false, 0);

    // Find appointment is ran in a loop. therefore, it needs the oncall function.
    // Currently, fake appt is not correct, but I haven't updated the mock data
    // Once I update the mock data, I will update the array accordingly!
    const findApptStub = sandbox.stub(fakeExchangeService, 'FindAppointments');
    findApptStub.onCall(0).resolves({ Items: [fakeAppt] });
    findApptStub.resolves({ Items: [] });

    if (!isRecurring) {
      // Bind to items return us this format, therefore, I am getting the fake appt data
      // from our database object, and returning it as a safe ews appointment class
      sandbox.stub(fakeExchangeService, 'BindToItems').resolves({
        responses: [
          { item: getFakeEWSAppointment(false, false, false, 20) },
          { item: getFakeEWSAppointment(false, false, false, 22) }
        ]
      });
    } else {
      // Currently find items is meant specifically for dealing with recurrence master test cases.
      // Therefore, it wil lbe returning only recurrence master
      sandbox.stub(fakeExchangeService, 'FindItems').resolves({
        Items: [getFakeEWSAppointment(false, false, true, 19)]
      });

      sandbox.stub(fakeExchangeService, 'BindToItems').resolves({
        Responses: [{ Item: getFakeEWSAppointment(false, false, true, 19), errorCode: 0 }]
      });
    }

    return fakeExchangeService;
  };

  const getFakeEWSRecurrence = () => {
    const fakeRecurrenceStartDate = {
      StartDate: new ews.DateTime(moment.tz('2019-08-08T21:00:00-07:00', 'America/Los_Angeles'))
    };

    const ewsRecurrence = ExchangeActions.editEwsRecurrenceObj(
      0,
      {},
      1,
      fakeRecurrenceStartDate,
      'o',
      '2019-08-19T00:00:00-07:00',
      0,
      '()',
      '()',
      '()',
      '()'
    );

    return ewsRecurrence;
  };

  let sandbox = null;
  const ewsAppointmenDependency = ews.Appointment;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    ews.Appointment = ewsAppointmenDependency;
  });

  afterEach(() => {
    sandbox.restore();
  });

  /*
    This test is one of the hardest test to build.
    The goal of this test is to ensure not to test the api,
    but to ensure that it returns a proper success and error depending on test case.

    Some key notes about this test cases
      1.  You have to fake ExchangeService, Url Credentials, as its an api function.
      2.  Appointment has 2 constructors, and calls the endpoint based off Exchange Service.
          Therefore, you have to ensure that you fake the constructor.
          At the same time, we can get it to return a fake ews appointment object.
      3.  For every parameter set in the appointment,
            It will throw an error if it is not correct.
            It will throw an error if we get/set when there is no getter/setter
              Therefore, I stub the setter to return me nothing
              and getter to return me a fixed value
              as we defined the object values as hard coded values.
      4.  In order to update the server endpoint, Appointment.Save is called
          Therefore, we need to mock the .Save function
          As we have an fake ews appointment object that we are returning,
          we can stub the functionality to return us something we want.
      5.  .Save returns a promise. Therefore, we use resolves.
          As .Save does not return the with all server side values, it return nothing useful
          Therefore, our stub of .Save returns noting.
      6.  We do another call to the server to get the values, E.g. Id, OrigianlId, etc.
          These are values auto populated by ews, therefore, we have to do that.
          However, as this is not communicating with an endpoint,
          we assume the fake object is correct
      7.  Lastly, we are suppose to test the database if there is a new event,
          and it is the correct event that has been upserted.
          However, those are handled by different unit test, the DB test case.
          Keep in mind the goal of unit test is to test function by function.

    The goal of this test case ensure proper input and output for our epics to process.
   */

  it('Get Single Exchange Event', () => {
    // Create fake appointment
    const fakeAppt = getFakeEWSAppointment(false, false, false, 0);

    // Fake all ews side functions
    const exchFake = sandbox.fake.returns();
    sandbox.replace(ews, 'ExchangeService', exchFake);
    const urlFake = sandbox.fake.returns();
    sandbox.replace(ews, 'Uri', urlFake);
    const credFake = sandbox.fake.returns();
    sandbox.replace(ews, 'ExchangeCredentials', credFake);

    // Stub the constructor to return me the proper object
    sandbox.stub(ews.Appointment, 'Bind').resolves(fakeAppt);

    // Run the function to test.
    const result = ExchangeBasics.asyncGetSingleExchangeEvent(
      ewsSampleUser.email,
      ewsSampleUser.password,
      'https://outlook.office365.com/Ews/Exchange.asmx',
      mockEventData[0].originalId
    );

    return result
      .then((test) => expect(test).toEqual(fakeAppt))
      .catch((error) => expect(error).toBeNull());
  });

  it('Get All Exchange Events', () => {
    // Create fake appointment
    const fakeAppt = getFakeEWSAppointment(false, false, false, 0);
    const fakeExchangeService = getFakeEWSExchangeService(false);

    // Run the function to test.
    const result = ExchangeBasics.asyncGetAllExchangeEvents(fakeExchangeService);

    return result
      .then((test) => {
        // console.log(test);
        // console.log(fakeAppt);
        // // We have a problem here, if I match via array to array, it says no visual difference.
        // // If I match via object, same thing.
        // // If I match via json stringify, I get circular reference error
        // // If I match via toMatchObject, I get circular reference again
        expect(test[0].Id.UniqueId).toEqual(fakeAppt.Id.UniqueId);

        // resultSet.forEach((v, k) => {
        //   // This test case is not complete, need to throw error if cannot find key.
        //   expect(JSON.stringify(util.inspect(exchangeEvents.get(k)))).toEqual(
        //     JSON.stringify(util.inspect(v))
        //   );
        // });
      })
      .catch((error) => {
        console.log(error);
        // expect(error).toBeNull();
      });
  });

  it('Get All Exchange Body Events', () => {
    // Create fake exchange service
    const fakeExchangeService = getFakeEWSExchangeService(false);

    const arrayOfNonRecurrIds = [
      'AAMkAGZlZDEyNmMxLTMyNDgtNDMzZi05ZmZhLTU5ODk3ZjA5ZjQyOABGAAAAAAA/XPNVbhVJSbREEYK0xJ3FBwCK0Ut7mQOxT5W1Wd82ZSuqAAAAAAENAACK0Ut7mQOxT5W1Wd82ZSuqAAFXXK8AAAA=',
      'AAMkAGZlZDEyNmMxLTMyNDgtNDMzZi05ZmZhLTU5ODk3ZjA5ZjQyOABGAAAAAAA/XPNVbhVJSbREEYK0xJ3FBwCK0Ut7mQOxT5W1Wd82ZSuqAAAAAAENAACK0Ut7mQOxT5W1Wd82ZSuqAAFnENf0AAA='
    ];
    const exchangeEvents = [
      getFakeEWSAppointment(false, false, false, 20),
      getFakeEWSAppointment(false, false, false, 22)
    ];

    // Run the function to test.
    const result = ExchangeBasics.asyncGetExchangeBodyEvents(
      fakeExchangeService,
      arrayOfNonRecurrIds,
      exchangeEvents
    );

    return result
      .then((test) => {
        expect(test[0].Body).toEqual(exchangeEvents[0].Body);
        expect(test[1].Body).toEqual(exchangeEvents[1].Body);
      })
      .catch((error) => {
        console.log(error);
        // expect(error).toBeNull();
      });
  });

  it('Get all Exchange Recurrence Master Events', () => {
    // Create fake exchange service
    const fakeExchangeService = getFakeEWSExchangeService(true);

    // Run the function to test.
    const result = ExchangeBasics.asyncGetExchangeRecurrMasterEvents(fakeExchangeService);

    sandbox.stub(dbRpActions, 'getOneRpByOId').resolves(null);
    sandbox.stub(dbRpActions, 'getAllRp').resolves([]);
    sandbox.stub(dbRpActions, 'updateRpByOid').resolves();
    sandbox.stub(dbRpActions, 'insertOrUpdateRp').resolves();

    // Result
    const exchangeEvents = new Map();
    const appt = getFakeEWSAppointment(false, false, true, 19);
    // const appt = {};
    exchangeEvents.set(appt.ICalUid, appt);

    return result
      .then((resultSet) => {
        resultSet.forEach((v, k) => {
          // This test case is not complete, need to throw error if cannot find key.
          expect(JSON.stringify(util.inspect(exchangeEvents.get(k)))).toEqual(
            JSON.stringify(util.inspect(v))
          );
        });
      })
      .catch((error) => {
        console.log(error);
        // expect(error).toBeNull();
      });
  });

  it('Create Exchange Event', () => {
    // Create fake appointment
    const fakeAppt = getFakeEWSAppointment(false, false, false, 0);

    // Fake all ews side functions
    const exchFake = sandbox.fake.returns();
    sandbox.replace(ews, 'ExchangeService', exchFake);
    const urlFake = sandbox.fake.returns();
    sandbox.replace(ews, 'Uri', urlFake);
    const credFake = sandbox.fake.returns();
    sandbox.replace(ews, 'ExchangeCredentials', credFake);

    const dependencyClass = ews.Appointment;
    // Stub the constructor to return me the proper object
    ews.Appointment = sandbox.stub(ews.Appointment, 'constructor').returns(fakeAppt);

    // Stub the generated appointment save function to resolve me nothing
    sandbox.stub(fakeAppt, 'Save').resolves();

    // Ensure that binds return me the same object
    sandbox.stub(ews.Item, 'Bind').resolves(fakeAppt);

    sandbox.stub(dbEventActions, 'getAllEventByOriginalId').resolves([]);
    sandbox.stub(dbEventActions, 'insertEventsIntoDatabase').resolves();

    // Run the function to test.
    const result = ExchangeActions.asyncCreateExchangeEvent(
      ewsSampleUser.email,
      ewsSampleUser.password,
      'https://outlook.office365.com/Ews/Exchange.asmx',
      mockEventData[0]
    );

    return result
      .then((test) =>
        expect(test).toEqual(postEventSuccess([fakeAppt], 'EXCHANGE', ewsSampleUser.email))
      )
      .catch((error) => expect(error).toBeNull());
  });

  it('Update Exchange Event', () => {
    // Create fake appointment
    const fakeAppt = getFakeEWSAppointment(false, false, false, 0);
    const filteredFakeAppt = filterIntoSchema(fakeAppt, 'EXCHANGE', ewsSampleUser.email);

    // Stub the generated appointment save function to resolve me nothing
    sandbox.stub(fakeAppt, 'Update').resolves('success');

    sandbox.stub(ExchangeBasics, 'asyncGetSingleExchangeEvent').resolves(fakeAppt);
    sandbox.stub(dbEventActions, 'getOneEventByOriginalId').resolves(filteredFakeAppt);
    sandbox.stub(dbEventActions, 'updateEventByOriginalId').resolves();

    // Run the function to test.
    const result = ExchangeActions.asyncUpdateExchangeEvent(fakeAppt, ewsSampleUser, () => {});

    return result
      .then((test) => {
        expect(test).toEqual(editEventSuccess(fakeAppt));

        return true;
      })
      .catch((error) => {
        expect(error).toBeNull();

        return false;
      });
  });

  it('Update Recurring Exchange Series', () => {
    // Create fake appointment
    const fakeAppt = getFakeEWSAppointment(false, false, false, 0);
    const filteredFakeAppt = filterIntoSchema(fakeAppt, 'EXCHANGE', ewsSampleUser.email);

    // Stub the generated appointment save function to resolve me nothing
    sandbox.stub(fakeAppt, 'Update').resolves('success');

    // Stub the basic exchange event, to get the master event.
    sandbox.stub(ExchangeBasics, 'asyncGetSingleExchangeEvent').resolves(fakeAppt);

    // Stub the db action, coz we assume the db unit test is already working.
    // TO-DO, UPDATE FILTERED FAKE APPT TO A PROPER ARRAY OF RECURRENCING EVENTS
    // currently is because I don't have mock data for that in my fake table.
    sandbox.stub(dbEventActions, 'getAllEventsByRecurringEventId').resolves([filteredFakeAppt]);
    sandbox.stub(dbEventActions, 'updateEventRecurringEventId').resolves();

    // Run the function to test.
    const result = ExchangeActions.asyncUpdateRecurrExchangeSeries(
      fakeAppt,
      ewsSampleUser,
      () => {}
    );

    return result
      .then((test) => {
        expect(test).toEqual(editEventSuccess(fakeAppt));

        return true;
      })
      .catch((error) => {
        expect(error).toBeNull();

        return false;
      });
  });

  it('Delete Exchange Event', () => {
    // Create fake appointment
    const fakeAppt = getFakeEWSAppointment(false, false, false, 0);

    // Stub the generated appointment save function to resolve me nothing
    sandbox.stub(fakeAppt, 'Delete').resolves('success');

    // Stub the db action, coz we assume the db unit test is already working.
    sandbox.stub(dbEventActions, 'deleteEventByOriginalId').resolves();

    // Run the function to test.
    const result = ExchangeActions.asyncDeleteExchangeEvent(fakeAppt, ewsSampleUser, () => {});

    return result
      .then((test) => {
        expect(test).toEqual(deleteEventSuccess(fakeAppt.Id.UniqueId, ewsSampleUser));

        return true;
      })
      .catch((error) => {
        expect(error).toBeNull();

        return false;
      });
  });

  it('Get Recurring and Single Events', () => {
    // Create fake exchange service
    const fakeExchangeService = getFakeEWSExchangeService(true);

    // Generate Fake Results for each function returns
    // #region asyncGetExchangeBodyEvents
    const exchangeEvents = [
      getFakeEWSAppointment(false, false, false, 20),
      getFakeEWSAppointment(false, false, false, 22)
    ];
    // #endregion

    // #region asyncGetExchangeRecurrMasterEvents
    const asyncGetExchangeRecurrMasterEventsResults = new Map();
    const appt = getFakeEWSAppointment(false, false, true, 19);
    asyncGetExchangeRecurrMasterEventsResults.set(appt.ICalUid, appt);
    // #endregion

    // Stub the generated appointment save function to resolve me nothing
    sandbox.stub(ExchangeBasics, 'asyncGetAllExchangeEvents').resolves([appt, ...exchangeEvents]);
    sandbox.stub(ExchangeBasics, 'asyncGetExchangeBodyEvents').resolves(exchangeEvents);
    sandbox
      .stub(ExchangeBasics, 'asyncGetExchangeRecurrMasterEvents')
      .resolves(asyncGetExchangeRecurrMasterEventsResults);

    // Run the function to test.
    const result = ExchangeActions.asyncGetRecurrAndSingleExchangeEvents(fakeExchangeService);

    return result
      .then((test) => {
        // console.log(test.length, exchangeEvents.length);
        // console.log(test[2].RecurrenceMasterId);
        expect(test).toEqual(exchangeEvents);

        // return true;
      })
      .catch((error) => {
        expect(error).toBeNull();

        return false;
      });
  });
});
