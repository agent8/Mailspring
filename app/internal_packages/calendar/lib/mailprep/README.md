# 📅 Edison MailSpring Calendar

**Edison MailSpring Calendar is a Calendar plugin integrated into MailSpring for Edison Mail Desktop Application.** It is built with [Electron](https://github.com/atom/electron) and [React](https://facebook.github.io/react/) and integrates services and unique features from Google, Microsoft EWS and CalDav Providers (Yahoo, etc) all in one Calendar. It allows offline actions and automatically resolves conflict whenever possible.

**Edison MailSpring Calendar currently still being developed**. It uses [RxDB](https://github.com/pubkey/rxdb) and [RxJS](https://github.com/ReactiveX/rxjs) for data handling, and [Redux](https://github.com/reduxjs/react-redux) for managing application state. This allows easy development and introduction of new patterns.

## Features

Edison MailSpring Calendar comes back with powerful features like Multiple Account Support, 8 Different types of Providers, Recurrence handling, and more.

## Contributing

For development, it is advisable to use [VSCode](https://code.visualstudio.com/), as the project comes with [ESLint](https://eslint.org/), [Prettier](https://prettier.io/) and [StyleLint](https://github.com/stylelint/stylelint). For dependency management, the suggested tool is [Yarn](https://yarnpkg.com/en/)

## Quickstart

```
yarn install
yarn dev
```

## Additional files

### credentials.js

Add credentials.js to the following directory `/app/utils/`

```javascript
export const ICLOUD_USERNAME = '';
export const ICLOUD_PASSWORD = '';
export const YAHOO_USERNAME = '';
export const YAHOO_PASSWORD = '';
export const FASTMAIL_USERNAME = '';
export const FASTMAIL_PASSWORD = '';
```

Login credentials are currently hard-coded, please put your login credentials for each service in this document.
For security purposes, please request a app-specific password from your calendar provider instead of using your actual password

## License

some license
(Write some license here in the future)
