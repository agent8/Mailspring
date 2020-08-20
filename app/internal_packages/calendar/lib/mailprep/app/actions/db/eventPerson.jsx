export const STORE_EVENTPERSON_SUCCESS = 'STORE_EVENTPERSON_SUCCESS';
export const STORE_EVENTPERSON_FAILURE = 'STORE_EVENTPERSON_FAILURE';
export const STORE_EVENTPERSON_BEGIN = 'STORE_EVENTPERSON_BEGIN';

export const successStoreEventPerson = () => ({
  type: STORE_EVENTPERSON_SUCCESS
});

export const failureStoreEventPerson = () => ({
  type: STORE_EVENTPERSON_FAILURE
});

export const beginStoreEventPerson = () => ({
  type: STORE_EVENTPERSON_BEGIN
});
