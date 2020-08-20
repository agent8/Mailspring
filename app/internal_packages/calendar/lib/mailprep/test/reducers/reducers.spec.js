import authReducer from '../../app/reducers/auth';
import * as AuthActionTypes from '../../app/actions/auth';

import eventsReducer from '../../app/reducers/events';
import * as EventActionTypes from '../../app/actions/events';

import * as ProviderTypes from '../../app/utils/constants';
import ServerUrls from '../../app/utils/serverUrls';

import { mockEventData } from './mockEventData';

// Mocked Initial State data
const authInitialState = {
  providers: {
    [ProviderTypes.GOOGLE]: [],
    [ProviderTypes.OUTLOOK]: [],
    [ProviderTypes.EXCHANGE]: [],
    [ProviderTypes.CALDAV]: []
  },
  expiredProviders: {
    [ProviderTypes.GOOGLE]: [],
    [ProviderTypes.OUTLOOK]: [],
    [ProviderTypes.EXCHANGE]: [],
    [ProviderTypes.CALDAV]: []
  },
  isAuth: false,
  currentUser: null
};

// Mocked user data
const authSampleUser = {
  personId: '9896e06a-6c39-4643-aea7-b74d0231f9d0',
  originalId: 'a5849d52-8dd5-47f4-9b77-99888ca1c5b8',
  email: 'keith@edison.tech',
  providerType: '',
  accessToken: '',
  accessTokenExpiry: 0,
  password: 'somerandomstring',
  url: '',
  caldavType: ''
};

const eventsInitialState = {
  calEvents: []
};

const eventsSampleEvents = mockEventData;

