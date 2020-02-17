import React from 'react';

import { Mark, Block, Text } from 'slate';
import AutoReplace from 'slate-auto-replace';
import { RegExpUtils } from 'mailspring-exports';
import { BLOCK_CONFIG } from './base-block-plugins';
import { BuildMarkButtonWithValuePicker, getMarkOfType } from './toolbar-component-factories';

export const LINK_TYPE = 'link';
function _insertMiddleText(text, change) {
  const texts = text.split(/\n/g);
  if (texts.length > 1) {
    for (let i = 0; i < texts.length; i++) {
      const block = Block.create({ type: BLOCK_CONFIG.div.type, node: Text.create({ text: texts[i] }) });
      change.insertText(texts[i]);
      if (i !== texts.length - 1) {
        change.insertBlock(block);
      }
    }
  } else {
    change.insertText(texts[0]);
  }
}
function _parseLinks(links, originalText, change) {
  let leftOverText = originalText;
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    if (i === 0) {
      const linkIndex = leftOverText.indexOf(link);
      if (linkIndex !== 0) {
        const pretext = leftOverText.slice(0, linkIndex);
        leftOverText = leftOverText.slice(linkIndex);
        _insertMiddleText(pretext, change);
      }
    }
    if (i !== links.length - 1) {
      const nextLinkIndex = leftOverText.indexOf(links[i + 1]);
      const middleText = leftOverText.slice(link.length, nextLinkIndex);
      const mark = Mark.create({ type: LINK_TYPE, data: { href: link } });
      change
        .addMark(mark)
        .insertText(link)
        .removeMark(mark);
      _insertMiddleText(middleText, change);
      console.log('parse link remove insert');
      leftOverText = leftOverText.slice(nextLinkIndex);
    } else {
      if (link.length < leftOverText.length) {
        leftOverText = leftOverText.slice(link.length);
        const mark = Mark.create({ type: LINK_TYPE, data: { href: link } });
        change
          .addMark(mark)
          .insertText(link)
          .removeMark(mark);
        _insertMiddleText(leftOverText, change);
        console.log('parse link remove insert');
      } else {
        const mark = Mark.create({ type: LINK_TYPE, data: { href: link } });
        change
          .addMark(mark)
          .insertText(link)
          .removeMark(mark);
        console.log('parse link remove');
      }
    }
  }
  return true;
}

function onPaste(event, change, editor) {
  const html = event.clipboardData.getData('text/html');
  const plain = event.clipboardData.getData('text/plain');
  const regex = RegExpUtils.urlRegex({ matchStartOfString: false, matchTailOfString: false });
  const links = plain.match(regex);
  if (!html && plain && links) {
    return _parseLinks(links, plain, change);
  }
}

function buildAutoReplaceHandler({ hrefPrefix = '' } = {}) {
  return function (transform, e, matches, editor) {
    if (transform.value.activeMarks.find(m => m.type === LINK_TYPE)) {
      if (['Return', 'Enter'].includes(e.key)) {
        e.preventDefault();
        return transform.splitBlock();
      } else {
        return transform.insertText(TriggerKeyValues[e.key]);
      }
    }
    const link = matches.before[matches.before.length - 1];
    let originalText = '';
    for (let i = 0; i < transform.value.texts.size; i++) {
      originalText += transform.value.texts.get(i).text;
    }
    if (transform.value.endOffset) {
      originalText = originalText.slice(0, transform.value.endOffset);
    }
    const linkIndex = originalText.lastIndexOf(link);
    const mark = Mark.create({ type: LINK_TYPE, data: { href: hrefPrefix + link } });
    let deleteLength;
    if (linkIndex === originalText.length - link.length) {
      deleteLength = link.length;
      transform.deleteBackward(deleteLength)
        .addMark(mark)
        .insertText(link)
        .removeMark(mark);
      console.log('replaced removed');
    }
    console.log(`bulidAutoReplaceHandler ${originalText} ${JSON.stringify(matches)}`);
    if (['Return', 'Enter'].includes(e.key)) {
      e.preventDefault();
      return transform.splitBlock();
    } else {
      return transform.insertText(TriggerKeyValues[e.key]);
    }
  };
}

