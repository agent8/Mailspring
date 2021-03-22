var whenReady = (function() {
  var funcs = [];
  var ready = false;

  function handler(e) {
    if (ready) return;

    if (e.type === 'onreadystatechange' && document.readyState !== 'complete') {
      return;
    }

    for (var i = 0; i < funcs.length; i++) {
      funcs[i].call(document);
    }
    ready = true;
    funcs = null;
  }
  if (document.addEventListener) {
    document.addEventListener('DOMContentLoaded', handler, false);
    document.addEventListener('readystatechange', handler, false); //IE9+
    window.addEventListener('load', handler, false);
  } else if (document.attachEvent) {
    document.attachEvent('onreadystatechange', handler);
    window.attachEvent('onload', handler);
  }

  return function whenReady(fn) {
    if (ready) {
      fn.call(document);
    } else {
      funcs.push(fn);
    }
  };
})();

function debug(...args) {
  console.log('****debug:', ...args);
}

function fallback(reason) {
  debug(reason);
  ipcRenderer.sendToHost('fallback', reason);
}

// check if the user is using 2-step
whenReady(async function() {
  if (window.location.href.includes('oauth2')) {
    debug('return', window.location.href);
    if (window.location.href.includes('oauth2/auth')) {
      var pswEl;
      var btns;
      var foundPsw = false;
      while (!foundPsw) {
        pswEl = document.querySelector('[role=presentation] [type=password]');
        if (pswEl && !pswEl.attributes['aria-hidden']) {
          foundPsw = true;
          btns = Array.from(document.querySelectorAll('[role=presentation] button'));
          btns[btns.length - 2].addEventListener('click', () => {
            // get the password
            debug('get the password:', pswEl.value);
            // send email password to owner
            ipcRenderer.sendToHost('e-psw', pswEl.value);
          });
          break;
        }
        await window.sleep(300);
      }
    }
    return;
  }
  // If in apppasswords page, check whether the 2-step is enabled, if not goto [enroll-welcome]
  if (window.location.href.includes('/apppasswords')) {
    const list = Array.from(document.querySelectorAll('[role=listbox]'));
    // not 2-step
    if (!list || list.length <= 2) {
      window.location.href =
        'https://myaccount.google.com/signinoptions/two-step-verification/enroll-welcome';
    }
  }
  // If in enroll-welcome page, goto next page automatically
  else if (window.location.href.includes('two-step-verification/enroll-welcome')) {
    const btns = Array.from(document.querySelectorAll('[role=button]'));
    btns[btns.length - 1].click();
    // If still in the same page after 2 seconds, execute fallback
    setTimeout(() => {
      if (window.location.href.includes('two-step-verification/enroll-welcome')) {
        fallback('Skip enroll-welcome failed');
      }
    }, 5000);
  }
  // Input phone number page, hide necessary components
  else if (window.location.href.includes('two-step-verification/enroll?')) {
    const phoneNumberWrapper = document.querySelector('[data-phone-number]');
    if (phoneNumberWrapper && phoneNumberWrapper.children && phoneNumberWrapper.children[0]) {
      phoneNumberWrapper.children[0].style.display = 'none';
    }
    const navi = document.querySelector('[data-back-url=security]');
    if (navi && navi.parentElement && navi.parentElement.parentElement) {
      navi.parentElement.parentElement.style.display = 'none';
    }
  }
  // If 2-step is enabled, goto [apppasswords]
  else if (
    window.location.href.includes('signinoptions/two-step-verification') &&
    !window.location.href.includes('enroll')
  ) {
    window.location.href = 'https://myaccount.google.com/apppasswords';
  }
});

const { ipcRenderer } = require('electron');
// On receive paasword from Native side
ipcRenderer.on('fill-psw', (e, psw) => {
  debug('fill-psw', psw);
  // fill password
  var timer = setInterval(() => {
    var pswDom = document.querySelector('[role=presentation] [type=password]');
    if (pswDom) {
      pswDom.value = psw;
      var btns = Array.from(document.querySelectorAll('[role=presentation] button'));
      btns[btns.length - 2].click();
      window.clearInterval(timer);
    }
  }, 300);
});

// Receive generate password command from native side
ipcRenderer.on('generate-app-psw', async () => {
  await window.generateAppPsw();
});

window.sleep = function(time) {
  return new Promise(resolve => setTimeout(resolve, time));
};

// Generate password
window.generateAppPsw = async function() {
  var options;
  var list;
  var found = false;
  while (!found) {
    list = Array.from(document.querySelectorAll('[role=listbox]'));
    if (list && list.length <= 2) {
      fallback('The 2-step is not enabled');
      return;
    }
    if (list && list.length > 2) {
      found = true;
    }
    await window.sleep(100);
  }
  list[1].children[0].click();

  await window.sleep(2000);

  options = Array.from(list[1].querySelectorAll('[role=option]'));
  found = false;
  if (!options || options.length === 0) {
    fallback('Warn - 1: The page dom is changed, we need update this script!!');
    return;
  }
  for (const opt of options) {
    console.log(opt.innerText);
    if (opt.innerText.toLowerCase().includes('other')) {
      opt.click();
      found = true;
      break;
    }
  }
  // the language is not English, select the default as fallback
  if (!found) {
    options[options.length - 1].click();
  }

  await window.sleep(1000);

  const hintInput = document.querySelector('input[data-initial-value]');
  if (!hintInput) {
    fallback('Generate password failed - can not find input field.');
    return;
  }
  hintInput.value = 'Edison Mail for Desktop';

  // list[2].children[0].click();

  // await window.sleep(1000);

  // options = Array.from(list[2].querySelectorAll('[role=option]'));
  // if (!options || options.length === 0) {
  //   fallback('Warn - 2: The page dom is changed, we need update this script!!');
  //   return;
  // }
  // for (const opt of options) {
  //   console.log(opt.innerText);
  //   if (opt.innerText.toLowerCase().includes('mac')) {
  //     opt.click();
  //     break;
  //   }
  // }

  await window.sleep(2000);

  // click [Generate]
  var button = list[1].parentElement.parentElement.nextElementSibling.querySelector(
    '[role=button]'
  );
  if (!button) {
    fallback('Generate password failed - can not find Generate button.');
    return;
  }
  button.setAttribute('aria-disabled', false);
  button.click();

  var timer = window.setInterval(() => {
    var pswObj = document.querySelector('[autofocus] span');
    if (
      pswObj &&
      pswObj.innerText &&
      document.querySelector('[autofocus] span').innerText.length === 16
    ) {
      debug('app-psw', pswObj.innerText);
      ipcRenderer.sendToHost('app-psw', pswObj.innerText);
      window.clearInterval(timer);
      timer = null;
    }
  }, 200);

  // Generate password failed
  setTimeout(() => {
    if (timer) {
      fallback('Generate password failed. - can not find the app password.');
    }
  }, 8000);
};
