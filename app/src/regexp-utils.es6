/* eslint-disable no-misleading-character-class */
/* eslint-disable no-control-regex */
const _ = require('underscore');

let EmojiData = null;

const UnicodeEmailChars =
  '\u0080-\u00FF\u0100-\u017F\u0180-\u024F\u0250-\u02AF\u0300-\u036F\u0370-\u03FF\u0400-\u04FF\u0500-\u052F\u0530-\u058F\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u07C0-\u07FF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF\u0E00-\u0E7F\u0E80-\u0EFF\u0F00-\u0FFF\u1000-\u109F\u10A0-\u10FF\u1100-\u11FF\u1200-\u137F\u1380-\u139F\u13A0-\u13FF\u1400-\u167F\u1680-\u169F\u16A0-\u16FF\u1700-\u171F\u1720-\u173F\u1740-\u175F\u1760-\u177F\u1780-\u17FF\u1800-\u18AF\u1900-\u194F\u1950-\u197F\u1980-\u19DF\u19E0-\u19FF\u1A00-\u1A1F\u1B00-\u1B7F\u1D00-\u1D7F\u1D80-\u1DBF\u1DC0-\u1DFF\u1E00-\u1EFF\u1F00-\u1FFF\u20D0-\u20FF\u2100-\u214F\u2C00-\u2C5F\u2C60-\u2C7F\u2C80-\u2CFF\u2D00-\u2D2F\u2D30-\u2D7F\u2D80-\u2DDF\u2F00-\u2FDF\u2FF0-\u2FFF\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u3130-\u318F\u3190-\u319F\u31C0-\u31EF\u31F0-\u31FF\u3200-\u32FF\u3300-\u33FF\u3400-\u4DBF\u4DC0-\u4DFF\u4E00-\u9FFF\uA000-\uA48F\uA490-\uA4CF\uA700-\uA71F\uA800-\uA82F\uA840-\uA87F\uAC00-\uD7AF\uF900-\uFAFF';