describe('Reducers', () => {
  describe('Auth Reducer', () => {
    it('Should handle initial state', () => {
      expect(authReducer(undefined, {})).toEqual(authInitialState);
    });

    it('Should handle undefined action', () => {
      expect(authReducer(undefined, undefined)).toEqual(authInitialState);
    });

    describe('Exchange', () => {
      it('Should handle BEGIN_EXCHANGE_AUTH', () => {
        const testResult = authInitialState;
        testResult.isAuth = true;

        expect(
          authReducer(authInitialState, { type: AuthActionTypes.BEGIN_EXCHANGE_AUTH })
        ).toEqual(testResult);
      });

      it('Should handle SUCCESS_EXCHANGE_AUTH', () => {
        // Duplicate Test User
        const testUser = authSampleUser;

        // Set Provider Type to Exchange
        testUser.providerType = ProviderTypes.EXCHANGE;

        // Fields not used by Exchange service
        delete testUser.accessTokenExpiry;
        delete testUser.accessToken;
        delete testUser.url;
        delete testUser.caldavType;

        const testResult = authInitialState;
        testResult.isAuth = false;
        testResult.providers = {
          ...testResult.providers,
          [ProviderTypes.EXCHANGE]: [authSampleUser]
        };

        // Ensure that user fields are not empty
        expect(authSampleUser.personId).not.toBeNull();
        expect(authSampleUser.personId).not.toBeUndefined();
        expect(authSampleUser.personId).not.toBe('');

        expect(authSampleUser.originalId).not.toBeNull();
        expect(authSampleUser.originalId).not.toBeUndefined();
        expect(authSampleUser.originalId).not.toBe('');

        expect(authSampleUser.email).not.toBeNull();
        expect(authSampleUser.email).not.toBeUndefined();
        expect(authSampleUser.email).not.toBe('');

        expect(authSampleUser.password).not.toBeNull();
        expect(authSampleUser.password).not.toBeUndefined();
        expect(authSampleUser.password).not.toBe('');

        expect(authSampleUser.providerType).not.toBeNull();
        expect(authSampleUser.providerType).not.toBeUndefined();
        expect(authSampleUser.providerType).toBe(ProviderTypes.EXCHANGE);

        expect(
          authReducer(authInitialState, {
            type: AuthActionTypes.SUCCESS_EXCHANGE_AUTH,
            payload: { user: authSampleUser }
          })
        ).toEqual(testResult);
      });

      it('Should handle FAIL_EXCHANGE_AUTH', () => {
        const testResult = authInitialState;
        testResult.isAuth = false;

        expect(authReducer(authInitialState, { type: AuthActionTypes.FAIL_EXCHANGE_AUTH })).toEqual(
          testResult
        );
      });
    });

    describe('Caldav', () => {
      it('Should handle BEGIN_CALDAV_AUTH', () => {
        const testResult = authInitialState;
        testResult.isAuth = true;

        expect(authReducer(authInitialState, { type: AuthActionTypes.BEGIN_CALDAV_AUTH })).toEqual(
          testResult
        );
      });

      it('Should handle SUCCESS_CALDAV_AUTH', () => {
        // Duplicate Test User
        const testUser = authSampleUser;

        // Set Provider Type to Exchange
        testUser.providerType = ProviderTypes.CALDAV;
        testUser.url = ServerUrls.ICLOUD;
        testUser.caldavType = ProviderTypes.ICLOUD;

        // Fields not used by Exchange service
        delete testUser.accessTokenExpiry;
        delete testUser.accessToken;

        const testResult = authInitialState;
        testResult.isAuth = false;
        testResult.providers = {
          ...testResult.providers,
          [ProviderTypes.CALDAV]: [authSampleUser]
        };

        // Ensure that user fields are not empty
        expect(authSampleUser.personId).not.toBeNull();
        expect(authSampleUser.personId).not.toBeUndefined();
        expect(authSampleUser.personId).not.toBe('');

        expect(authSampleUser.originalId).not.toBeNull();
        expect(authSampleUser.originalId).not.toBeUndefined();
        expect(authSampleUser.originalId).not.toBe('');

        expect(authSampleUser.email).not.toBeNull();
        expect(authSampleUser.email).not.toBeUndefined();
        expect(authSampleUser.email).not.toBe('');

        expect(authSampleUser.password).not.toBeNull();
        expect(authSampleUser.password).not.toBeUndefined();
        expect(authSampleUser.password).not.toBe('');

        expect(authSampleUser.providerType).not.toBeNull();
        expect(authSampleUser.providerType).not.toBeUndefined();
        expect(authSampleUser.providerType).toBe(ProviderTypes.CALDAV);

        expect(authSampleUser.url).not.toBeNull();
        expect(authSampleUser.url).not.toBeUndefined();
        expect(authSampleUser.url).not.toBe('');

        expect(authSampleUser.caldavType).not.toBeNull();
        expect(authSampleUser.caldavType).not.toBeUndefined();
        expect(authSampleUser.caldavType).not.toBe('');

        expect(
          authReducer(authInitialState, {
            type: AuthActionTypes.SUCCESS_CALDAV_AUTH,
            payload: { user: authSampleUser }
          })
        ).toEqual(testResult);
      });

      it('Should handle FAIL_CALDAV_AUTH', () => {
        const testResult = authInitialState;
        testResult.isAuth = false;

        expect(authReducer(authInitialState, { type: AuthActionTypes.FAIL_CALDAV_AUTH })).toEqual(
          testResult
        );
      });
    });
  });

  describe('Events Reducer', () => {
    it('Should handle initial state', () => {
      expect(eventsReducer(undefined, {})).toEqual(eventsInitialState);
    });

    it('Should handle undefined action', () => {
      expect(eventsReducer(undefined, undefined)).toEqual(eventsInitialState);
    });

    it('Should handle DUPLICATE_ACTION', () => {
      expect(eventsReducer(eventsInitialState, { type: AuthActionTypes.DUPLICATE_ACTION })).toEqual(
        eventsInitialState
      );
    });

    it('Should handle RETRIEVE_STORED_EVENTS', () => {
      const testInput = authSampleUser;
      testInput.providerType = ProviderTypes.EXCHANGE;

      expect(
        eventsReducer(eventsInitialState, {
          type: AuthActionTypes.RETRIEVE_STORED_EVENTS,
          payload: { user: testInput }
        })
      ).toEqual(eventsInitialState);
    });

    it('Should handle UPDATE_STORED_EVENTS', () => {
      const testResult = eventsInitialState;
      testResult.calEvents = [...testResult.calEvents, ...mockEventData];

      expect(
        eventsReducer(eventsInitialState, {
          type: AuthActionTypes.UPDATE_STORED_EVENTS,
          payload: { resp: mockEventData }
        })
      ).toEqual(testResult);
    });

    it('Should handle SUCCESS_STORED_EVENTS', () => {
      const testResult = eventsInitialState;
      testResult.calEvents = [...testResult.calEvents, ...mockEventData];

      expect(
        eventsReducer(eventsInitialState, {
          type: AuthActionTypes.SUCCESS_STORED_EVENTS,
          payload: { resp: mockEventData }
        })
      ).toEqual(testResult);
    });

    // // Sync stored events currently is not working.
    // it('Should handle SYNC_STORED_EVENTS', () => {
    //   const testResult = eventsInitialState;
    //   testResult.calEvents = [...testResult.calEvents, ...mockEventData];

    //   expect(
    //     eventsReducer(eventsInitialState, {
    //       type: AuthActionTypes.SYNC_STORED_EVENTS,
    //       payload: { resp: mockEventData }
    //     })
    //   ).toEqual(testResult);
    // });
  });
});
