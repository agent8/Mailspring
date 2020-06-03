import EdisonAccount from './edison-account';
import AppUpdate from './app-update';

const devHost = 'https://cp.stag.easilydo.cc';
const proHost = 'https://cp.edison.tech';
const host = proHost;
export const EdisonAccountRest = new EdisonAccount(host);
export const AppUpdateRest = new AppUpdate(host);
