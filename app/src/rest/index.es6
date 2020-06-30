import { remote } from 'electron';
import EdisonAccount from './edison-account';
import AppUpdate from './app-update';

const host = remote.getGlobal('application').edisonServerHost;

console.log(`EdisonServer:${host}`);

// must use in Renderer Process
export const EdisonAccountRest = new EdisonAccount(host);
export const AppUpdateRest = new AppUpdate(host);
