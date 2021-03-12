console.log('******gmail inject');

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
    if (list && list.length > 0) {
      found = true;
    }
    await window.sleep(1000);
    console.log('****sleep');
  }
  list[1].children[0].click();

  await window.sleep(1000);

  options = Array.from(list[1].querySelectorAll('[role=option]'));
  for (const opt of options) {
    console.log(opt);
    if (opt.innerText.toLowerCase().includes('mail')) {
      opt.click();
      break;
    }
  }

  await window.sleep(1000);

  list[2].children[0].click();

  await window.sleep(500);

  options = Array.from(list[2].querySelectorAll('[role=option]'));
  for (const opt of options) {
    console.log(opt);
    if (opt.innerText.toLowerCase().includes('mac')) {
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
