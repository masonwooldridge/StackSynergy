export const plainTextInputProps = { autoCorrect: "off", autoCapitalize: "none", spellCheck: false, autoComplete: "off" } as const;
const selector = 'input:not([type]),input[type="text"],input[type="search"],input[type="email"],input[type="url"],input[type="tel"],input[type="password"],textarea,[contenteditable]:not([contenteditable="false"])';
export function applyPlainTextBehavior(root: ParentNode) {
  for (const field of root.querySelectorAll<HTMLElement>(selector)) {
    for (const [attribute, value] of [["autocorrect", "off"], ["autocapitalize", "none"], ["spellcheck", "false"]])
      if (field.getAttribute(attribute) !== value) field.setAttribute(attribute, value);
    const completion = field.getAttribute("autocomplete") || "";
    // Never read field values; keep explicit account password-manager tokens.
    if (!/(?:^|\s)(?:username|current-password|new-password)(?:\s|$)/.test(completion) && completion !== "off") field.setAttribute("autocomplete", "off");
  }
}
if (typeof document !== "undefined") {
  applyPlainTextBehavior(document);
  const observer = new MutationObserver(() => applyPlainTextBehavior(document));
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["contenteditable"] });
  import.meta.hot?.dispose(() => observer.disconnect());
}
