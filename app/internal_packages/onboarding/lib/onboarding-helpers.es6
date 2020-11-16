/* eslint global-require: 0 */

import crypto from 'crypto';
import { Account, IdentityStore, MailsyncProcess, Actions, AccountStore } from 'mailspring-exports';
import MailspringProviderSettings from './mailspring-provider-settings';
import MailcoreProviderSettings from './mailcore-provider-settings';
import OnboardingActions from './onboarding-actions';
import dns from 'dns';
import path from 'path';
import util from 'util';
import fs from 'fs';
const regexpForDomain = test => new RegExp(`(^${test}$)`);
const writeFile = util.promisify(fs.writeFile);

const queryStringify = (data, encoded = false) => {
  const queryString = Object.keys(data)
    .map(key => {
      if (encoded === true) {
        return encodeURIComponent(`${key}`) + '=' + encodeURIComponent(`${data[key]}`);
      } else {
        return `${key}=${data[key]}`;
      }
    })
    .join('&');
  return queryString;
};

const EDISON_OAUTH_KEYWORD = 'edison_desktop';
const EDISON_REDIRECT_URI = 'http://email.easilydo.com';
const NEW_EDISON_REDIRECT_URI = 'https://mail.edison.tech/oauthsuccess.html';

export const LOCAL_SERVER_PORT = 12141;
export const LOCAL_REDIRECT_URI = `http://127.0.0.1:${LOCAL_SERVER_PORT}`;
const GMAIL_CLIENT_ID = '533632962939-g0m1obkdahbh4pva3rohik5skarb2pon.apps.googleusercontent.com';
const GMAIL_CLIENT_SECRET = 'rOtn7n4eAfzsMqQhAzvOE0Ak';
const GMAIL_SCOPES = [
  // Edison
  'https://mail.google.com/',
  'email',
  'https://www.google.com/m8/feeds',
  'email',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'profile',
  'https://www.googleapis.com/auth/calendar'

const GMAIL_CALENDAR_CLIENT_ID =
  '190108842853-2o3l63c3qlgjjg4pp2v9suoacrbfpgva.apps.googleusercontent.com';
const GMAIL_CALENDAR_CLIENT_SECRET = 'atSqQBGyYhlJAba9NiZe47r6';
const GMAIL_CALENDAR_SCOPES = [
  // Edison
  'https://mail.google.com/',
  'email',
  'https://www.google.com/m8/feeds',
  'email',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'profile',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

const JIRA_CLIENT_ID = 'k5w4G817nXJRIEpss2GYizMxpTXbl7tn';
const JIRA_CLIENT_SECRET = 'cSTiX-4hpKKgwHSGdwgRSK5moMypv_v1-CIfTcWWJC8BkA2E0O0vK7CYhdglbIDE';
const JIRA_SCOPES = [
  'read:me',
  'read:jira-user',
  'read:jira-work',
  'write:jira-work',
  'offline_access',
  'manage:jira-project',
];

const YAHOO_CLIENT_ID =
  'dj0yJmk9VDB0enNwSE54Tk1CJmQ9WVdrOU1saDZNRWt4TmpJbWNHbzlNQS0tJnM9Y29uc3VtZXJzZWNyZXQmeD1jZA--';
const YAHOO_CLIENT_SECRET = '5edd54d7240d0ae74594d4806cdf69c72a6e9fa5';

const OFFICE365_CLIENT_ID = '62db40a4-2c7e-4373-a609-eda138798962';
const OFFICE365_CLIENT_SECRET = 'lj9US4uHiIYYs]ew?vU6C?E0?zt:qw41';
// const OFFICE365_SCOPES = ['user.read', 'mail.read', 'mail.send', 'offline_access'];
const OFFICE365_SCOPES = [
  'user.read',
  'EWS.AccessAsUser.All',
  'offline_access',
  'profile',
  'openid',
];

const OUTLOOK_CLIENT_ID = '00000000443D1B02';
const OUTLOOK_CLIENT_SECRET = 'rpCRHB7(-hiexsVPN1351}{';
const OUTLOOK_SCOPES = ['wl.basic', 'wl.emails', 'wl.imap', 'wl.offline_access'];
// const OUTLOOK_SCOPES = ['Contacts.Read', 'Mail.ReadWrite', 'Mail.Send', 'offline_access', 'openid'];

function idForAccount(emailAddress, connectionSettings) {
  // changing your connection security settings / ports shouldn't blow
  // away everything and trash your metadata. Just look at critiical fields.
  // (Me adding more connection settings fields shouldn't break account Ids either!)
  const settingsThatCouldChangeMailContents = {
    imap_username: connectionSettings.imap_username,
    imap_host: connectionSettings.imap_host,
    smtp_username: connectionSettings.smtp_username,
    smtp_host: connectionSettings.smtp_host,
  };

  const idString = `${emailAddress}${JSON.stringify(settingsThatCouldChangeMailContents)}`;
  return crypto
    .createHash('sha256')
    .update(idString, 'utf8')
    .digest('hex')
    .substr(0, 8);
}

function mxRecordsForDomain(domain) {
  return new Promise((resolve, reject) => {
    dns.resolveMx(domain, (err, addresses) => {
      if (err) {
        resolve([]);
      } else {
        resolve(addresses.map(a => a.exchange.toLowerCase()));
      }
    });
  });
}

async function edisonFetch(url, options) {
  try {
    const resp = await fetch(url, options);
    return resp;
  } catch (err) {
    AppEnv.reportError(new Error(`onboarding-helpers fetch failed`), {
      errorData: {
        error: err,
        url,
      },
    });
    throw new Error('Please check network connection and try again.');
  }
}

export function validateEmailAddressForProvider(emailAddress = '', provider = null) {
  if (!provider) {
    return { ret: false, message: 'Email entered is not valid.' };
  }
  if (provider.provider === 'imap') {
    return { ret: true };
  }
  const domain = emailAddress
    .split('@')
    .pop()
    .toLowerCase();
  let template = MailcoreProviderSettings[provider.provider];
  mxRecordsForDomain(domain).then(mxRecords => {
    if (template) {
      for (const test of template['mx-match'] || []) {
        const reg = regexpForDomain(test);
        if (mxRecords.some(record => reg.test(record))) {
          return { ret: true };
        }
      }
    }
  });
  if (template) {
    for (const test of template['domain-match'] || []) {
      if (regexpForDomain(test).test(domain)) {
        return { ret: true };
      }
    }
  }
  template = MailspringProviderSettings[provider.defaultDomain];
  let provideAlias = '';
  let fromAlias = false;
  if (template && template.alias) {
    provideAlias = template.alias;
    fromAlias = true;
    template = MailspringProviderSettings[template.alias];
  }
  if (template) {
    let tmp = MailspringProviderSettings[domain];
    if (tmp && tmp.imap_host && tmp.imap_host === template.imap_host && !fromAlias) {
      return { ret: true };
    }
    if (
      tmp &&
      !tmp.imap_host &&
      (tmp.alias === provider.defaultDomain || tmp.alias === provideAlias)
    ) {
      return { ret: true };
    }
    if (provider.incorrectEmail) {
      return { ret: false, message: provider.incorrectEmail };
    }
  }
  return { ret: false, message: `Entered email is not a valid ${provider.displayName} address.` };
}

export async function expandAccountWithCommonSettings(account, forceDomain = null) {
  const domain = account.emailAddress
    .split('@')
    .pop()
    .toLowerCase();
  const mxRecords = await mxRecordsForDomain(forceDomain || domain);
  const populated = account.clone();

  const usernameWithFormat = format => {
    if (format === 'email') return account.emailAddress;
    if (format === 'email-without-domain') return account.emailAddress.split('@').shift();
    return undefined;
  };

  // find matching template using new Mailcore lookup tables. These match against the
  // email's domain and the mx records for the domain, which means it will identify that
  // "foundry376.com" uses Google Apps, for example.
  let template;
  let providerKey = Object.keys(MailcoreProviderSettings).find(k => {
    const p = MailcoreProviderSettings[k];
    for (const test of p['domain-match'] || []) {
      if (regexpForDomain(test).test(forceDomain || domain)) {
        // domain-exclude
        for (const testExclude of p['domain-exclude'] || []) {
          if (new RegExp(`^${testExclude}$`).test(forceDomain || domain)) {
            return false;
          }
        }
        return true;
      }
    }
    return false;
  });
  if (!providerKey) {
    providerKey = Object.keys(MailcoreProviderSettings).find(k => {
      const p = MailcoreProviderSettings[k];
      for (const test of p['mx-match'] || []) {
        const reg = regexpForDomain(test);
        if (mxRecords.some(record => reg.test(record))) {
          return true;
        }
      }
      return false;
    });
  }

  if (providerKey) {
    template = MailcoreProviderSettings[providerKey];
    console.log(`Using Mailcore Template: ${JSON.stringify(template, null, 2)}`);
    const imap = (template.servers.imap || [])[0] || {};
    const smtp = (template.servers.smtp || [])[0] || {};
    const defaults = {
      provider_key: providerKey,
      imap_host: imap.hostname.replace('{domain}', domain),
      imap_port: imap.port,
      imap_username: usernameWithFormat('email'),
      imap_password: populated.settings.imap_password,
      imap_security: imap.starttls ? 'STARTTLS' : imap.ssl ? 'SSL / TLS' : 'none',
      imap_allow_insecure_ssl: false,

      smtp_host: smtp.hostname.replace('{domain}', domain),
      smtp_port: smtp.port,
      smtp_username: usernameWithFormat('email'),
      smtp_password: populated.settings.smtp_password || populated.settings.imap_password,
      smtp_security: smtp.starttls ? 'STARTTLS' : smtp.ssl ? 'SSL / TLS' : 'none',
      smtp_allow_insecure_ssl: false,
    };
    populated.settings = Object.assign(defaults, populated.settings);
    populated.mailsync = Object.assign(AppEnv.config.get('core.mailsync'), populated.mailsync);
    if (populated.mailsync.accounts) {
      delete populated.mailsync.accounts;
    }
    return populated;
  }

  // find matching template by domain or provider in the old lookup tables
  // this matches the account type presets ("yahoo") and common domains against
  // data derived from Thunderbirds ISPDB.
  template =
    MailspringProviderSettings[forceDomain || domain] ||
    MailspringProviderSettings[account.provider];
  if (template) {
    if (template.alias) {
      template = MailspringProviderSettings[template.alias];
    }
    console.log(`Using EdisonMail Template: ${JSON.stringify(template, null, 2)}`);
  } else {
    console.log(`Using Empty Template`);
    template = {};
  }

  const defaults = {
    imap_host: template.imap_host,
    imap_port: template.imap_port || 993,
    imap_username: usernameWithFormat(template.imap_user_format),
    imap_password: populated.settings.imap_password,
    imap_security: template.imap_security || 'SSL / TLS',
    imap_allow_insecure_ssl: template.imap_allow_insecure_ssl || false,
    smtp_host: template.smtp_host,
    smtp_port: template.smtp_port || 587,
    smtp_username: usernameWithFormat(template.smtp_user_format),
    smtp_password: populated.settings.smtp_password || populated.settings.imap_password,
    smtp_security: template.smtp_security || 'STARTTLS',
    smtp_allow_insecure_ssl: template.smtp_allow_insecure_ssl || false,
  };
  populated.settings = Object.assign(defaults, populated.settings);
  populated.mailsync = Object.assign(AppEnv.config.get('core.mailsync'), populated.mailsync);
  return populated;
}

export async function buildOffice365AccountFromAuthResponse(code) {
  /// Exchange code for an access token
  const body = [];
  body.push(`code=${encodeURIComponent(code)}`);
  body.push(`client_id=${encodeURIComponent(OFFICE365_CLIENT_ID)}`);
  body.push(`client_secret=${encodeURIComponent(OFFICE365_CLIENT_SECRET)}`);
  body.push(`redirect_uri=${encodeURIComponent(NEW_EDISON_REDIRECT_URI)}`);
  body.push(`grant_type=${encodeURIComponent('authorization_code')}`);

  const resp = await edisonFetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    body: body.join('&'),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
  });

  const json = (await resp.json()) || {};
  if (!resp.ok) {
    throw new Error(
      `Office365 OAuth Code exchange returned ${resp.status} ${resp.statusText}: ${JSON.stringify(
        json
      )}`
    );
  }
  const { access_token, refresh_token } = json;

  // get the user's email address
  const meResp = await edisonFetch('https://graph.microsoft.com/v1.0/me', {
    method: 'GET',
    headers: {
      Authorization: `${access_token}`,
      'Content-Type': 'application/json',
    },
  });
  const me = await meResp.json();
  if (!meResp.ok) {
    throw new Error(
      `Office365 profile request returned ${resp.status} ${resp.statusText}: ${JSON.stringify(me)}`
    );
  }
  console.log('****json', json, me);

  const emailAddress = me.mail || me.userPrincipalName;

  // get user self picture
  let picturePath;
  try {
    const photoResp = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
      method: 'GET',
      headers: {
        Authorization: `${access_token}`,
        'Content-Type': 'application/json',
      },
    });
    if (photoResp.ok) {
      const buffer = await photoResp.arrayBuffer();
      picturePath = path.join(AppEnv.getConfigDirPath(), 'logo_cache', `${emailAddress}.png`);
      await writeFile(picturePath, Buffer.from(buffer), { encoding: 'binary' });
    }
  } catch (err) {
    picturePath = null;
    console.log('This office365 account have no photo', err);
  }
  console.log('*****picturePath', picturePath);
  const account = await expandAccountWithCommonSettings(
    new Account({
      name: me.displayName,
      emailAddress: emailAddress,
      provider: 'office365-exchange',
      settings: {
        refresh_client_id: OFFICE365_CLIENT_ID,
        refresh_token: refresh_token,
      },
    })
  );

  // check if there is an old Office365 account
  const oldOffice365Acc = AccountStore.accountForEmail({ email: emailAddress });
  if (
    oldOffice365Acc &&
    (oldOffice365Acc.settings.provider_key === 'office365' ||
      oldOffice365Acc.provider === 'exchange')
  ) {
    OnboardingActions.moveToPage('account-choose');
    AppEnv.showErrorDialog({
      title: 'Unable to Add Account',
      message: `Please remove your ${emailAddress} account first, and try again.`,
    });
    return;
  }

  account.id = idForAccount(emailAddress, account.settings);
  if (picturePath) {
    account.picture = picturePath;
  }

  // test the account locally to ensure the All Mail folder is enabled
  // and the refresh token can be exchanged for an account token.
  return await finalizeAndValidateAccount(account);
}

