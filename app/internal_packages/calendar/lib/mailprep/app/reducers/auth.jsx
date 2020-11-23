import * as AuthActionTypes from '../actions/auth';
import * as ProviderTypes from '../utils/constants';

const initialState = {
  providers: {
    [ProviderTypes.GOOGLE]: [],
    [ProviderTypes.OUTLOOK]: [],
    [ProviderTypes.EXCHANGE]: [],
    [ProviderTypes.CALDAV]: []
  },
  expiredProviders: {
    [ProviderTypes.GOOGLE]: [],
    [ProviderTypes.OUTLOOK]: [],
    [ProviderTypes.EXCHANGE]: [], // Unsure if needed, as no time limit on exchange providers.
    [ProviderTypes.CALDAV]: [] // Unsure if needed, as no time limit on some caldav providers.
  },
  isAuth: false,
  currentUser: null // currentUser is here bcuz of google auth. Not sure how to append it over yet.
};

export default function authReducer(state = initialState, action) {
  if (action === undefined) {
    return state;
  }
  switch (action.type) {
    // ----------------------------------------------- GOOGLE ----------------------------------------------- //
    case AuthActionTypes.BEGIN_GOOGLE_AUTH:
      return Object.assign({}, state, { isAuth: true, currentUser: null });
    case AuthActionTypes.SUCCESS_GOOGLE_AUTH:
      return Object.assign({}, state, {
        isAuth: false,
        providers: {
          ...state.providers,
          [ProviderTypes.GOOGLE]:
            state.providers[ProviderTypes.GOOGLE].filter(
              (e) => e.personId === action.payload.user.personId
            ).length > 0
              ? state.providers[ProviderTypes.GOOGLE].map((e) =>
                e.personId === action.payload.user.personId
                  ? { ...action.payload.user, calendars: action.payload.calendars }
                  : e
              )
              : state.providers[ProviderTypes.GOOGLE]
                .concat({
                  ...action.payload.user,
                  calendars: action.payload.calendars
                })
        },
        expiredProviders: {
          [ProviderTypes.GOOGLE]: state.expiredProviders[ProviderTypes.GOOGLE].filter(
            (user) => user.originalId !== action.payload.user.originalId
          ),
          [ProviderTypes.OUTLOOK]: state.expiredProviders[ProviderTypes.OUTLOOK]
        }
      });
    case AuthActionTypes.FAIL_GOOGLE_AUTH:
      return Object.assign({}, state, { isAuth: false, currentUser: null });
    case AuthActionTypes.EXPIRED_GOOGLE_AUTH:
      return Object.assign({}, state, {
        isAuth: false,
        expiredProviders: {
          ...state.expiredProviders,
          [ProviderTypes.GOOGLE]:
            state.expiredProviders[ProviderTypes.GOOGLE].filter(
              (e) => e.personId === action.payload.user.personId
            ).length > 0
              ? state.expiredProviders[ProviderTypes.GOOGLE]
              : state.expiredProviders[ProviderTypes.GOOGLE].concat(action.payload.user)
        }
      });
    // ----------------------------------------------- GOOGLE ----------------------------------------------- //

    // ----------------------------------------------- OUTLOOK ----------------------------------------------- //
    case AuthActionTypes.BEGIN_OUTLOOK_AUTH:
      return Object.assign({}, state, { isAuth: true, currentUser: null });
    case AuthActionTypes.SUCCESS_OUTLOOK_AUTH:
      return Object.assign({}, state, {
        isAuth: false,
        providers: {
          ...state.providers,
          [ProviderTypes.OUTLOOK]:
            state.providers[ProviderTypes.OUTLOOK].filter(
              (e) => e.personId === action.payload.user.personId
            ).length > 0
              ? state.providers[ProviderTypes.OUTLOOK].map((e) =>
                e.personId === action.payload.user.personId ? action.payload.user : e
              )
              : state.providers[ProviderTypes.OUTLOOK].concat(action.payload.user)
        },
        expiredProviders: {
          ...state.expiredProviders,
          [ProviderTypes.OUTLOOK]: state.expiredProviders[ProviderTypes.OUTLOOK].filter(
            (user) => user.originalId !== action.payload.user.originalId
          )
        }
      });
    case AuthActionTypes.FAIL_OUTLOOK_AUTH:
      return Object.assign({}, state, { isAuth: false, currentUser: null });
    case AuthActionTypes.EXPIRED_OUTLOOK_AUTH:
      return Object.assign({}, state, {
        isAuth: false,
        expiredProviders: {
          ...state.expiredProviders,
          [ProviderTypes.OUTLOOK]:
            state.expiredProviders[ProviderTypes.OUTLOOK].filter(
              (e) => e.personId === action.payload.user.personId
            ).length > 0
              ? state.expiredProviders[ProviderTypes.OUTLOOK]
              : state.expiredProviders[ProviderTypes.OUTLOOK].concat(action.payload.user)
        }
      });
    // ----------------------------------------------- OUTLOOK ----------------------------------------------- //

    // ----------------------------------------------- EXCHANGE ----------------------------------------------- //
    case AuthActionTypes.BEGIN_EXCHANGE_AUTH:
      return Object.assign({}, state, { isAuth: true, currentUser: null });
    case AuthActionTypes.SUCCESS_EXCHANGE_AUTH:
      return Object.assign({}, state, {
        isAuth: false,
        providers: {
          ...state.providers,
          [ProviderTypes.EXCHANGE]:
            state.providers[ProviderTypes.EXCHANGE].filter(
              (e) => e.personId === action.payload.user.personId
            ).length > 0
              ? state.providers[ProviderTypes.EXCHANGE].map((e) =>
                e.personId === action.payload.user.personId ? action.payload.user : e
              )
              : state.providers[ProviderTypes.EXCHANGE].concat(action.payload.user)
        },
        expiredProviders: {
          ...state.expiredProviders,
          [ProviderTypes.EXCHANGE]: state.expiredProviders[ProviderTypes.EXCHANGE]
          // Don't need this as exchange users never expire due to no oauth yet
          // [ProviderTypes.EXCHANGE]: state.expiredProviders[ProviderTypes.EXCHANGE].filter(user => user.originalId !== action.payload.user.originalId)
        }
      });
    case AuthActionTypes.FAIL_EXCHANGE_AUTH:
      return Object.assign({}, state, { isAuth: false, currentUser: null });
    // ----------------------------------------------- EXCHANGE ----------------------------------------------- //

    // ----------------------------------------------- CALDAV ----------------------------------------------- //
    case AuthActionTypes.BEGIN_CALDAV_AUTH:
      return Object.assign({}, state, { isAuth: true, currentUser: null });
    case AuthActionTypes.SUCCESS_CALDAV_AUTH:
      return Object.assign({}, state, {
        isAuth: false,
        providers: {
          ...state.providers,
          [ProviderTypes.CALDAV]:
            state.providers[ProviderTypes.CALDAV].filter(
              (e) => e.personId === action.payload.user.personId
            ).length > 0
              ? state.providers[ProviderTypes.CALDAV].map((e) =>
                e.personId === action.payload.user.personId ? action.payload.user : e
              )
              : state.providers[ProviderTypes.CALDAV].concat(action.payload.user)
        },
        expiredProviders: {
          ...state.expiredProviders,
          [ProviderTypes.CALDAV]: state.expiredProviders[ProviderTypes.CALDAV]
          // Don't need this as exchange users never expire due to no oauth yet
          // [ProviderTypes.EXCHANGE]: state.expiredProviders[ProviderTypes.EXCHANGE].filter(user => user.originalId !== action.payload.user.originalId)
        }
      });
    case AuthActionTypes.FAIL_CALDAV_AUTH:
      return Object.assign({}, state, { isAuth: false, currentUser: null });
    // ----------------------------------------------- CALDAV ----------------------------------------------- //
    default:
      return state;
  }
}