const RegExpUtils = {
  // It's important that the regex be wrapped in parens, otherwise
  // javascript's RegExp::exec method won't find anything even when the
  // regex matches!
  //
  // It's also imporant we return a fresh copy of the RegExp every time. A
  // javascript regex is stateful and multiple functions using this method
  // will cause unexpected behavior!
  //
  // See http://tools.ietf.org/html/rfc5322#section-3.4 and
  // https://tools.ietf.org/html/rfc6531 and
  // https://en.wikipedia.org/wiki/Email_address#Local_part
  emailRegex({ requireStartOrWhitespace, matchTailOfString } = {}) {
    const parts = [
      `(`,
      `[a-z.A-Z${UnicodeEmailChars}0-9!#$%&\\'*+\\-/=?^_\`{|}~]+`,
      '@',
      `[A-Za-z${UnicodeEmailChars}0-9.-]+\\.[A-Za-z]{2,63}`,
      `)`,
    ];
    if (requireStartOrWhitespace) {
      parts.unshift('(?:^|\\s{1})');
    }
    if (matchTailOfString) {
      parts.push('$');
    }

    return new RegExp(parts.join(''), 'g');
  },

  // http://stackoverflow.com/questions/16631571/javascript-regular-expression-detect-all-the-phone-number-from-the-page-source
  // http://www.regexpal.com/?fam=94521
  // NOTE: This is not exhaustive, and balances what is technically a phone number
  // with what would be annoying to linkify. eg: 12223334444 does not match.
  phoneRegex() {
    return new RegExp(
      /([+(]+|\b)(?:(\d{1,3}[- ()]*)?)(\d{3})[- )]+(\d{3})[- ]+(\d{4})(?: *x(\d+))?\b/g
    );
  },

  //https://regex101.com/r/ZvpGUw/3/tests
  robotEmailRegex() {
    return new RegExp(
      '(^(\\S*[\\.\\-_])?not?[\\.\\-_]?reply([\\.\\-_]\\S*)?@\\S+)|(\\S+@(\\S*\\.)?((mandrillapp\\.com)|(mcsv\\.net)|(rsgsv\\.net)|(mcdlv\\.net))$)|(^@?[^@]*@?$)|\\S+\\+\\S*@\\S+$',
      'i'
    );
  },

  // http://stackoverflow.com/a/16463966
  // http://www.regexpal.com/?fam=93928
  // NOTE: This does not match full urls with `http` protocol components.
  domainRegex(hasAt = false) {
    return new RegExp(
      `^${
        hasAt ? '@' : ''
      }(?!:\\/\\/)([a-zA-Z${UnicodeEmailChars}0-9-_]+\\.)*[a-zA-Z${UnicodeEmailChars}0-9][a-zA-Z${UnicodeEmailChars}0-9-_]+\\.[a-zA-Z]{2,11}?`,
      'i'
    );
  },

  // http://www.regexpal.com/?fam=95875
  hashtagOrMentionRegex() {
    return new RegExp(/\s([@#])([\w_-]+)/i);
  },

  // https://www.safaribooksonline.com/library/view/regular-expressions-cookbook/9780596802837/ch07s16.html
  ipAddressRegex() {
    return new RegExp(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/i);
  },

  mailspringCommandRegex() {
    return new RegExp(/edisonmail:\S+/i);
  },

  // Test cases: https://regex101.com/r/pD7iS5/4
  urlRegex({ matchStartOfString, matchTailOfString } = {}) {
    const commonTlds = [
      'com',
      'org',
      'edu',
      'gov',
      'uk',
      'net',
      'ca',
      'de',
      'jp',
      'fr',
      'au',
      'us',
      'ru',
      'ch',
      'it',
      'nl',
      'se',
      'no',
      'es',
      'mil',
      'ly',
    ];

    const parts = [
      '(',
      // one of:
      '(',
      // This OR block matches any TLD if the URL includes a scheme, and only
      // the top ten TLDs if the scheme is omitted.
      // YES - https://getmailspring.ai
      // YES - https://10.2.3.1
      // YES - getmailspring.com
      // NO  - getmailspring.ai
      '(',
      // scheme, ala https:// (mandatory)
      '([A-Za-z]{3,9}:(?:\\/\\/))',

      // username:password (optional)
      '(?:[\\-;:&=\\+\\$,\\w]+@)?',

      // one of:
      '(',
      // domain with any tld
      '([a-zA-Z0-9-_]+\\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\\.[a-zA-Z]{2,11}',

      '|',

      // ip address
      '(?:[0-9]{1,3}\\.){3}[0-9]{1,3}',
      ')',

      '|',

      // scheme, ala https:// (optional)
      '([A-Za-z]{3,9}:(?:\\/\\/))?',

      // username:password (optional)
      '(?:[\\-;:&=\\+\\$,\\w]+@)?',

      // one of:
      '(',
      // domain with common tld
      `([a-zA-Z0-9-_]+\\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\\.(?:${commonTlds.join('|')})$`,

      '|',

      // ip address
      '(?:[0-9]{1,3}\\.){3}[0-9]{1,3}',
      ')',
      ')',

      // :port (optional)
      '(?::d*)?',

      '|',

      // mailto:username@password.com
      'mailto:\\/*(?:\\w+\\.|[\\-;:&=\\+\\$.,\\w]+@)[A-Za-z0-9\\.\\-]+',
      ')',

      // optionally followed by:
      '(',
      // URL components
      // (last character must not be puncation, hence two groups)
      '(?:[\\+=~%\\/\\.\\w\\-_@]*[\\+~%\\/\\w\\-:_]+)?',

      // optionally followed by: a query string and/or a #location
      // (last character must not be puncation, hence two groups)
      "(?:(\\?[\\-\\+=&;%@\\.\\w_\\#]*[\\#\\-\\+=&;%@\\w_\\/]+)?#?(?:['\\$\\&\\(\\)\\*\\+,;=\\.\\!\\/\\\\\\w%-?]*[\\/\\\\\\w@$\\.&=]+)?)?",
      ')?',
      ')',
    ];
    if (matchStartOfString) {
      parts.unshift('^');
    }
    if (matchTailOfString) {
      parts.push('$');
    }

    return new RegExp(parts.join(''), 'gi');
  },

  // Test cases: https://regex101.com/r/jD5zC7/2
  // Returns the following capturing groups:
  // 1. start of the opening a tag to href="
  // 2. The contents of the href without quotes
  // 3. the rest of the opening a tag
  // 4. the contents of the a tag
  // 5. the closing tag
  linkTagRegex() {
    return new RegExp(/(<a.*?href\s*?=\s*?['"])(.*?)(['"].*?>)([\s\S]*?)(<\/a>)/gim);
  },

  // Test cases: https://regex101.com/r/cK0zD8/4
  // Catches link tags containing which are:
  // - Non empty
  // - Not a mailto: link
  // Returns the following capturing groups:
  // 1. start of the opening a tag to href="
  // 2. The contents of the href without quotes
  // 3. the rest of the opening a tag
  // 4. the contents of the a tag
  // 5. the closing tag
  urlLinkTagRegex() {
    return new RegExp(/(<a.*?href\s*?=\s*?['"])((?!mailto).+?)(['"].*?>)([\s\S]*?)(<\/a>)/gim);
  },

  mailspringSignatureRegex() {
    return /<edo-signature id="([A-Za-z0-9-/\\]+)">[^]*<\/edo-signature>/;
  },

  // https://regex101.com/r/zG7aW4/3
  imageTagRegex() {
    return /<img\s+[^>]*src="([^"]*)"[^>]*>/g;
  },

  // Regex that matches our link tracking urls, surrounded by quotes
  // ("link.getmailspring.com...?redirect=")
  // Test cases: https://regex101.com/r/rB4fO4/3
  // Returns the following capturing groups
  // 1.The redirect url: the actual url you want to visit by clicking a url
  // that matches this regex
  trackedLinkRegex() {
    return /["|']https:\/\/link\.getmailspring\.com\/link\/.*?\?.*?redirect=([^&"']*).*?["|']/g;
  },

  punctuation({ exclude } = {}) {
    if (exclude == null) {
      exclude = [];
    }
    let punctuation = [
      '.',
      ',',
      '\\/',
      '#',
      '!',
      '$',
      '%',
      '^',
      '&',
      '*',
      ';',
      ':',
      '{',
      '}',
      '=',
      '\\-',
      '_',
      '`',
      '~',
      '(',
      ')',
      '@',
      '+',
      '?',
      '>',
      '<',
      '\\[',
      '\\]',
      '+',
    ];
    punctuation = _.difference(punctuation, exclude).join('');
    return new RegExp(`[${punctuation}]`, 'g');
  },

  // This tests for valid schemes as per RFC 3986
  // We need both http: https: and mailto: and a variety of other schemes.
  // This does not check for invalid usage of the http: scheme. For
  // example, http:bad.com would pass. We do not check for
  // protocol-relative uri's.
  //
  // Regex explanation here: https://regex101.com/r/nR2yL6/2
  // See RFC here: https://tools.ietf.org/html/rfc3986#section-3.1
  // SO discussion: http://stackoverflow.com/questions/10687099/how-to-test-if-a-url-string-is-absolute-or-relative/31991870#31991870
  hasValidSchemeRegex() {
    return new RegExp('^[a-z][a-z0-9+.-]*:', 'i');
  },

  emojiRegex() {
    if (!EmojiData) {
      EmojiData = require('emoji-data');
    }
    return new RegExp(`(?:${EmojiData.chars({ include_variants: true }).join('|')})`, 'g');
  },

  looseStyleTag() {
    return /<style/gim;
  },

  // Regular expression matching javasript function arguments:
  // https://regex101.com/r/pZ6zF0/2
  functionArgs() {
    return /(?:\(\s*([^)]+?)\s*\)|(\w+)\s?=>)/;
  },

  illegalPathCharactersRegexp() {
    //https://msdn.microsoft.com/en-us/library/windows/desktop/aa365247(v=vs.85).aspx
    // Important: Do not modify this without also modifying the C++ codebase.
    return /[\\/:|?*><"]/g;
  },

  // Finds the start of a quoted text region as inserted by N1. This is not
  // a general-purpose quote detection scheme and only works for
  // N1-composed emails.
  nativeQuoteStartRegex() {
    return new RegExp(/<\w+[^>]*gmail_quote/i);
  },

  // https://regex101.com/r/jK8cC2/1
  subcategorySplitRegex() {
    return /[./\\]/g;
  },
  // https://stackoverflow.com/questions/11598786/how-to-replace-non-printable-unicode-characters-javascript
  nonPrintableUnicodeRegex: function() {
    return new RegExp(
      /[\x00-\x1F\x7F-\x9F\xAD\u0378\u0379\u037F-\u0383\u038B\u038D\u03A2\u0528-\u0530\u0557\u0558\u0560\u0588\u058B-\u058E\u0590\u05C8-\u05CF\u05EB-\u05EF\u05F5-\u0605\u061C\u061D\u06DD\u070E\u070F\u074B\u074C\u07B2-\u07BF\u07FB-\u07FF\u082E\u082F\u083F\u085C\u085D\u085F-\u089F\u08A1\u08AD-\u08E3\u08FF\u0978\u0980\u0984\u098D\u098E\u0991\u0992\u09A9\u09B1\u09B3-\u09B5\u09BA\u09BB\u09C5\u09C6\u09C9\u09CA\u09CF-\u09D6\u09D8-\u09DB\u09DE\u09E4\u09E5\u09FC-\u0A00\u0A04\u0A0B-\u0A0E\u0A11\u0A12\u0A29\u0A31\u0A34\u0A37\u0A3A\u0A3B\u0A3D\u0A43-\u0A46\u0A49\u0A4A\u0A4E-\u0A50\u0A52-\u0A58\u0A5D\u0A5F-\u0A65\u0A76-\u0A80\u0A84\u0A8E\u0A92\u0AA9\u0AB1\u0AB4\u0ABA\u0ABB\u0AC6\u0ACA\u0ACE\u0ACF\u0AD1-\u0ADF\u0AE4\u0AE5\u0AF2-\u0B00\u0B04\u0B0D\u0B0E\u0B11\u0B12\u0B29\u0B31\u0B34\u0B3A\u0B3B\u0B45\u0B46\u0B49\u0B4A\u0B4E-\u0B55\u0B58-\u0B5B\u0B5E\u0B64\u0B65\u0B78-\u0B81\u0B84\u0B8B-\u0B8D\u0B91\u0B96-\u0B98\u0B9B\u0B9D\u0BA0-\u0BA2\u0BA5-\u0BA7\u0BAB-\u0BAD\u0BBA-\u0BBD\u0BC3-\u0BC5\u0BC9\u0BCE\u0BCF\u0BD1-\u0BD6\u0BD8-\u0BE5\u0BFB-\u0C00\u0C04\u0C0D\u0C11\u0C29\u0C34\u0C3A-\u0C3C\u0C45\u0C49\u0C4E-\u0C54\u0C57\u0C5A-\u0C5F\u0C64\u0C65\u0C70-\u0C77\u0C80\u0C81\u0C84\u0C8D\u0C91\u0CA9\u0CB4\u0CBA\u0CBB\u0CC5\u0CC9\u0CCE-\u0CD4\u0CD7-\u0CDD\u0CDF\u0CE4\u0CE5\u0CF0\u0CF3-\u0D01\u0D04\u0D0D\u0D11\u0D3B\u0D3C\u0D45\u0D49\u0D4F-\u0D56\u0D58-\u0D5F\u0D64\u0D65\u0D76-\u0D78\u0D80\u0D81\u0D84\u0D97-\u0D99\u0DB2\u0DBC\u0DBE\u0DBF\u0DC7-\u0DC9\u0DCB-\u0DCE\u0DD5\u0DD7\u0DE0-\u0DF1\u0DF5-\u0E00\u0E3B-\u0E3E\u0E5C-\u0E80\u0E83\u0E85\u0E86\u0E89\u0E8B\u0E8C\u0E8E-\u0E93\u0E98\u0EA0\u0EA4\u0EA6\u0EA8\u0EA9\u0EAC\u0EBA\u0EBE\u0EBF\u0EC5\u0EC7\u0ECE\u0ECF\u0EDA\u0EDB\u0EE0-\u0EFF\u0F48\u0F6D-\u0F70\u0F98\u0FBD\u0FCD\u0FDB-\u0FFF\u10C6\u10C8-\u10CC\u10CE\u10CF\u1249\u124E\u124F\u1257\u1259\u125E\u125F\u1289\u128E\u128F\u12B1\u12B6\u12B7\u12BF\u12C1\u12C6\u12C7\u12D7\u1311\u1316\u1317\u135B\u135C\u137D-\u137F\u139A-\u139F\u13F5-\u13FF\u169D-\u169F\u16F1-\u16FF\u170D\u1715-\u171F\u1737-\u173F\u1754-\u175F\u176D\u1771\u1774-\u177F\u17DE\u17DF\u17EA-\u17EF\u17FA-\u17FF\u180F\u181A-\u181F\u1878-\u187F\u18AB-\u18AF\u18F6-\u18FF\u191D-\u191F\u192C-\u192F\u193C-\u193F\u1941-\u1943\u196E\u196F\u1975-\u197F\u19AC-\u19AF\u19CA-\u19CF\u19DB-\u19DD\u1A1C\u1A1D\u1A5F\u1A7D\u1A7E\u1A8A-\u1A8F\u1A9A-\u1A9F\u1AAE-\u1AFF\u1B4C-\u1B4F\u1B7D-\u1B7F\u1BF4-\u1BFB\u1C38-\u1C3A\u1C4A-\u1C4C\u1C80-\u1CBF\u1CC8-\u1CCF\u1CF7-\u1CFF\u1DE7-\u1DFB\u1F16\u1F17\u1F1E\u1F1F\u1F46\u1F47\u1F4E\u1F4F\u1F58\u1F5A\u1F5C\u1F5E\u1F7E\u1F7F\u1FB5\u1FC5\u1FD4\u1FD5\u1FDC\u1FF0\u1FF1\u1FF5\u1FFF\u200B-\u200F\u202A-\u202E\u2060-\u206F\u2072\u2073\u208F\u209D-\u209F\u20BB-\u20CF\u20F1-\u20FF\u218A-\u218F\u23F4-\u23FF\u2427-\u243F\u244B-\u245F\u2700\u2B4D-\u2B4F\u2B5A-\u2BFF\u2C2F\u2C5F\u2CF4-\u2CF8\u2D26\u2D28-\u2D2C\u2D2E\u2D2F\u2D68-\u2D6E\u2D71-\u2D7E\u2D97-\u2D9F\u2DA7\u2DAF\u2DB7\u2DBF\u2DC7\u2DCF\u2DD7\u2DDF\u2E3C-\u2E7F\u2E9A\u2EF4-\u2EFF\u2FD6-\u2FEF\u2FFC-\u2FFF\u3040\u3097\u3098\u3100-\u3104\u312E-\u3130\u318F\u31BB-\u31BF\u31E4-\u31EF\u321F\u32FF\u4DB6-\u4DBF\u9FCD-\u9FFF\uA48D-\uA48F\uA4C7-\uA4CF\uA62C-\uA63F\uA698-\uA69E\uA6F8-\uA6FF\uA78F\uA794-\uA79F\uA7AB-\uA7F7\uA82C-\uA82F\uA83A-\uA83F\uA878-\uA87F\uA8C5-\uA8CD\uA8DA-\uA8DF\uA8FC-\uA8FF\uA954-\uA95E\uA97D-\uA97F\uA9CE\uA9DA-\uA9DD\uA9E0-\uA9FF\uAA37-\uAA3F\uAA4E\uAA4F\uAA5A\uAA5B\uAA7C-\uAA7F\uAAC3-\uAADA\uAAF7-\uAB00\uAB07\uAB08\uAB0F\uAB10\uAB17-\uAB1F\uAB27\uAB2F-\uABBF\uABEE\uABEF\uABFA-\uABFF\uD7A4-\uD7AF\uD7C7-\uD7CA\uD7FC-\uF8FF\uFA6E\uFA6F\uFADA-\uFAFF\uFB07-\uFB12\uFB18-\uFB1C\uFB37\uFB3D\uFB3F\uFB42\uFB45\uFBC2-\uFBD2\uFD40-\uFD4F\uFD90\uFD91\uFDC8-\uFDEF\uFDFE\uFDFF\uFE1A-\uFE1F\uFE27-\uFE2F\uFE53\uFE67\uFE6C-\uFE6F\uFE75\uFEFD-\uFF00\uFFBF-\uFFC1\uFFC8\uFFC9\uFFD0\uFFD1\uFFD8\uFFD9\uFFDD-\uFFDF\uFFE7\uFFEF-\uFFFB\uFFFE\uFFFF]/g
    );
  },
};

module.exports = RegExpUtils;