export async function buildOutlookAccountFromAuthResponse(code) {
  /// Exchange code for an access token
  const body = [];
  body.push(`code=${encodeURIComponent(code)}`);
  body.push(`client_id=${encodeURIComponent(OUTLOOK_CLIENT_ID)}`);
  body.push(`client_secret=${encodeURIComponent(OUTLOOK_CLIENT_SECRET)}`);
  body.push(`redirect_uri=${encodeURIComponent(NEW_EDISON_REDIRECT_URI)}`);
  body.push(`grant_type=${encodeURIComponent('authorization_code')}`);

  // const resp = await edisonFetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
  const resp = await edisonFetch('https://login.live.com/oauth20_token.srf', {
    method: 'POST',
    body: body.join('&'),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
  });

  const json = (await resp.json()) || {};
  if (!resp.ok) {
    throw new Error(
      `Office365 OAuth Code exchange returned ${resp.status} ${resp.statusText}: ${JSON.stringify(
        json
      )}`
    );
  }
  const { access_token, refresh_token } = json;

  // get the user's email address
  // const meResp = await edisonFetch('https://graph.microsoft.com/v1.0/me', {
  const meResp = await edisonFetch('https://apis.live.net/v5.0/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });
  const me = await meResp.json();
  if (!meResp.ok) {
    throw new Error(
      `Outlook profile request returned ${resp.status} ${resp.statusText}: ${JSON.stringify(me)}`
    );
  }

  // const meResp2 = await edisonFetch('https://apis.live.net/v5.0/me/picture', {
  //   method: 'GET',
  //   headers: {
  //     Authorization: `Bearer ${access_token}`,
  //   },
  // });
  // const me2 = await meResp2.json();
  // debugger;

  const account = await expandAccountWithCommonSettings(
    new Account({
      name: me.name,
      emailAddress: me.emails.account,
      provider: 'outlook',
      settings: {
        refresh_client_id: OUTLOOK_CLIENT_ID,
        refresh_token: refresh_token,
      },
    })
  );

  account.id = idForAccount(me.email, account.settings);
  account.picture = me.picture;

  // test the account locally to ensure the All Mail folder is enabled
  // and the refresh token can be exchanged for an account token.
  return await finalizeAndValidateAccount(account);
}

export async function buildGmailAccountFromAuthResponse(code) {
  /// Exchange code for an access token
  const body = [];
  body.push(`code=${encodeURIComponent(code)}`);
  body.push(`client_id=${encodeURIComponent(GMAIL_CLIENT_ID)}`);
  body.push(`client_secret=${encodeURIComponent(GMAIL_CLIENT_SECRET)}`);
  body.push(`redirect_uri=${encodeURIComponent(NEW_EDISON_REDIRECT_URI)}`);
  body.push(`grant_type=${encodeURIComponent('authorization_code')}`);

  const resp = await edisonFetch('https://www.googleapis.com/oauth2/v4/token', {
    method: 'POST',
    body: body.join('&'),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
  });

  const json = (await resp.json()) || {};
  if (!resp.ok) {
    throw new Error(
      `Gmail OAuth Code exchange returned ${resp.status} ${resp.statusText}: ${JSON.stringify(
        json
      )}`
    );
  }
  const { access_token, refresh_token } = json;

  // get the user's email address
  const meResp = await edisonFetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
    method: 'GET',
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const me = await meResp.json();
  if (!meResp.ok) {
    throw new Error(
      `Gmail profile request returned ${resp.status} ${resp.statusText}: ${JSON.stringify(me)}`
    );
  }
  const account = await expandAccountWithCommonSettings(
    new Account({
      name: me.name,
      emailAddress: me.email,
      provider: 'gmail',
      settings: {
        refresh_client_id: GMAIL_CLIENT_ID,
        refresh_token: refresh_token,
      },
    }),
    'gmail.com'
  );

  account.id = idForAccount(me.email, account.settings);
  account.picture = me.picture;

  // test the account locally to ensure the All Mail folder is enabled
  // and the refresh token can be exchanged for an account token.
  return await finalizeAndValidateAccount(account);
}

export async function buildGmailCalendarAccountFromAuthResponse(code) {
  /// Exchange code for an access token
  const body = [];
  body.push(`code=${encodeURIComponent(code)}`);
  body.push(`client_id=${encodeURIComponent(GMAIL_CALENDAR_CLIENT_ID)}`);
  body.push(`client_secret=${encodeURIComponent(GMAIL_CALENDAR_CLIENT_SECRET)}`);
  body.push(`redirect_uri=${encodeURIComponent(NEW_EDISON_REDIRECT_URI)}`);
  body.push(`grant_type=${encodeURIComponent('authorization_code')}`);

  const resp = await edisonFetch('https://www.googleapis.com/oauth2/v4/token', {
    method: 'POST',
    body: body.join('&'),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
  });

  const json = (await resp.json()) || {};
  if (!resp.ok) {
    throw new Error(
      `Gmail OAuth Code exchange returned ${resp.status} ${resp.statusText}: ${JSON.stringify(
        json
      )}`
    );
  }
  const { access_token, refresh_token } = json;

  // get the user's email address
  const meResp = await edisonFetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
    method: 'GET',
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const me = await meResp.json();
  if (!meResp.ok) {
    throw new Error(
      `Gmail profile request returned ${resp.status} ${resp.statusText}: ${JSON.stringify(me)}`
    );
  }
  const account = await expandAccountWithCommonSettings(
    new Account({
      name: me.name,
      emailAddress: me.email,
      provider: 'gmail',
      settings: {
        refresh_client_id: GMAIL_CLIENT_ID,
        refresh_token: refresh_token,
      },
    }),
    'gmail.com'
  );

  account.id = idForAccount(me.email, account.settings);
  account.picture = me.picture;

  AppEnv.config.set('plugin.calendar.config', { access_token, refresh_token });
  // wait some time for Event tracking
  await new Promise(resolve => setTimeout(resolve, 1000));
  AppEnv.close();
}

export async function buildJiraAccountFromAuthResponse(code) {
  /// Exchange code for an access token
  const body = [];
  body.push(`code=${encodeURIComponent(code)}`);
  body.push(`client_id=${encodeURIComponent(JIRA_CLIENT_ID)}`);
  body.push(`redirect_uri=${encodeURIComponent(NEW_EDISON_REDIRECT_URI)}`);
  body.push(`client_secret=${encodeURIComponent(JIRA_CLIENT_SECRET)}`);
  body.push(`grant_type=${encodeURIComponent('authorization_code')}`);

  const resp = await edisonFetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    body: body.join('&'),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
  });

  const json = (await resp.json()) || {};
  if (!resp.ok) {
    throw new Error(
      `Jira OAuth Code exchange returned ${resp.status} ${resp.statusText}: ${JSON.stringify(json)}`
    );
  }
  const { access_token, refresh_token } = json;

  const resourcesResp = await edisonFetch(
    'https://api.atlassian.com/oauth/token/accessible-resources',
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: 'application/json',
      },
    }
  );
  const resources = await resourcesResp.json();
  if (!resourcesResp.ok) {
    throw new Error(
      `Jira resources request returned ${resp.status} ${resp.statusText}: ${JSON.stringify(me)}`
    );
  }
  let resource = {};
  if (resources && resources.length > 0) {
    resource = resources[0];
    AppEnv.trackingEvent('plugin-jira-onboarding-success', {
      domain: resource.url,
      name: resource.name,
    });
  } else {
    AppEnv.close();
    return;
  }
  AppEnv.config.set('plugin.jira.config', { access_token, refresh_token, resource });
  // wait some time for Event tracking
  await new Promise(resolve => setTimeout(resolve, 1000));
  AppEnv.close();
}

