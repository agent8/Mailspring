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

// window.onload = autoProcess;
var maskDiv;
whenReady(function() {
  console.log('ready!!!!!!');
  if (window.location.href === 'https://appleid.apple.com/account/manage') {
    maskDiv = $('<div>Please wait...</div>').css({
      width: '100%',
      height: '100%',
      position: 'fixed',
      background: '#fff',
      left: 0,
      top: 0,
      zIndex: 1999,
      textAlign: 'center',
      fontSize: '40px',
    });
    maskDiv.appendTo('body');
    autoProcess();
  }
});

function autoProcess() {
  if (window.location.href !== 'https://appleid.apple.com/account/manage') {
    console.log('***return');
    return;
  }
  console.log('****autoProcess');

  if (!$('.btn-app-password')) {
    console.log('***retry');
    setTimeout(autoProcess, 100);
    return;
  }
  $('.btn-app-password').trigger('click');
  setTimeout(() => {
    $('.generic-input-field').attr('value', 'good-for-you');
    $('.generic-input-field').trigger('change');
    $('.button-primary').trigger('click');
    intervalCheckPassword();
  }, 1000);

  var timer;
  function intervalCheckPassword() {
    timer = setInterval(() => {
      var el = $('#appPasswordText');
      if (el && el.val()) {
        clearInterval(timer);
        // send the message to the receiver
        console.log('icloud:' + el.val());
        maskDiv.text(el.val());
      }
    }, 100);
  }
}

/*
 * 传递函数给whenReady()
 * 当文档解析完毕且为操作准备就绪时，函数作为document的方法调用
 */
