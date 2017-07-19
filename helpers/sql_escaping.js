'use strict';

var sql_regex = new RegExp (/[\0\x08\x09\x1a\n\r"'\\\%]/g);
var sql_escaper = function sql_escaper(char) {
    var m = ['\\0', '\\x08', '\\x09', '\\x1a', '\\n', '\\r', "'", '"', "\\", '\\\\', "%"];
    var r = ['\\\\0', '\\\\b', '\\\\t', '\\\\z', '\\\\n', '\\\\r', "''", '""', '\\\\', '\\\\\\\\', '\\%'];
    return r[m.indexOf(char)];
};

function format (str) {
    if (typeof str !== 'string') {
        return str;
    }

	return str.replace (sql_regex, sql_escaper);
};

module.exports = format;