export async function buildYahooAccountFromAuthResponse(code) {
  const body = [
    `client_id=${encodeURIComponent(YAHOO_CLIENT_ID)}`,
    `client_secret=${encodeURIComponent(YAHOO_CLIENT_SECRET)}`,
    `code=${encodeURIComponent(code)}`,
    'grant_type=authorization_code',
    `redirect_uri=${encodeURIComponent(NEW_EDISON_REDIRECT_URI)}`,
  ].join('&');

  const resp = await edisonFetch('https://api.login.yahoo.com/oauth2/get_token', {
    method: 'POST',
    body: body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
  });

  const json = (await resp.json()) || {};
  if (!resp.ok) {
    throw new Error(
      `Yahoo OAuth Code exchange returned ${resp.status} ${resp.statusText}: ${JSON.stringify(
        json
      )}`
    );
  }

  // extracting access and refresh tokens
  const { access_token, refresh_token, xoauth_yahoo_guid } = json;

  // get the user's email address
  const meResp = await edisonFetch('https://api.login.yahoo.com/openid/v1/userinfo?format=json', {
    method: 'GET',
    headers: { Authorization: `Bearer ${access_token}` },
  });

  const me = await meResp.json();
  if (!meResp.ok) {
    AppEnv.trackingEvent('oauth-yahoo-profile-failed');
    AppEnv.reportError(
      new Error(
        `Yahoo profile request returned ${resp.status} ${resp.statusText}: ${JSON.stringify(me)}`
      )
    );
    me = {
      given_name: '',
      family_name: '',
    };
  }

  const { given_name, family_name } = me;

  let fullName = given_name;
  if (family_name) {
    fullName += ` ${family_name}`;
  }

  let email = fullName ? fullName + '/Yahoo' : 'Yahoo';
  if (me.email) {
    email = me.email;
  }

  const account = await expandAccountWithCommonSettings(
    new Account({
      name: fullName,
      emailAddress: email,
      provider: 'yahoo',
      settings: {
        refresh_client_id: YAHOO_CLIENT_ID,
        refresh_token: refresh_token,
      },
    }),
    'yahoo.com'
  );
  account.settings.imap_username = account.settings.smtp_username = xoauth_yahoo_guid;

  account.id = idForAccount(email, account.settings);
  account.picture = me.picture;

  // test the account locally to ensure the All Mail folder is enabled
  // and the refresh token can be exchanged for an account token.
  return await finalizeAndValidateAccount(account);
}

