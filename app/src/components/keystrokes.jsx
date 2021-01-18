import React from 'react';
import PropTypes from 'prop-types';

const Keystrokes = ({ keyString = '', containerClassName = '' }) => {
  const _formatKeystrokes = original => {
    // On Windows, display cmd-shift-c
    if (process.platform === 'win32') return original;

    // Replace "cmd" => ⌘, etc.
    const modifiers = [
      [/\+(?!$)/gi, ''],
      [/command/gi, '⌘'],
      [/meta/gi, '⌘'],
      [/alt/gi, '⌥'],
      [/shift/gi, '⇧'],
      [/ctrl/gi, '^'],
      [/mod/gi, process.platform === 'darwin' ? '⌘' : '^'],
    ];
    let clean = original;
    for (const [regexp, char] of modifiers) {
      clean = clean.replace(regexp, char);
    }

    // ⌘⇧c => ⌘⇧C
    if (clean !== original) {
      clean = clean.toUpperCase();
    }

    // backspace => Backspace
    if (original.length > 1 && clean === original) {
      clean = clean[0].toUpperCase() + clean.slice(1);
    }
    return clean;
  };

  const elements = [];
  const splitKeystrokes = keyString.split(' ');
  splitKeystrokes.forEach((keystroke, kidx) => {
    elements.push(<span key={kidx}>{_formatKeystrokes(keystroke)}</span>);
    if (kidx < splitKeystrokes.length - 1) {
      elements.push(
        <span className="then" key={`then${kidx}`}>
          {' '}
          then{' '}
        </span>
      );
    }
  });
  const className = `shortcut-value ${containerClassName}`;
  return (
    <span key={`keystrokes`} className={className}>
      {elements}
    </span>
  );
};
Keystrokes.displayName = 'Keystrokes';
Keystrokes.propTypes = {
  keyString: PropTypes.string.isRequired,
  containerClassName: PropTypes.string,
};
export default Keystrokes;
