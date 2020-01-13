'use strict';

/**
 * Unwrap a code block into a normal block.
 *
 * @param  {Transform} transform
 * @param  {String} key
 * @param  {String} type
 * @return {Transform}
 */
function unwrapCodeBlockByKey(opts, transform, key, type) {
    var _transform = transform,
        state = _transform.state;
    var document = state.document;

    // Get the code block

    var codeBlock = document.getDescendant(key);

    if (!codeBlock || codeBlock.type != opts.containerType) {
        throw new Error('Block passed to unwrapCodeBlockByKey should be a code block container');
    }

    // Transform lines into paragraph
    codeBlock.nodes.forEach(function (line) {
        transform = transform.setNodeByKey(line.key, { type: type });
        transform = transform.unwrapNodeByKey(line.key);
    });

    return transform;
}

module.exports = unwrapCodeBlockByKey;