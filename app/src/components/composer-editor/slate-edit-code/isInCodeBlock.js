"use strict";

/**
 * Test if current selection is in a code block.
 * @param  {State} state
 * @return {Boolean}
 */
function isInCodeBlock(opts, state) {
  var document = state.document,
      startKey = state.startKey;

  var codeBlock = document.getClosest(startKey, function (block) {
    return block.type === opts.containerType;
  });

  return Boolean(codeBlock);
}

module.exports = isInCodeBlock;