// --------------------- GOOGLE AUTH --------------------- //
export const BEGIN_GOOGLE_AUTH = 'BEGIN_GOOGLE_AUTH';
export const SUCCESS_GOOGLE_AUTH = 'SUCCESS_GOOGLE_AUTH';
export const FAIL_GOOGLE_AUTH = 'FAIL_GOOGLE_AUTH';
export const RETRY_GOOGLE_AUTH = 'RETRY_GOOGLE_AUTH';
export const EXPIRED_GOOGLE_AUTH = 'EXPIRED_GOOGLE_AUTH';

export const beginGoogleAuth = () => ({ type: BEGIN_GOOGLE_AUTH });
export const failGoogleAuth = () => ({ type: FAIL_GOOGLE_AUTH });
export const successGoogleAuth = (user) => ({
  type: SUCCESS_GOOGLE_AUTH,
  payload: user
});
export const expiredGoogleAuth = (user) => ({
  type: EXPIRED_GOOGLE_AUTH,
  payload: user
});
// --------------------- GOOGLE AUTH --------------------- //

// --------------------- OUTLOOK AUTH -------------------- //
export const BEGIN_OUTLOOK_AUTH = 'BEGIN_OUTLOOK_AUTH';
export const SUCCESS_OUTLOOK_AUTH = 'SUCCESS_OUTLOOK_AUTH';
export const FAIL_OUTLOOK_AUTH = 'FAIL_OUTLOOK_AUTH';
export const RETRY_OUTLOOK_AUTH = 'RETRY_OUTLOOK_AUTH';
export const EXPIRED_OUTLOOK_AUTH = 'EXPIRED_OUTLOOK_AUTH';

export const beginOutlookAuth = () => ({ type: BEGIN_OUTLOOK_AUTH });
export const failOutlookAuth = () => ({ type: FAIL_OUTLOOK_AUTH });
export const successOutlookAuth = (user) => ({
  type: SUCCESS_OUTLOOK_AUTH,
  payload: user
});
export const expiredOutlookAuth = (user) => ({
  type: EXPIRED_OUTLOOK_AUTH,
  payload: user
});
// --------------------- OUTLOOK AUTH -------------------- //

// --------------------- EXCHANGE AUTH -------------------- //
export const BEGIN_EXCHANGE_AUTH = 'BEGIN_EXCHANGE_AUTH';
export const SUCCESS_EXCHANGE_AUTH = 'SUCCESS_EXCHANGE_AUTH';
export const FAIL_EXCHANGE_AUTH = 'FAIL_EXCHANGE_AUTH';
export const RETRY_EXCHANGE_AUTH = 'RETRY_EXCHANGE_AUTH';

export const beginExchangeAuth = (user) => ({
  type: BEGIN_EXCHANGE_AUTH,
  payload: user
});
export const failExchangeAuth = () => ({ type: FAIL_EXCHANGE_AUTH });
export const successExchangeAuth = (user) => ({
  type: SUCCESS_EXCHANGE_AUTH,
  payload: user
});
// --------------------- EXCHANGE AUTH -------------------- //

// --------------------- CALDAV AUTH -------------------- //
export const BEGIN_CALDAV_AUTH = 'BEGIN_CALDAV_AUTH';
export const SUCCESS_CALDAV_AUTH = 'SUCCESS_CALDAV_AUTH';
export const FAIL_CALDAV_AUTH = 'FAIL_CALDAV_AUTH';
export const RETRY_CALDAV_AUTH = 'RETRY_CALDAV_AUTH';

export const beginCaldavAuth = (user) => ({
  type: BEGIN_CALDAV_AUTH,
  payload: user
});
export const failCaldavAuth = () => ({ type: FAIL_CALDAV_AUTH });
export const successCaldavAuth = (user) => ({
  type: SUCCESS_CALDAV_AUTH,
  payload: user
});
// --------------------- CALDAV AUTH -------------------- //
