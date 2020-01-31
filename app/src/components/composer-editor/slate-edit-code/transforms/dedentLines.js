"use strict";

/**
 * Dedent all lines in selection
 * @param  {Transform} transform
 * @param  {String} indent To remove
 * @return {Transform}
 */
function dedentLines(opts, transform, indent) {
    var state = transform.state;
    var document = state.document,
        selection = state.selection;

    var lines = document.getBlocksAtRange(selection).filter(function (node) {
        return node.type === opts.lineType;
    });

    return lines.reduce(function (tr, line) {
        // Remove a level of indent from the start of line
        var text = line.nodes.first();
        var lengthToRemove = text.characters.takeWhile(function (char, index) {
            return indent.charAt(index) === char.text;
        }).count();
        return tr.removeTextByKey(text.key, 0, lengthToRemove);
    }, transform);
}

module.exports = dedentLines;