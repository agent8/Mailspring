import React from 'react';
import PropTypes from 'prop-types';
import { Editor } from '../slate-react';
import { clipboard as ElectronClipboard } from 'electron';
import _ from 'underscore';

import KeyCommandsRegion from '../key-commands-region';
import ComposerEditorToolbar from './composer-editor-toolbar';
import {
  plugins as insidePlugins,
  convertFromHTML,
  convertToHTML,
  convertEdisonImageFilesToInline,
} from './conversion';
import { lastUnquotedNode } from './base-block-plugins';
import { changes as InlineAttachmentChanges } from './inline-attachment-plugins';
import { changes as InlineResizableImageChanges } from './image-plugins';
import { shortCutsUtils } from './system-text-replacements-plugins';

const TOOLBAR_MIN_WIDTH = 628;

// The key for trigger spellcheck
const whiteSpaceAndPunctuation = ['.', ',', ';', ':', "'", '"', ' ', 'Enter'];

export default class ComposerEditor extends React.Component {
  static propTypes = {
    readOnly: PropTypes.bool,
    className: PropTypes.string,
    onBlur: PropTypes.func,
    onDrop: PropTypes.func,
    value: PropTypes.object,
    propsForPlugins: PropTypes.object,
    onAddAttachments: PropTypes.func,
    outerPlugin: PropTypes.array,
    onChange: PropTypes.func,
    onFileReceived: PropTypes.func,
    onPasteHtmlHasFiles: PropTypes.func,
  };
  static defaultProps = {
    readOnly: false,
  };

  // Public API

  constructor(props) {
    super(props);

    // Bind the commands specified by the plugins to the props of this instance.
    // Note that we cache these between renders so we don't remove and re-add them
    // every render.
    this._pluginKeyHandlers = {};
    this.plugins = [...insidePlugins, ...(props.outerPlugin || [])];
    this.plugins.forEach(plugin => {
      Object.entries(plugin.commands || {}).forEach(([command, handler]) => {
        this._pluginKeyHandlers[command] = event => {
          if (!this._mounted) return;
          const { onChange, value } = this.props;
          const change = handler(event, value);
          if (change) {
            onChange(change);
          }
        };
      });
    });
    this.state = {
      isCrowded: false,
      spellCheckEnabled: true,
    };
  }

  componentDidMount() {
    shortCutsUtils.refreshTextShortCuts();
    this._mounted = true;
    window.addEventListener('resize', this._onResize, true);
    this._onResize();
  }

  componentWillUnmount() {
    this._mounted = false;
    window.removeEventListener('resize', this._onResize, true);
  }

  _onResize = () => {
    const container = document.querySelector('.RichEditor-toolbar');

    if (!container) {
      return;
    }
    let isCrowded = false;
    if (container.clientWidth <= TOOLBAR_MIN_WIDTH) {
      isCrowded = true;
    }
    if (isCrowded !== this.state.isCrowded && this._mounted) {
      this.setState({ isCrowded });
    }
  };

  focus = () => {
    const { onChange, value } = this.props;
    const draft = (this.props.propsForPlugins || {}).draft || { defaultValues: {} };
    const defaultFont = draft.defaultValues.fontFace || AppEnv.config.get('core.fontface');
    const defaultSize = draft.defaultValues.fontSize || AppEnv.config.get('core.fontsize');
    onChange(
      value
        .change()
        .selectAll()
        .collapseToStart()
        .addMark({
          object: 'mark',
          type: 'face',
          data: { value: defaultFont },
        })
        .addMark({
          object: 'mark',
          type: 'size',
          data: { value: defaultSize },
        })
        .focus()
    );
  };
  unfocus = () => {
    const { onChange, value } = this.props;
    onChange(
      value
        .change()
        .selectAll()
        .collapseToStart()
        .blur()
    );
  };

  focusEndReplyText = () => {
    window.requestAnimationFrame(() => {
      const { onChange, value } = this.props;
      const node = lastUnquotedNode(value);
      if (!node) return;
      onChange(
        value
          .change()
          .collapseToEndOf(node)
          .focus()
      );
    });
  };

  focusEndAbsolute = () => {
    window.requestAnimationFrame(() => {
      const { onChange, value } = this.props;
      onChange(
        value
          .change()
          .selectAll()
          .collapseToEnd()
          .focus()
      );
    });
  };

