import EdisonAccount from './edison-account';
import AppUpdate from './app-update';
const host = 'https://cp.stag.easilydo.cc/api/charge';

export const EdisonAccountRest = new EdisonAccount(host);
export const AppUpdateRest = new AppUpdate(host);
