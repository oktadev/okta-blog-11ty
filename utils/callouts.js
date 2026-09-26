// Code callouts: a "<1>" at the end of a code line, optionally behind a
// comment marker, becomes a numbered badge the way Asciidoctor renders it:
//   foo(); // <1>   ->   foo(); <i class="conum" data-value="1"></i><b>(1)</b>
// Applied to highlighted HTML, where the code is already escaped and may be
// wrapped in Prism token spans. Lines are separated by <br> or newlines.
const MARKER =
  /(?:<span class="token[^"]*">)?\s*(?:(?:\/\/|#|;;|--|\/\*)?\s*&lt;(\d{1,2})&gt;(?:\s*\*\/)?|&lt;!--(\d{1,2})--&gt;)\s*(?:<\/span>)?\s*$/;

export function badge(n) {
  return `<i class="conum" data-value="${n}"></i><b>(${n})</b>`;
}

export function renderCallouts(html) {
  if (!html.includes("&lt;")) return html;
  return html
    .split(/(<br\s*\/?>|\n)/)
    .map((part) =>
      /^(<br\s*\/?>|\n)$/.test(part)
        ? part
        : part.replace(
            MARKER,
            (m, a, b) => (m.startsWith(" ") ? " " : "") + badge(a ?? b),
          ),
    )
    .join("");
}