  insertInlineAttachments = files => {
    if (!Array.isArray(files) || files.length === 0) {
      return;
    }
    const { onChange, value } = this.props;
    let change = value.change();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      InlineAttachmentChanges.insert(change, file);
      // if (i !== files.length - 1) {
      //   change.collapseToEndOfPreviousText();
      // }
    }
    // DC-734 it seems that if we call onChange immediately, more often than not,
    // it'll effect the next "list" item and make it indent.
    // For some reason adding a timeout solves this problem.
    setTimeout(() => onChange(change), 500);
  };

  insertInlineAttachment = file => {
    const { onChange, value } = this.props;
    onChange(InlineAttachmentChanges.insert(value.change(), file));
  };

  insertInlineResizableImage = filePath => {
    const { onChange, value } = this.props;
    onChange(InlineResizableImageChanges.insert(value.change(), filePath));
  };

  onFocusIfBlurred = event => {
    if (!this.props.value.selection.isFocused) {
      this.focus();
    }
  };

  onCopy = (event, change, editor) => {
    event.preventDefault();
    const document = editor.value.document.getFragmentAtRange(editor.value.selection);
    event.clipboardData.setData('text/html', convertToHTML({ document }));
    event.clipboardData.setData('text/plain', editor.value.fragment.text);
    return true;
  };

  onCut = (event, change, editor) => {
    this.onCopy(event, change, editor);
    change.deleteBackward();
    return true;
  };

  onPaste = (event, change, editor) => {
    const { onFileReceived } = this.props;

    if (!onFileReceived || event.clipboardData.items.length === 0) {
      return;
    }
    event.preventDefault();

    // If the pasteboard has a file on it, stream it to a teporary
    // file and fire our `onFilePaste` event.
    const item = event.clipboardData.items[0];

    if (item.kind === 'file') {
      const temp = require('temp');
      const path = require('path');
      const fs = require('fs');
      const blob = item.getAsFile();
      const ext =
        {
          'image/png': '.png',
          'image/jpg': '.jpg',
          'image/tiff': '.tiff',
        }[item.type] || '';

      const reader = new FileReader();
      reader.addEventListener('loadend', () => {
        const buffer = Buffer.from(new Uint8Array(reader.result));
        const tmpFolder = temp.path('-nylas-attachment');
        const tmpPath = path.join(tmpFolder, `Pasted File${ext}`);
        fs.mkdir(tmpFolder, () => {
          fs.writeFile(tmpPath, buffer, () => {
            console.log('copying file from clipboard');
            onFileReceived(tmpPath);
          });
        });
      });
      reader.readAsArrayBuffer(blob);
      return true;
    } else {
      const macCopiedFile = decodeURI(
        ElectronClipboard.read('public.file-url').replace('file://', '')
      );
      const winCopiedFile = ElectronClipboard.read('FileNameW').replace(
        new RegExp(String.fromCharCode(0), 'g'),
        ''
      );
      if (macCopiedFile.length || winCopiedFile.length) {
        console.log('coping from clipboard');
        onFileReceived(macCopiedFile || winCopiedFile);
        return true;
      }
    }

    // Reinstated because the bug is causing more trouble than it's worth.
    let html = event.clipboardData.getData('text/html');
    if (html) {
      const darkHtml = this._removeAllDarkModeStyles(html);
      let value = null;
      let newFiles = [];
      try {
        const ret = convertEdisonImageFilesToInline(darkHtml);
        value = convertFromHTML(ret.html);
        newFiles = ret.newFiles;
      } catch (err) {
        console.error('Error: convertFromHTML', err);
        const ret = convertEdisonImageFilesToInline(html);
        value = convertFromHTML(ret.html);
        newFiles = ret.newFiles;
      }
      if (value && value.document) {
        change.insertFragment(value.document);
        if (newFiles.length > 0) {
          if (this.props.onPasteHtmlHasFiles) {
            this.props.onPasteHtmlHasFiles(newFiles);
          }
        }
        return true;
      }
    }
  };

  _removeAllDarkModeStyles(html) {
    if (!html) {
      return '';
    }
    return html.replace(/(background-color|color):[^;]*?!important;/g, '');
  }

  openContextMenu = ({ word, sel, hasSelectedText }, event) => {
    AppEnv.windowEventHandler.openSpellingMenuFor(
      word,
      hasSelectedText,
      {
        onCorrect: correction => {
          this.onChange(this.props.value.change().insertText(correction));
        },
        onRestoreSelection: () => {
          this.onChange(this.props.value.change().select(sel));
        },
      },
      event
    );
  };

  onContextMenu = event => {
    event.preventDefault();

    const word = this.props.value.fragment.text;
    const sel = this.props.value.selection;
    const hasSelectedText = !sel.isCollapsed;
    this.openContextMenu({ word, sel, hasSelectedText }, event);
  };

  onChange = nextValue => {
    // This needs to be here because some composer plugins defer their calls to onChange
    // (like spellcheck and the context menu).
    if (!this._mounted) return;
    // console.log('sending out changes');
    this.props.onChange(nextValue);
  };

  _debounceSetState = _.debounce(data => {
    if (!this._mounted) {
      return;
    }
    // re-determine the language the document is written in
    this._redetermineLanguage();

    this.setState(data);
  }, 500);

  _redetermineLanguage = () => {
    if (!this._mounted) {
      return;
    }

    const { value } = this.props;
    if (value && value.focusBlock) {
      const text = value.focusBlock.text;
      if (text.length > 30) {
        AppEnv.spellchecker.provideHintText(text.substr(text.length - 512, 512));
      }
    }
  };

  onKeyDown = (event, spellcheckSetting) => {
    if (!spellcheckSetting) {
      return;
    }
    if (!this._mounted) {
      return;
    }
    const spellCheckEnabled = whiteSpaceAndPunctuation.includes(event.key);
    if (spellCheckEnabled !== this.state.spellCheckEnabled) {
      this.setState({ spellCheckEnabled });
    }
    // enable check, after user stop typing
    this._debounceSetState({ spellCheckEnabled: true });
  };

  // Event Handlers
  render() {
    const { className, onBlur, onDrop, value, propsForPlugins, onAddAttachments } = this.props;
    const { spellCheckEnabled } = this.state;
    const draftDefaultValues =
      this.props.propsForPlugins && this.props.propsForPlugins.draft
        ? this.props.propsForPlugins.draft.defaultValues
        : {};
    const defaultFontFace = (draftDefaultValues || {}).fontFace || 'sans-serif';
    const defaultFontSize = (draftDefaultValues || {}).fontSize || '14px';
    const spellcheckSetting = AppEnv.config.get('core.composing.spellcheck');
    return (
      <KeyCommandsRegion
        className={`RichEditor-root ${className || ''}`}
        localHandlers={this._pluginKeyHandlers}
      >
        <ComposerEditorToolbar
          value={value}
          onChange={this.onChange}
          plugins={this.plugins}
          readOnly={this.props.readOnly}
          isCrowded={this.state.isCrowded}
          draftDefaultValues={draftDefaultValues}
          onAddAttachments={onAddAttachments}
        />
        <div
          className="RichEditor-content"
          onClick={this.onFocusIfBlurred}
          onContextMenu={this.onContextMenu}
        >
          {this.plugins
            .filter(p => p.topLevelComponent)
            .map((p, idx) => (
              <p.topLevelComponent key={idx} value={value} onChange={this.onChange} />
            ))}
          <Editor
            onKeyDown={e => this.onKeyDown(e, spellcheckSetting)}
            style={{ fontFace: defaultFontFace, fontSize: defaultFontSize }}
            value={value}
            onChange={this.onChange}
            onBlur={onBlur}
            onDrop={onDrop}
            onCut={this.onCut}
            onCopy={this.onCopy}
            onPaste={this.onPaste}
            onFocus={() => {
              this.setState({ spellCheckEnabled: true });
            }}
            spellCheck={spellcheckSetting && spellCheckEnabled}
            readOnly={this.props.readOnly}
            plugins={this.plugins}
            propsForPlugins={propsForPlugins}
          />
          {this.plugins
            .reduce((arr, p) => (p.topLevelComponents ? arr.concat(p.topLevelComponents) : arr), [])
            .map((Component, idx) => (
              <Component key={idx} />
            ))}
        </div>
      </KeyCommandsRegion>
    );
  }
}