export function buildOffice365AuthURL() {
  return (
    `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` +
    `?` +
    `client_id=${OFFICE365_CLIENT_ID}` +
    `&prompt=consent` +
    `&scope=${encodeURIComponent(OFFICE365_SCOPES.join(' '))}` +
    `&redirect_uri=${encodeURIComponent(NEW_EDISON_REDIRECT_URI)}` +
    `&state=${EDISON_OAUTH_KEYWORD}` +
    `&response_type=code`
  );
}

export function buildOutlookAuthURL() {
  return (
    // `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` +
    `https://login.live.com/oauth20_authorize.srf` +
    `?` +
    `client_id=${OUTLOOK_CLIENT_ID}` +
    `&scope=${encodeURIComponent(OUTLOOK_SCOPES.join(' '))}` +
    `&redirect_uri=${encodeURIComponent(NEW_EDISON_REDIRECT_URI)}` +
    `&state=${EDISON_OAUTH_KEYWORD}` +
    `&response_type=code`
  );
}

export function buildYahooAuthURL() {
  return (
    `https://api.login.yahoo.com/oauth2/request_auth` +
    `?` +
    `client_id=${YAHOO_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(NEW_EDISON_REDIRECT_URI)}` +
    `&state=${EDISON_OAUTH_KEYWORD}` +
    `&response_type=code`
  );
}

