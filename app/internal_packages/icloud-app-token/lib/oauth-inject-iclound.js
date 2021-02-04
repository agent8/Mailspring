/* eslint no-undef: 0 */

const { ipcRenderer } = require('electron');
function eventHandler(eventName, message) {
  ipcRenderer.sendToHost(eventName, message);
}

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

/**
   https://appleid.apple.com/account/manage
   https://appleid.apple.com/manage/section/account/edit
   https://appleid.apple.com/manage/section/security/edit
 */
whenReady(function() {
  if (
    [
      'https://appleid.apple.com/account/manage',
      'https://appleid.apple.com/manage/section/account/edit',
      'https://appleid.apple.com/manage/section/security/edit',
    ].includes(window.location.href)
  ) {
    autoProcess('Edison Mail');
    eventHandler('loading');
  }
});

var iCloudAccount;
function autoProcess(uuid) {
  var isAccountTimeout = false;
  var isRevokeTimeout = false;
  var isCreateTimeout = false;

  // fetch email address of iCloud email account
  var accountTimer = setTimeout(() => {
    isAccountTimeout = true;
    eventHandler('error', 'timeout');
  }, 30000);
  var revokeTimer;
  var createTimer;

  $('.account-section-title').trigger('click');
  fetchICloudAccount();

  var timer;

  function fetchICloudAccount() {
    if (isAccountTimeout) {
      return;
    }
    if (!$('reachable string-ellipsis')) {
      setTimeout(fetchICloudAccount, 100);
      return;
    }
    let emails = $('reachable string-ellipsis').map((_, el) => {
      return el.attributes['content-value'].value.toLowerCase();
    });
    let accounts = emails
      .filter((_, email) => {
        return (
          email.endsWith('@mac.com') || email.endsWith('@me.com') || email.endsWith('@icloud.com')
        );
      })
      .toArray();
    iCloudAccount = accounts.pop();
    $('.nav-cancel').trigger('click');
    $('.security-section-title').trigger('click');
    // stop accountTimer
    clearTimeout(accountTimer);

    // start revoke password
    setTimeout(() => {
      revokeTimer = setTimeout(() => {
        isRevokeTimeout = true;
        eventHandler('error', 'timeout');
      }, 30000);
      revokePassword(uuid);
    }, 2000);
  }

  function revokePassword(uuid) {
    if (isRevokeTimeout) {
      return;
    }
    if (!$('#viewAppPasswordHistory')) {
      setTimeout(revokePassword(uuid), 100);
      return;
    }
    $('#viewAppPasswordHistory').trigger('click');
    setTimeout(() => {
      let passwords = $('.pass-desc');
      for (var i = 0; i < passwords.length; i++) {
        let pwdUuid = passwords[i].textContent.trim();
        if (pwdUuid === uuid) {
          $(passwords[i].parentNode.childNodes[3].childNodes[1]).trigger('click');
          $($('.overflow-text')[2]).trigger('click');
          break;
        }
      }
      $('.nav-cancel').trigger('click');
      // stop revoke timer
      clearTimeout(revokeTimer);

      createTimer = setTimeout(() => {
        isCreateTimeout = true;
        clearInterval(timer);
        eventHandler('error', 'timeout');
      }, 30000);
      // start create password
      setTimeout(() => {
        createPassword(uuid);
      }, 1000);
    }, 3000);
  }

  function createPassword(uuid) {
    if (isCreateTimeout) {
      return;
    }
    if (!$('.btn-app-password')) {
      setTimeout(createPassword(uuid), 100);
      return;
    }
    $('.btn-app-password').trigger('click');
    setTimeout(() => {
      $('.generic-input-field').attr('value', uuid);
      $('.generic-input-field').trigger('change');
      $('.button-primary').trigger('click');
      intervalCheckPassword();
    }, 1000);
  }

  function intervalCheckPassword() {
    timer = setInterval(() => {
      // cannot create new password due to the total number limit of 25 by Apple
      if ($('.has-errors').length > 0) {
        eventHandler('error', 'over limit');
        return;
      }

      var el = $('#appPasswordText');
      if (el && el.val()) {
        if (iCloudAccount === undefined) {
          return;
        }
        // stop create timer
        clearTimeout(createTimer);
        clearInterval(timer);
        // send the message to the receiver
        eventHandler('token', iCloudAccount + '$edo$' + el.val());
      }
    }, 1000);
  }
}
