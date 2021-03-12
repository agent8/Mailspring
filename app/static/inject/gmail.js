/*
 * 传递函数给whenReady()
 * 当文档解析完毕且为操作准备就绪时，函数作为document的方法调用
 */
var whenReady = (function() {
  //这个函数返回whenReady()函数
  var funcs = []; //当获得事件时，要运行的函数
  var ready = false; //当触发事件处理程序时,切换为true

  //当文档就绪时,调用事件处理程序
  function handler(e) {
    if (ready) return; //确保事件处理程序只完整运行一次

    //如果发生onreadystatechange事件，但其状态不是complete的话,那么文档尚未准备好
    if (e.type === 'onreadystatechange' && document.readyState !== 'complete') {
      return;
    }

    //运行所有注册函数
    //注意每次都要计算funcs.length
    //以防这些函数的调用可能会导致注册更多的函数
    for (var i = 0; i < funcs.length; i++) {
      funcs[i].call(document);
    }
    //事件处理函数完整执行,切换ready状态, 并移除所有函数
    ready = true;
    funcs = null;
  }
  //为接收到的任何事件注册处理程序
  if (document.addEventListener) {
    document.addEventListener('DOMContentLoaded', handler, false);
    document.addEventListener('readystatechange', handler, false); //IE9+
    window.addEventListener('load', handler, false);
  } else if (document.attachEvent) {
    document.attachEvent('onreadystatechange', handler);
    window.attachEvent('onload', handler);
  }
  //返回whenReady()函数
  return function whenReady(fn) {
    if (ready) {
      fn.call(document);
    } else {
      funcs.push(fn);
    }
  };
})();

// check if the user is using 2-step
whenReady(async function() {
  if (window.location.href.includes('oauth2')) {
    console.log('***return', window.location.href);
    if (window.location.href.includes('oauth2/auth')) {
      var pswEl;
      var btns;
      let foundPsw = false;
      while (!foundPsw) {
        pswEl = document.querySelector('[role=presentation] [type=password]');
        console.log('****pswEl', pswEl);
        if (pswEl && !pswEl.attributes['aria-hidden']) {
          console.log('****found it');
          foundPsw = true;
          btns = Array.from(document.querySelectorAll('[role=presentation] button'));
          btns[btns.length - 2].addEventListener('click', () => {
            // get the password
            console.log('*****psw - 1', pswEl.value);
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
  if (window.location.href.includes('/apppasswords')) {
    console.log('***111' + window.location.href);
    var list = Array.from(document.querySelectorAll('[role=listbox]'));
    console.log('****check is 2-step open', list);
    // not 2-step
    if (!list || list.length <= 2) {
      window.location.href =
        'https://myaccount.google.com/signinoptions/two-step-verification/enroll-welcome';
    }
  } else if (window.location.href.includes('two-step-verification/enroll-welcome')) {
    console.log('****222' + window.location.href);
    var buttons = Array.from(document.querySelectorAll('[role=button]'));
    console.log('****buttons[buttons.length - 1]', buttons[buttons.length - 1]);
    buttons[buttons.length - 1].click();
  }
  // 2-step is ready
  else if (
    window.location.href.includes('signinoptions/two-step-verification') &&
    !window.location.href.includes('enroll')
  ) {
    console.log('333' + window.location.href);
    window.location.href = 'https://myaccount.google.com/apppasswords';
  }
});

const { ipcRenderer } = require('electron');
ipcRenderer.on('fill-psw', (e, psw) => {
  console.log('****fill-psw', psw);
  // fill password
  var timer = setInterval(() => {
    var pswDom = document.querySelector('[role=presentation] [type=password]');
    if (pswDom) {
      pswDom.value = psw;
      var btns = Array.from(document.querySelectorAll('[role=presentation] button'));
      btns[btns.length - 2].click();
      window.clearInterval(timer);
    }
  }, 500);
});

ipcRenderer.on('generate-app-psw', async () => {
  console.log('****generate-app-psw');
  await window.generateAppPsw();
});

window.sleep = function(time) {
  return new Promise(resolve => setTimeout(resolve, time));
};

window.generateAppPsw = async function() {
  var options;
  var list;
  var found = false;
  while (!found) {
    list = Array.from(document.querySelectorAll('[role=listbox]'));
    if (list && list.length <= 2) {
      return;
    }
    if (list && list.length > 2) {
      found = true;
    }
    await window.sleep(1000);
    console.log('****sleep');
  }
  list[1].children[0].click();

  await window.sleep(2000);

  options = Array.from(list[1].querySelectorAll('[role=option]'));
  console.log('****find list 1');
  found = false;
  for (const opt of options) {
    console.log(opt.innerText);
    if (opt.innerText.toLowerCase().includes('mail')) {
      console.log('**found list 1, click');
      opt.click();
      found = true;
      break;
    }
  }
  // the language is not English, select the default as fallback
  if (!found) {
    options[1].click();
  }

  await window.sleep(2000);

  list[2].children[0].click();

  await window.sleep(500);

  options = Array.from(list[2].querySelectorAll('[role=option]'));
  console.log('****find list 2');
  for (const opt of options) {
    console.log(opt.innerText);
    if (opt.innerText.toLowerCase().includes('mac')) {
      console.log('**found list 2, click');
      opt.click();
      break;
    }
  }

  await window.sleep(500);

  // click [Generate]
  var button = list[1].parentElement.parentElement.nextElementSibling.querySelector(
    '[role=button]'
  );
  button.click();

  var timer = window.setInterval(() => {
    var pswObj = document.querySelector('[autofocus] span');
    if (
      pswObj &&
      pswObj.innerText &&
      document.querySelector('[autofocus] span').innerText.length === 16
    ) {
      console.log('****found it', pswObj.innerText);
      ipcRenderer.sendToHost('app-psw', pswObj.innerText);
      window.clearInterval(timer);
    }
  }, 200);
};