export function buildGmailAuthURL() {
  return (
    `https://accounts.google.com/o/oauth2/auth` +
    `?` +
    `client_id=${GMAIL_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(NEW_EDISON_REDIRECT_URI)}` +
    `&response_type=code` +
    `&prompt=consent` +
    `&scope=${encodeURIComponent(GMAIL_SCOPES.join(' '))}` +
    `&access_type=offline` +
    `&select_account%20consent`
  );
}

export function buildGmailCalendarAuthURL() {
  return (
    `https://accounts.google.com/o/oauth2/auth` +
    `?` +
    `client_id=${GMAIL_CALENDAR_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(NEW_EDISON_REDIRECT_URI)}` +
    `&response_type=code` +
    `&prompt=consent` +
    `&scope=${encodeURIComponent(GMAIL_CALENDAR_SCOPES.join(' '))}` +
    `&access_type=offline` +
    `&select_account%20consent`
  );
}

export function buildJiraAuthURL() {
  return (
    `https://auth.atlassian.com/authorize?` +
    `audience=api.atlassian.com&client_id=${JIRA_CLIENT_ID}` +
    `&scope=${encodeURIComponent(JIRA_SCOPES.join(' '))}` +
    `&redirect_uri=${encodeURIComponent(NEW_EDISON_REDIRECT_URI)}` +
    `&state=${EDISON_OAUTH_KEYWORD}&response_type=code&prompt=consent`
  );
}

