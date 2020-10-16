var child_process = require('child_process');

// [from_path, to_path]
const file_mappings = [
  // svg icon
  ['veyron-design/icons/desktop/*.svg', './app/static/icons/'],
  // snooze/d icon
  ['veyron-design/icons/desktop/snooze.svg', './app/static/icons/snoozed.svg'],
  // system tray icon
  [
    'veyron-design/icons/desktop/MenuItem-*.png',
    './app/internal_packages/system-tray/assets/darwin/',
  ],
  // lottie
  ['veyron-design/lottie/mac-onboarding.json', './app/static/lottie/mac-onboarding.json'],
  ['veyron-design/lottie/desktop/*.json', './app/static/lottie/'],
  // onboarding images
  [
    'veyron-design/images/desktop/addAnotherAccount.png',
    './app/internal_packages/onboarding/assets/',
  ],
  [
    'veyron-design/images/desktop/trends-research.png',
    './app/internal_packages/onboarding/assets/',
  ],
  ['veyron-design/images/desktop/login-error.png', './app/internal_packages/onboarding/assets/'],
  ['veyron-design/images/desktop/manage-privacy.png', './app/internal_packages/onboarding/assets/'],
  [
    'veyron-design/images/desktop/all-set.png',
    './app/internal_packages/onboarding/assets/onboarding-done@2x.png',
  ],
  [
    'veyron-design/images/desktop/preference-data-false.png',
    './app/static/images/onboarding/preference-data-false.png',
  ],
  [
    'veyron-design/images/desktop/preference-data-false-dark.png',
    './app/static/images/onboarding/preference-data-false-dark.png',
  ],
  [
    'veyron-design/images/desktop/preference-data-true.png',
    './app/static/images/onboarding/preference-data-true.png',
  ],
  [
    'veyron-design/images/desktop/preference-data-true-dark.png',
    './app/static/images/onboarding/preference-data-true-dark.png',
  ],
  // preferences
  [
    'veyron-design/images/desktop/prefs-appearance*.png',
    './app/static/images/preferences/appearance/',
  ],
  [
    'veyron-design/images/desktop/prefs-quick-actions*.png',
    './app/static/images/preferences/appearance/',
  ],
  [
    'veyron-design/images/desktop/prefs-email-actions*.png',
    './app/static/images/preferences/appearance/',
  ],
  [
    'veyron-design/images/desktop/prefs-swipe-colors*.png',
    './app/static/images/preferences/appearance/',
  ],
  [
    'veyron-design/images/desktop/onecolumn-blue.png',
    './app/static/images/preferences/appearance/appearance-mode-list-active.png',
  ],
  [
    'veyron-design/images/desktop/onecolumn-grey.png',
    './app/static/images/preferences/appearance/appearance-mode-list.png',
  ],
  [
    'veyron-design/images/desktop/twocolumn-blue.png',
    './app/static/images/preferences/appearance/appearance-mode-split-active.png',
  ],
  [
    'veyron-design/images/desktop/twocolumn-grey.png',
    './app/static/images/preferences/appearance/appearance-mode-split.png',
  ],
  [
    'veyron-design/images/desktop/twocolumnhorizontal-blue.png',
    './app/static/images/preferences/appearance/appearance-mode-split-v-active.png',
  ],
  [
    'veyron-design/images/desktop/twocolumnhorizontal-grey.png',
    './app/static/images/preferences/appearance/appearance-mode-split-v.png',
  ],
  ['veyron-design/images/desktop/profile-hide*.png', './app/static/images/preferences/appearance/'],
  ['veyron-design/images/desktop/profile-show*.png', './app/static/images/preferences/appearance/'],
  ['veyron-design/images/desktop/account-logo-*.png', './app/static/images/preferences/providers/'],
  ['veyron-design/images/desktop/manage-privacy.png', './app/static/images/preferences/privacy/'],
  // chat
  ['veyron-design/images/desktop/no-connection.png', './app/static/images/chat/no-connection.png'],
  [
    'veyron-design/images/desktop/image-not-found.png',
    './app/static/images/chat/image-not-found.png',
  ],
  ['veyron-design/images/desktop/EmptyChat.png', './app/static/images/chat/EmptyChat.png'],
  // other images
  ['veyron-design/lottie/sift-travel-animation.json', './app/static/lottie/'],
  ['veyron-design/lottie/sift-entertainment-animation.json', './app/static/lottie/'],
  ['veyron-design/lottie/sift-packages-animation.json', './app/static/lottie/'],
  ['veyron-design/lottie/sift-bills-and-receipts-animation.json', './app/static/lottie/'],
  ['veyron-design/images/desktop/*nomail*.png', './app/static/images/empty-state/'],
  ['veyron-design/images/desktop/*zero*.png', './app/static/images/empty-state/'],
  ['veyron-design/images/desktop/EmptyMail*.png', './app/static/images/empty-state/'],
  ['veyron-design/images/desktop/nomail.png', './app/static/images/empty-state/nomail@2x.png'],
  [
    'veyron-design/images/desktop/nomail-drafts-3.png',
    './app/static/images/empty-state/ic-emptystate-drafts@2x.png',
  ],
  [
    'veyron-design/images/desktop/nomail-flagged.png',
    './app/static/images/empty-state/ic-emptystate-flagged@2x.png',
  ],
  ['veyron-design/images/desktop/installer-background.png', './app/build/resources/mac/'],
  ['veyron-design/images/desktop/edo-previewer-loading.gif', './app/build/resources/win/'],
  [
    'veyron-design/images/desktop/emailtracking-popup-image.png',
    './app/static/images/tracking/emailtracking-popup-image.png',
  ],
  [
    'veyron-design/images/desktop/export-data.png',
    './app/static/images/preferences/privacy/export-data.png',
  ],
  [
    'veyron-design/images/desktop/nomail-search-email.png',
    './app/static/images/preferences/privacy/nomail-search-email.png',
  ],
  [
    'veyron-design/images/desktop/send-data.png',
    './app/static/images/preferences/privacy/send-data.png',
  ],
  [
    'veyron-design/images/desktop/all-your-devices.png',
    './app/static/images/preferences/edison-account/all-your-devices.png',
  ],
  [
    'veyron-design/images/desktop/all-your-devices-dark.png',
    './app/static/images/preferences/edison-account/all-your-devices-dark.png',
  ],
  [
    'veyron-design/images/desktop/enterprise-package.png',
    './app/static/images/preferences/edison-account/enterprise-package.png',
  ],
  [
    'veyron-design/images/desktop/enterprise-package-dark.png',
    './app/static/images/preferences/edison-account/enterprise-package-dark.png',
  ],
  [
    'veyron-design/images/desktop/paywall-contacts-nobg.png',
    './app/static/images/preferences/edison-account/paywall-contacts-nobg.png',
  ],
  [
    'veyron-design/images/desktop/paywall-contacts-nobg-dark.png',
    './app/static/images/preferences/edison-account/paywall-contacts-nobg-dark.png',
  ],
  [
    'veyron-design/icons/ios/device-computer.png',
    './app/static/images/preferences/edison-account/device-computer.png',
  ],
  [
    'veyron-design/icons/ios/device-phone.png',
    './app/static/images/preferences/edison-account/device-phone.png',
  ],
  [
    'veyron-design/icons/ios/device-tablet.png',
    './app/static/images/preferences/edison-account/device-tablet.png',
  ],
  [
    'veyron-design/images/ios/verifying-account.png',
    './app/static/images/preferences/edison-account/verifying-account.png',
  ],
  [
    'veyron-design/images/ios/verifying-account-dark.png',
    './app/static/images/preferences/edison-account/verifying-account-dark.png',
  ],
  [
    'veyron-design/images/ios/welcome-back.png',
    './app/static/images/preferences/edison-account/welcome-back.png',
  ],
  [
    'veyron-design/images/ios/welcome-back-dark.png',
    './app/static/images/preferences/edison-account/welcome-back-dark.png',
  ],
  [
    'veyron-design/images/desktop/focused-inbox.png',
    './app/static/images/notification/focused-inbox.png',
  ],
  [
    'veyron-design/images/desktop/whatsnew-snooze.png',
    './app/static/images/notification/whatsnew-snooze.png',
  ],
  [
    'veyron-design/images/desktop/whatsnew-rating.png',
    './app/static/images/notification/whatsnew-rating.png',
  ],
];

let errorCommands = [];
function copyIt(from, to) {
  const command = `cp ../../${from} ${to}`;
  try {
    const result = child_process.execSync(command);
  } catch (e) {
    errorCommands.push(command);
  }
}

for (const mapping of file_mappings) {
  copyIt(mapping[0], mapping[1]);
}

// delete unused file
child_process.execSync(`rm ./app/static/images/empty-state/nomail.png`);

if (errorCommands.length) {
  console.log('*** Failed! *** ', errorCommands);
} else {
  console.log('*** Success! *** ');
}
