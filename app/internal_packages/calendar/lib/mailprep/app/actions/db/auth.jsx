export const SUCCESS_STORE_AUTH = 'SUCCESS_STORE_AUTH';
export const FAIL_STORE_AUTH = 'FAIL_STORE_AUTH';

export const successStoreAuth = () => ({
  type: SUCCESS_STORE_AUTH
});

export const failStoreAuth = () => ({
  type: FAIL_STORE_AUTH
});