export async function finalizeAndValidateAccount(account) {
  if (account.settings.imap_host) {
    account.settings.imap_host = account.settings.imap_host.trim();
  }
  if (account.settings.smtp_host) {
    account.settings.smtp_host = account.settings.smtp_host.trim();
  }

  account.id = idForAccount(account.emailAddress, account.settings);

  // handle special case for exchange/outlook/hotmail username field
  account.settings.username = account.settings.username || account.settings.email;

  if (account.settings.imap_port) {
    account.settings.imap_port /= 1;
  }
  if (account.settings.smtp_port) {
    account.settings.smtp_port /= 1;
  }
  if (account.label && account.label.includes('@')) {
    account.label = account.emailAddress;
  }

  // Test connections to IMAP and SMTP
  const proc = new MailsyncProcess({
    ...AppEnv.getLoadSettings(),
    disableThread: AppEnv.isDisableThreading(),
  });
  proc.identity = IdentityStore.identity();
  proc.account = account;
  const { response } = await proc.test();
  const newAccount = response.account;
  newAccount.settings.provider_key = account.settings.provider_key;
  if (account.settings && account.settings.refresh_client_id) {
    newAccount.settings.refresh_client_id = account.settings.refresh_client_id;
  }
  if (account.mailsync) {
    newAccount.mailsync = account.mailsync;
    delete newAccount.mailsync.accounts;
  }
  Actions.siftUpdateAccount(newAccount);
  // preload mail data
  const accounts = AccountStore.accounts();
  if (accounts && accounts.length === 0) {
    proc.sync();
  }
  const acc = new Account(newAccount);
  acc.picture = account.picture;
  if (account.settings && account.settings.refresh_client_id) {
    acc.settings.refresh_client_id = account.settings.refresh_client_id;
  }
  return acc;
}
