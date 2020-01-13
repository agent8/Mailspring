'use strict';

var deserializeCode = require('../deserializeCode');

/**
 * Wrap a block into a code block.
 *
 * @param  {Transform} transform
 * @param  {String} key
 * @return {Transform}
 */
function wrapCodeBlockByKey(opts, transform, key) {
    var state = transform.state;
    var document = state.document;


    var startBlock = document.getDescendant(key);
    var text = startBlock.text;

    // Remove all child
    startBlock.nodes.forEach(function (node) {
        transform.removeNodeByKey(node.key, { normalize: false });
    });

    // Insert new text
    var toInsert = deserializeCode(opts, text);

    toInsert.nodes.forEach(function (node, i) {
        transform.insertNodeByKey(startBlock.key, i, node);
    });

    // Set node type
    transform.setNodeByKey(startBlock.key, {
        type: opts.containerType
    });

    return transform;
}

module.exports = wrapCodeBlockByKey;