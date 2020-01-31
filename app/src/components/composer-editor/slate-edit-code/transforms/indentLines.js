"use strict";

/**
 * Indent all lines in selection
 * @param  {Transform} transform
 * @param  {String} indent
 * @return {Transform}
 */
function indentLines(opts, transform, indent) {
    var state = transform.state;
    var document = state.document,
        selection = state.selection;

    var lines = document.getBlocksAtRange(selection).filter(function (node) {
        return node.type === opts.lineType;
    });

    return lines.reduce(function (tr, line) {
        // Insert an indent at start of line
        var text = line.nodes.first();
        return tr.insertTextByKey(text.key, 0, indent);
    }, transform);
}

module.exports = indentLines;