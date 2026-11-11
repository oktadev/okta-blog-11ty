// Code callouts: "<1>" at the end of a code line, optionally behind a comment
// marker, becomes the numbered badge Asciidoctor renders:
//   foo(); // <1>   ->   foo(); <i class="conum" data-value="1"></i><b>(1)</b>
// Applied to highlighted HTML, where the code is already escaped and may be
// wrapped in Prism token spans. Lines are separated by <br> or newlines.
// Several markers may end one line ("// <1> <2>"). Prism escapes "<" but not
// ">" while markdown-it escapes both, so either form of ">" is accepted.
const MARKER =
  /(?:<span class="token[^"]*">)?\s*(?:(?:\/\/|#|;;|--|\/\*)?\s*((?:&lt;\d{1,2}(?:&gt;|>)\s*)+)(?:\*\/)?|((?:&lt;!--\d{1,2}--(?:&gt;|>)\s*)+))\s*(?:<\/span>)?\s*$/;
const NUMBERS = /\d{1,2}/g;
// The highlighter hands us a whole block, so the last line of code is followed
// by the closing tags rather than the end of the string, and MARKER's "$" can't
// see it. Peel the wrapper off and put it back.
const WRAPPER = /^(<pre[^>]*><code[^>]*>)([\s\S]*)(<\/code><\/pre>\s*)$/;

export function badge(n) {
  return `<i class="conum" data-value="${n}"></i><b>(${n})</b>`;
}

function renderLines(html) {
  return html
    .split(/(<br\s*\/?>|\n)/)
    .map((part) =>
      /^(<br\s*\/?>|\n)$/.test(part)
        ? part
        : part.replace(
            MARKER,
            (m, a, b) =>
              (m.startsWith(" ") ? " " : "") +
              (a ?? b).match(NUMBERS).map(badge).join(" "),
          ),
    )
    .join("");
}

export function renderCallouts(html) {
  if (!html.includes("&lt;")) return html;
  const wrapper = html.match(WRAPPER);
  return wrapper
    ? wrapper[1] + renderLines(wrapper[2]) + wrapper[3]
    : renderLines(html);
}