function renderMark({ mark, children, targetIsHTML }) {
  if (mark.type !== LINK_TYPE) {
    return;
  }
  let href = mark.data.href || mark.data.get('href') || '';
  const title = href;
  if (targetIsHTML) {
    if (href && !href.includes('://')) {
      href = 'http://' + href;
    }
    return (
      <a href={href} title={title}>
        {children}
      </a>
    );
  } else {
    const onClick = e => {
      if (e.ctrlKey || e.metaKey) {
        AppEnv.windowEventHandler.openLink({ href, metaKey: e.metaKey });
      }
    };
    return (
      <span className="link" title={href} onClick={onClick}>
        {children}
      </span>
    );
  }
}

const rules = [
  {
    deserialize(el, next) {
      if (el.tagName.toLowerCase() === 'a') {
        return {
          object: 'mark',
          type: LINK_TYPE,
          nodes: next(el.childNodes),
          data: {
            href: el.getAttribute('href'),
          },
        };
      }
    },
    serialize(obj, children) {
      if (obj.object !== 'mark') return;
      return renderMark({ mark: obj, children, targetIsHTML: true });
    },
  },
];

const TriggerKeyValues = {
  ' ': ' ',
  Enter: '\n',
  Return: '\n',
};

export default [
  {
    toolbarComponents: [
      BuildMarkButtonWithValuePicker({
        type: LINK_TYPE,
        field: 'href',
        iconClassOn: 'dt-icon dt-icon-link',
        iconClassOff: 'dt-icon dt-icon-link',
        placeholder: 'http://',
      }),
    ],
    onPaste,
    onKeyDown: function onKeyDown(event, change) {
      // ensure space and enter always terminate links
      if (!['Space', 'Enter', ' ', 'Return'].includes(event.key)) {
        return;
      }
      const mark = getMarkOfType(change.value, LINK_TYPE);
      if (mark) {
        const oldEndOffset = change.value.endOffset;
        change.extendToEndOfInline();
        const newEndOffset = change.value.endOffset;
        const isAtEndLink = newEndOffset === oldEndOffset;
        change.moveEndOffsetTo(oldEndOffset);
        if (['Space', ' '].includes(event.key)) {
          if (isAtEndLink) {
            change.removeMark(mark);
          }
          return;
        } else if (!isAtEndLink) {
          change.removeMark(mark);
        } else {
          if (['Enter', 'Return'].includes(event.key)) {
            change.splitBlock();
            change.removeMark(mark);
            // const block = Block.create({ type: BLOCK_CONFIG.div.type, node: Text.create({ text: '' }) });
            // change.insertBlock(block);
          }
        }
      }
    },
    renderMark,
    rules,
    commands: {
      'contenteditable:insert-link': event => {
        // want to see a hack? here you go!
        // 1: find our container and then find the link toolbar icon - this approach
        // ensures we get the link button in the /current/ composer.
        const linkButton = event.target
          .closest('.RichEditor-root')
          .querySelector('.dt-icon.dt-icon-link')
          .closest('button');

        // 2: click it.
        if (linkButton) {
          linkButton.dispatchEvent(
            new MouseEvent('mousedown', {
              view: window,
              bubbles: true,
              cancelable: true,
            })
          );
        }
      },
    },
  },
  // AutoReplace({
  //   trigger: e => !!TriggerKeyValues[e.key],
  //   before: RegExpUtils.emailRegex({ requireStartOrWhitespace: true, matchTailOfString: true }),
  //   transform: buildAutoReplaceHandler({ hrefPrefix: 'mailto:' }),
  // }),
  // AutoReplace({
  //   trigger: e => !!TriggerKeyValues[e.key],
  //   before: RegExpUtils.urlRegex({ requireStartOrWhitespace: true, matchTailOfString: false }),
  //   transform: buildAutoReplaceHandler(),
  // }),
];