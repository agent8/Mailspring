require.define({
  'ep_image_upload/static/js/clientHooks.js': function (require, exports, module) {
    'use strict'

    var _ = require('ep_etherpad-lite/static/js/underscore')

    var image = {
      removeImage: function (lineNumber) {
        var documentAttributeManager = this.documentAttributeManager
        documentAttributeManager.removeAttributeOnLine(lineNumber, 'img') // make the line a task list
      },
      addImage: function (lineNumber, src) {
        var documentAttributeManager = this.documentAttributeManager
        // src = '<img src="' + src + '" l-src="' + src + '" />';
        src = '<img src="' + src + '" />'
        documentAttributeManager.setAttributeOnLine(lineNumber, 'img', src) // make the line a task list
      },
    }

    var _handleNewLines = function (ace) {
      var rep = ace.ace_getRep()
      var lineNumber = rep.selStart[0]
      var curLine = rep.lines.atIndex(lineNumber)
      if (curLine.text) {
        ace.ace_doReturnKey()

        return lineNumber + 1
      }

      return lineNumber
    }

    exports.postToolbarInit = function (hook_name, context) {
      var editbar = context.toolbar // toolbar is actually editbar - http://etherpad.org/doc/v1.5.7/#index_editbar
      $('#closeErrorModalButton').on('click', function () {
        $('#imageUploadModalError').hide()
      })
      editbar.registerCommand('addImage', function () {
        $(document)
          .find('body')
          .find('#imageInput')
          .remove()
        var fileInputHtml =
          '<input style="width:1px;height:1px;z-index:-10000;" id="imageInput" type="file" />'
        $(document)
          .find('body')
          .append(fileInputHtml)

        $(document)
          .find('body')
          .find('#imageInput')
          .on('change', function (e) {
            var files = e.target.files
            if (!files.length) {
              return 'Please choose a file to upload first.'
            }
            var file = files[0]
            // var mimedb = clientVars.ep_image_upload.mimeTypes;
            // var mimeType = mimedb[file.type];
            var formData = new FormData()

            // add assoc key values, this will be posts values
            formData.append('file', file, file.name)
            $('#imageUploadModalLoader').show()
            var options = { context: context, handleNewLines: _handleNewLines, file: file, $: $ }
            window.parent.composerOnAddImage(options)
          })
        $(document)
          .find('body')
          .find('#imageInput')
          .trigger('click')
      })
    }

    exports.aceAttribsToClasses = function (name, context) {
      if (context.key === 'img') {
        return ['img:' + context.value]
      }
    }

    // Rewrite the DOM contents when an IMG attribute is discovered
    exports.aceDomLineProcessLineAttributes = function (name, context) {
      var cls = context.cls
      var exp = /(?:^| )img:([^>]*)/
      var imgType = exp.exec(cls)

      if (!imgType) return []
      let start = imgType[0].indexOf('src="') + 5
      let end = imgType[0].indexOf('"', start)
      let src = imgType[0].substring(start, end)
      var ret
      //let src = imgType[0]
      // console.log('yazz.img',imgType, context);
      var composerOnDownloadPadImg =
        window.parent.composerOnDownloadPadImg ||
        window.parent.parent.composerOnDownloadPadImg ||
        window.parent.parent.parent.composerOnDownloadPadImg
      var fsExistsSync =
        window.parent.fsExistsSync ||
        window.parent.parent.fsExistsSync ||
        window.parent.parent.parent.fsExistsSync
      let s = src
      let mark1 = '/download-inline-images/'
      let i = s.indexOf(mark1) + mark1.length
      let awsKey = s.substring(i)
      awsKey = awsKey.replace('/', '')
      var randomId = awsKey // Math.floor(Math.random() * 100000 + 1)
      if (fsExistsSync(src)) {
        ret = '<img src="' + src + '" />'
      } else {
        composerOnDownloadPadImg({ src, id: randomId, $, window })
        ret = '<img src="' + src + '" aaa/>'
        // ret = '<img src="' + src + '" download="false"/>'
      }
      var template = '<span id="' + randomId + '" class="image">'
      if (imgType[1]) {
        var preHtml = template + ret
        var postHtml = '</span>'
        var modifier = {
          preHtml: preHtml,
          postHtml: postHtml,
          processedMarker: true,
        }
        return [modifier]
      }

      return []
    }

    exports.aceEditorCSS = function () {
      return ['/ep_image_upload/static/css/ace.css']
    }

    exports.aceInitialized = function (hook, context) {
      var editorInfo = context.editorInfo
      editorInfo.ace_addImage = _(image.addImage).bind(context)
      editorInfo.ace_removeImage = _(image.removeImage).bind(context)
    }

    exports.collectContentImage = function (name, context) {
      var tname = context.tname
      var state = context.state
      var lineAttributes = state.lineAttributes
      if (tname === 'div' || tname === 'p') {
        delete lineAttributes.img
      }
      if (tname === 'img') {
        lineAttributes.img = context.node.outerHTML
      }
    }

    exports.aceRegisterBlockElements = function () {
      return ['img']
    }
  },
})
