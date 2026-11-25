// The malicious lessons of T-06 (NFR-SEC-07): each payload must come out
// inert, in the parser's tree, in the rendered elements, and in the
// dashboard's preview in a browser. Shared by those three tests.

/** T-06: each payload must come out inert. */
export const MALICIOUS: readonly (readonly [name: string, markdown: string])[] = [
  ["a script tag", "Hello <script>alert(1)</script> world"],
  ["a script block", "<script>\nalert(1)\n</script>\n\nAfter"],
  ["an event handler attribute", 'Look <img src="x" onerror="alert(1)"> here'],
  ["an svg with onload", "<svg onload=alert(1)><circle/></svg>"],
  ["an iframe", '<iframe src="https://evil.example"></iframe>'],
  ["a raw anchor", '<a href="javascript:alert(1)">click</a>'],
  ["a javascript: link", "[click](javascript:alert(1))"],
  ["a JAVASCRIPT: link in capitals", "[click](JAVASCRIPT:alert(1))"],
  ["a link with leading space", "[click]( javascript:alert(1))"],
  ["an entity-encoded scheme", "[click](&#106;avascript:alert(1))"],
  ["a data: link", "[click](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)"],
  ["a vbscript: link", "[click](vbscript:msgbox(1))"],
  ["an http link", "[plain](http://example.com)"],
  ["a protocol-relative link", "[pr](//evil.example)"],
  ["an autolink with javascript:", "<javascript:alert(1)>"],
  ["an image", "![alt text](https://example.com/x.png)"],
  ["an image with a javascript: source", "![x](javascript:alert(1))"],
  ["an HTML comment", "before <!-- <script>alert(1)</script> --> after"],
  ["a style element", "<style>body{display:none}</style>Text"],
  ["HTML nested in emphasis", "**<b onclick=alert(1)>bold</b>**"],
  ["HTML nested in a link label", "[<img src=x onerror=alert(1)>](https://example.com)"],
  ["HTML in a table cell", "| a |\n|---|\n| <script>alert(1)</script> |"],
  ["HTML in a list item", "- <div onmouseover=alert(1)>x</div>"],
  ["HTML in a quote", "> <object data=x></object>"],
  ["a reference-style link", "[x][1]\n\n[1]: javascript:alert(1)"],
  ["an unclosed script tag", "text <script>alert(1)"],
  ["a template element", "<template><script>alert(1)</script></template>"],
];
