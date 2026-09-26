"""Requirement-driven ARIA lint (D3).

The official hidden tests assert accessible names (role + exact name) that the
new-style requirements spell out in backticks ("a button named `Take a note`").
Generated apps systematically miss that layer (2026-09-21 regrade: keep
32/32 -> 1/32, bookstack 34/34 -> 18/34; every failure was an unnamed input, a
missing <article>, or a renamed control). This module extracts those contracts
from the requirements tree and turns them into a Playwright lint spec the
acceptance loop can run without any hidden tests -- which is exactly what a
formal platform run has available.

Extraction is deliberately conservative (a false lint failure burns a repair
round; a missed contract only loses a hint):

- only descriptions and GIVEN/WHEN scenario steps; THEN steps describe
  post-action state, where elements legitimately do not exist yet;
- a sentence containing BOTH an activation verb (click/hover/fill/...) and an
  appearance verb (exposes/opens/displays/...) describes a control that is
  brought into existence by an action -- skipped;
- render-on-open roles (dialog, menu, status message) are skipped;
- names are matched only in "role named `X`" / "labelled role `X`" orders,
  never "`X` role" (that form also matches post-action names like a toast's
  `Undo` button).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, replace

# role word -> canonical ARIA role (None = recognized but never linted)
ROLE_WORDS: dict[str, str | None] = {
    "email textbox": "textbox",
    "password textbox": "textbox",
    "search box": "searchbox",
    "searchbox": "searchbox",
    "text box": "textbox",
    "textbox": "textbox",
    "textboxes": "textbox",
    "button": "button",
    "buttons": "button",
    "region": "region",
    "regions": "region",
    "heading": "heading",
    "headings": "heading",
    "form": "form",
    "forms": "form",
    "link": "link",
    "links": "link",
    "checkbox": "checkbox",
    "checkboxes": "checkbox",
    "tab": "tab",
    "tabs": "tab",
    # dialogs are lintable since R3: static definitional sentences name them
    # and named triggers ("the `Rename` menu item opens ...") let the probe
    # walk to them. Pronoun-triggered ones ("activating it opens ...") stay
    # out via the dynamic guard.
    "dialog": "dialog",
    "dialogs": "dialog",
    "option": "option",
    "options": "option",
    "menu item": "menuitem",
    "menuitem": "menuitem",
    "menuitems": "menuitem",
    "switch": "switch",
    "switches": "switch",
    "combobox": "combobox",
    "combo box": "combobox",
    "combo boxes": "combobox",
    "dropdown": "combobox",
    "radio": "radio",
    "radio option": "radio",
    "radio options": "radio",
    "list": "list",
    "lists": "list",
    # recognized, always dropped: rendered on interaction without a nameable
    # trigger we can walk (toasts, bare menus, unnamed modals)
    "modal": None,
    "menu": None,
    "menus": None,
    "status message": None,
}
_ROLE_ALT = "|".join(sorted(ROLE_WORDS, key=len, reverse=True))
_VERB = r"(?:uniquely\s+)?(?:named|called|labelled|labeled|with\s+the\s+accessible\s+name)"

# P1: role + verb + `Name` (and `, ` / ` and ` chained names)
_P1 = re.compile(rf"\b({_ROLE_ALT})\s+{_VERB}\s+((?:`[^`]+`)(?:\s*(?:,|and)\s*`[^`]+`)*)", re.I)
# P2: verb + role (+ "or role") + `Name`  ("labelled email textbox `Email address`",
# "named region or heading `Pinned`")
_P2 = re.compile(rf"{_VERB}\s+({_ROLE_ALT})(?:\s+or\s+({_ROLE_ALT}))?\s+`([^`]+)`", re.I)
# P3: the explicit role+accessible-name construction ("a form with role `form`
# and accessible name `Login form`"); proximity matching would jump across the
# neighbouring "heading named `Login`" and steal its name.
_P3 = re.compile(r"with\s+role\s+`([a-zA-Z ]+)`\s+and\s+accessible\s+name\s+`([^`]+)`", re.I)
# P4: article (+ optional "unique") + `Name` + role ("a `Confirm import`
# button", "the unique `Sign in` link") -- the definitional name-role order
# the formal-race requirements (hackathon--github/sheet) use throughout. The
# leading article requirement keeps post-action mentions ("a toast's `Undo`
# button") out: a possessive between article and name breaks the adjacency.
# Dialect-gated: enabled only when the tree quotes names with typographic
# double quotes (the formal-race dialect). Backtick dialects (keep/bookstack)
# use the same shape for dialog-internal operation steps ("fill the `Title`
# textbox"), so P4 stays off there -- one shape, two meanings, split by
# delimiter instead of guesswork.
_P4 = re.compile(rf"\b(?:a|an|the)\s+(?:unique\s+)?`([^`]+)`\s+({_ROLE_ALT})\b", re.I)
# P5: the "uses the ARIA <role> role, has the accessible name `X`" construction
# the formal-race FOLDER descriptions define page-level structure with ("the
# active worksheet grid uses the ARIA grid role, has the accessible name
# `Worksheet grid`"). The role word sits behind "role," so P1's role-verb
# adjacency never fires; the name may trail by a clause, hence the bounded gap.
_P5 = re.compile(r"\b(?:uses?|using|with)\s+the\s+ARIA\s+([a-zA-Z]+)\s+role\b"
                 r"[^.;]{0,80}?\b(?:has\s+|with\s+|carries?\s+|bearing\s+)?"
                 r"the\s+accessible\s+name\s+`([^`]+)`", re.I)
# P6: per-item dynamic naming pinned by an example -- "Grid cells use the
# ARIA gridcell role with their cell coordinates as accessible names
# (for example, A1)". The name slot itself is dynamic ("their cell
# coordinates"), so only the example literal is lintable -- and it is exactly
# what the behavioral tests locate first (cell 'A1').
_P6 = re.compile(r"\(\s*for\s+example,\s*`?([A-Za-z0-9][A-Za-z0-9 _-]*)`?\s*\)", re.I)
_P6_ROLE = re.compile(r"\b(?:uses?|using)\s+the\s+ARIA\s+([a-zA-Z]+)\s+role\b", re.I)
# P7 pass 1, role declarations: "Worksheet tabs on the same editor page use
# the ARIA tab role" -- the plural noun phrase ("worksheet tab") declares
# which vocabulary names things of that role.
_P7_DECLARE = re.compile(r"\b([a-zA-Z][a-zA-Z]*(?:\s+[a-zA-Z]+)?)s\b"
                         r"[^.;]{0,60}?\buse\s+the\s+ARIA\s+([a-zA-Z]+)\s+role\b", re.I)
# P7 pass 2, name bindings: "a blank worksheet named `Sheet1`" -- article +
# up to two adjectives + a declared noun word + "named X". The name is either
# quoted (backticked after normalization) or a bare identifier of 1-3
# capitalized tokens ("named Sheet1, with Sheet1 active" -- the sheet
# requirements leave seed names unquoted; lowercase stop-words end the
# capture). Binds the literal to the role the declaration sentence assigned
# that noun family.
_P7_BIND = re.compile(r"\b(?:a|an|the)\s+(?:[a-z]+\s+){0,2}([a-zA-Z]+)\s+"
                      r"(?:uniquely\s+)?named\s+(?:`([^`]+)`"
                      r"|([A-Z][A-Za-z0-9_]*(?:\s+[A-Z][A-Za-z0-9_]*){0,2}))")
# P8: declared name FORMS -- "Row numbers use the ARIA rowheader role with the
# decimal row number as the accessible name; column headers ... the column
# letter". The name slot is a vocabulary ("the decimal row number"), not a
# literal, so the contract carries a form; the spec asserts the role exists
# named like that (a digit, a letter). The 2026-09-26 arch-1 artifact
# labelled its row headers "Row 1" -- exact-name '1' locators died.
_P8 = re.compile(r"\buse\s+the\s+ARIA\s+([a-zA-Z]+)\s+role\s+with\s+(?:the\s+|their\s+)?"
                 r"((?:decimal\s+)?[a-z]+(?:\s+[a-z]+)?)\s+as\s+(?:the\s+)?accessible\s+names?", re.I)
_FORM_MAP = (("row number", "digit"), ("digit", "digit"), ("number", "digit"),
             ("letter", "letter"), ("coordinate", "coordinate"))
# P9: dialog revival. (a) trigger-in-sentence: "The `Rename` menu item opens
# a dialog named `Rename worksheet`" -- dynamic sentence, but the named
# trigger makes the dialog walkable, so it harvests with its trigger.
# (b) chain sentences: "choose `Sort range` from the `Data` menu" /
# "clicking the `Import CSV` button" / "through the `Delete` command" yield
# an ordered trigger chain for the node's static dialog sentences
# ("A dialog named `Sort range` provides ..."). Pronoun triggers
# ("activating it opens ...", keep's editor) harvest nothing.
_P9_TRIGGER = re.compile(r"`([^`]+)`\s+(?:menu\s+item|button|command|link|option|tab)\s+"
                         r"opens?\s+(?:a|an|the)\s+dialog\s+" + _VERB + r"\s+`([^`]+)`", re.I)
_P9_STATIC = re.compile(r"\b(?:a|an|the)\s+dialog\s+" + _VERB + r"\s+`([^`]+)`", re.I)
_P9_CHAIN = re.compile(r"\b(?:choose|clicks?|clicking|selects?|selecting|presses?|pressing|through)\s+"
                       r"(?:the\s+)?`([^`]+)`(?:\s+(?:command|button|menu\s+item))?"
                       r"(?:\s+(?:from|in)\s+(?:the\s+)?`([^`]+)`\s+menu)?", re.I)
# K3: selection state. "with Sheet1 active and A1 selected" pins the fresh-
# workbook selection; the FOLDER text states the active tab is "indicated by
# aria-selected=\"true\"". Both are structural assertions the arch-1 app
# failed (it set aria-selected="false" on every cell at render).
_SELECTED_CELL = re.compile(r"\b([A-Z]{1,3}\d{1,4})\s+selected\b")
_TAB_SELECTED = re.compile(r"active\s+tab[^.;]{0,60}aria-selected", re.I)
# article existence ("is exposed as a unique article", "an article containing", "article named by")
_ARTICLE = re.compile(r"(?:\b(?:is|are)\s+(?:exposed\s+as\s+)?an?\s+(?:unique\s+)?article\b"
                      r"|\ban\s+article\s+containing\b|\barticle\s+named\s+by\b)", re.I)

_ACTIVATE = re.compile(r"\b(?:activat\w*|hover\w*|click\w*|press\w*|select\w*|choos\w*|typing|type[ds]?\b"
                       r"|enter\w*|fill\w*|toggl\w*|open\w*|delet\w*|creat\w*|remov\w*|updat\w*|check\w*"
                       r"|collaps\w*|expand\w*|add\w*|sav\w*|submit\w*|clos\w*|log\w*)", re.I)
# A sentence naming controls *inside* a render-on-open container ("The `Note
# editor` dialog contains a button named `Close`") describes unmounted-until-
# opened UI. Construction-based so "settings options menu from a unique button
# named `Settings`" (the button is static) survives.
_CONTAINER = re.compile(r"\b(?:dialog|modal|dropdown|notification|toast|menu|view)\b"
                        r"[^.;]{0,50}\b(?:contains|containing|has|having|shows?)\b", re.I)
_APPEAR = re.compile(r"\b(?:expos\w*|open\w*|reveal\w*|appear\w*|pop\w*|display\w*|show\w*|render\w*"
                     r"|present\w*)", re.I)
# passive definition: "is the form opened by the unique link named X" -- the
# github formal-race requirements open many feature sections this way
_PASSIVE_OPEN = re.compile(r"\b(?:is|are|was|were)\s+(?:the\s+)?\w+\s+opened\s+by\b", re.I)

# templated accessible names ('Worksheet options for <worksheet name>') name a
# per-instance control; no literal ever matches, so linting them just burns
# repair attempts on an assertion that cannot pass.
_PLACEHOLDER = re.compile(r"<[^>]+>")

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?;])\s+")


def sentence_is_dynamic(sentence: str) -> bool:
    """True when the sentence describes controls an action brings into being:
    it takes both an activation verb and an appearance verb. "The page exposes a
    region named X" (no activation) is static; "activating it exposes a button
    named X" is dynamic. Passive definitions ("The registration page is the
    form opened by the unique link named X") name pre-existing entry points,
    not action-born UI -- the participle 'opened' there feeds both verb lists
    and would otherwise false-gate the sentence."""
    if _PASSIVE_OPEN.search(sentence):
        return False
    return bool(_ACTIVATE.search(sentence) and _APPEAR.search(sentence))


@dataclass(frozen=True)
class Contract:
    role: str
    name: str | None  # None = existence-only (article) or a name form
    node_id: str
    # R3 extensions; defaults keep every pre-existing construction working.
    name_form: str | None = None   # 'digit' / 'letter': names follow a form
    selected: bool = False         # assert aria-selected="true" on this one
    triggers: tuple[str, ...] = ()  # ordered controls that open a dialog


def _normalize_quotes(text: str) -> str:
    """Quote-dialect normalization at the single text gateway. Curly double
    quotes (“Save”, the github formal-race dialect) always normalize to
    backticks. The 2026-09-25 revision of the sheet requirements switched its
    description text to straight double quotes ("Save") -- those carry names
    too, but only in pieces with no backticks of their own: a piece that
    already uses backticks (exercise docs, sheet scenario steps) keeps them
    authoritative, so straight quotes there stay prose."""
    if "“" in text:
        return text.replace("“", "`").replace("”", "`")
    if "`" not in text:
        return text.replace('"', "`")
    return text


def _sentences(node: dict) -> list[str]:
    """Descriptions and GIVEN/WHEN steps, sentence-split. THEN steps are
    post-action state and are skipped on purpose."""
    parts: list[str] = []
    if node.get("description"):
        parts.append(_normalize_quotes(str(node["description"])))
    for scenario in node.get("scenarios") or []:
        for step in scenario.get("steps") or []:
            if str(step.get("keyword", "")).strip().upper() in ("THEN",):
                continue
            content = str(step.get("content", "")).strip()
            if content:
                parts.append(_normalize_quotes(content))
    out: list[str] = []
    for part in parts:
        out.extend(s for s in _SENTENCE_SPLIT.split(part) if s.strip())
    return out


def _add(found: set[Contract], node_id: str, role: str | None, name: str) -> None:
    if role is None:  # render-on-open role: recognized, never linted
        return
    if _PLACEHOLDER.search(name):  # per-instance template, no literal to lint
        return
    found.add(Contract(role=role, name=name, node_id=node_id))


def _formal_dialect(tree: dict) -> bool:
    """Formal-race dialect detector, two arms: (a) any typographic double
    quote anywhere (the github task); (b) the 2026-09-25 sheet revision quotes
    description names with straight double quotes and keeps backticks only
    for scenario seed literals -- when straight-quoted description pieces
    outnumber backticked ones, the descriptions are straight-dialect. The
    exercise tasks (keep/bookstack) carry names in backticked descriptions,
    so both arms stay false for them."""
    curly = False
    straight_desc = 0
    backtick_desc = 0

    def collect(node: dict) -> None:
        nonlocal curly, straight_desc, backtick_desc
        desc = str(node.get("description") or "")
        if desc:
            if "“" in desc:
                curly = True
            elif "`" in desc:
                backtick_desc += 1
            elif '"' in desc:
                straight_desc += 1
        for child in node.get("children") or []:
            if isinstance(child, dict):
                collect(child)

    collect(tree)
    return curly or straight_desc > backtick_desc


def extract_contracts(tree: dict) -> dict[str, list[Contract]]:
    """node_id -> sorted contracts for every ATOMIC node in the tree.

    FOLDER descriptions define page-level structure shared by the whole
    subtree ("the active worksheet grid uses the ARIA grid role, has the
    accessible name `Worksheet grid`" sits in REQ-1's FOLDER text) -- the
    2026-09-26 sheet run shipped a grid with no accessible name because that
    sentence never reached an atomic node's check. Folder contracts are
    harvested and inherited by every ATOMIC descendant."""
    by_node: dict[str, set[Contract]] = {}
    p4_enabled = _formal_dialect(tree)

    # P7 pass 1: role declarations tree-wide ("Worksheet tabs ... use the
    # ARIA tab role") -> noun word -> canonical role, so binding sentences
    # anywhere in the tree ("a blank worksheet named `Sheet1`") can resolve.
    declared: dict[str, str] = {}

    def collect_declarations(node: dict) -> None:
        for sentence in _sentences(node):
            for phrase, role_text in _P7_DECLARE.findall(sentence):
                canonical = role_text.lower().strip()
                role = ROLE_WORDS.get(canonical, canonical)
                if role is None:
                    continue
                for word in phrase.lower().split() + [canonical]:
                    declared[word] = role
        for child in node.get("children") or []:
            if isinstance(child, dict):
                collect_declarations(child)

    collect_declarations(tree)

    # tree-wide: does this task state the active tab via aria-selected?
    # ("with the active tab indicated by aria-selected=\"true\"", REQ-1
    # FOLDER) -- selection twins are emitted for every tab contract.
    def _all_text(node: dict, acc: list[str]) -> None:
        if node.get("description"):
            acc.append(_normalize_quotes(str(node["description"])))
        for child in node.get("children") or []:
            if isinstance(child, dict):
                _all_text(child, acc)

    texts: list[str] = []
    _all_text(tree, texts)
    tab_selected = bool(_TAB_SELECTED.search(" ".join(texts)))

    def harvest(node: dict, node_id: str) -> set[Contract]:
        found: set[Contract] = set()
        sentences = _sentences(node)
        # P9 pre-pass: the node's ordered trigger chain, from its interaction
        # sentences ("choose `Sort range` from the `Data` menu" -> Data, then
        # Sort range; "from/in the `M` menu" opens M first).
        chain: list[str] = []
        for sentence in sentences:
            for item, menu in _P9_CHAIN.findall(sentence):
                for name in ((menu, item) if menu else (item,)):
                    if name and name not in chain and not _PLACEHOLDER.search(name):
                        chain.append(name)
        for sentence in sentences:
            # P1-P5 and the article marker describe static wiring;
            # action-born UI is not theirs to assert. P6/P7 below bind
            # literal names to declared roles and run regardless: the
            # creation-flow probe reaches post-action pages, and requirement
            # text names persistent results inside action sentences ("after
            # creation succeeds ... a blank worksheet named `Sheet1`").
            if not (sentence_is_dynamic(sentence) or _CONTAINER.search(sentence)):
                if _ARTICLE.search(sentence):
                    found.add(Contract(role="article", name=None, node_id=node_id))
                for role_word, chain_names in _P1.findall(sentence):
                    for name in re.findall(r"`([^`]+)`", chain_names):
                        _add(found, node_id, ROLE_WORDS.get(role_word.lower()), name)
                for role_word, _or_word, name in _P2.findall(sentence):
                    _add(found, node_id, ROLE_WORDS.get(role_word.lower()), name)
                for role_text, name in _P3.findall(sentence):
                    canonical = role_text.lower().strip()
                    _add(found, node_id, ROLE_WORDS.get(canonical, canonical), name)
                if p4_enabled:
                    for name, role_word in _P4.findall(sentence):
                        _add(found, node_id, ROLE_WORDS.get(role_word.lower()), name)
                for role_text, name in _P5.findall(sentence):
                    canonical = role_text.lower().strip()
                    _add(found, node_id, ROLE_WORDS.get(canonical, canonical), name)
            example = _P6.search(sentence)
            if example:
                role_match = _P6_ROLE.search(sentence)
                if role_match:
                    canonical = role_match.group(1).lower().strip()
                    _add(found, node_id, ROLE_WORDS.get(canonical, canonical), example.group(1))
            for noun, quoted, bare in _P7_BIND.findall(sentence):
                role = declared.get(noun.lower())
                if role:
                    _add(found, node_id, role, quoted or bare)
            # P8: declared name forms, next to the P6/P7 ungated binds
            for role_text, form_noun in _P8.findall(sentence):
                canonical = role_text.lower().strip()
                role = ROLE_WORDS.get(canonical, canonical)
                form = next((f for key, f in _FORM_MAP if key in form_noun.lower()), None)
                if role and form and form != "coordinate":
                    found.add(Contract(role=role, name=None, node_id=node_id, name_form=form))
            # P9 dialogs: named-trigger sentences harvest even though they
            # are dynamic; static ones harvest through P1 above. A dynamic
            # sentence with only an unnamed/pronoun trigger stays skipped.
            m9 = _P9_TRIGGER.search(sentence)
            if m9 and not _PLACEHOLDER.search(m9.group(2)):
                found.add(Contract(role="dialog", name=m9.group(2), node_id=node_id,
                                   triggers=(m9.group(1),)))
            elif _P9_STATIC.search(sentence) and sentence_is_dynamic(sentence) and chain:
                # e.g. "the system displays a dialog named `Delete worksheet`"
                # -- dynamic, but the node's chain ("through the `Delete`
                # command") makes it walkable
                name = _P9_STATIC.search(sentence).group(1)
                if not _PLACEHOLDER.search(name):
                    found.add(Contract(role="dialog", name=name, node_id=node_id,
                                       triggers=tuple(chain)))
            # K3 selection state
            for coord in _SELECTED_CELL.findall(sentence):
                _add(found, node_id, "gridcell", coord)
                found.add(Contract(role="gridcell", name=coord, node_id=node_id, selected=True))
        if tab_selected:
            for c in [c for c in found if c.role == "tab"]:
                found.add(Contract(role="tab", name=c.name, node_id=c.node_id, selected=True))
        # arm static dialogs (P1-harvested, no triggers of their own) with
        # the node's trigger chain so the probe can walk to them
        if chain:
            found = {c if (c.role != "dialog" or c.triggers)
                     else Contract(role="dialog", name=c.name, node_id=c.node_id,
                                   triggers=tuple(chain))
                     for c in found}
        return found

    def walk(node: dict, inherited: set[Contract]) -> None:
        children = [c for c in (node.get("children") or []) if isinstance(c, dict)]
        node_type = str(node.get("type") or "").upper()
        node_id = str(node.get("id") or "")
        if node_id and (node_type == "ATOMIC" or (not children and node_type != "FOLDER")):
            found = harvest(node, node_id) | {
                c if c.node_id == node_id else replace(c, node_id=node_id) for c in inherited
            }
            if found:
                by_node[node_id] = found
        elif node_type == "FOLDER":
            # rebind inherited contracts to descendants; the folder's own
            # harvest joins the pool its subtree inherits
            inherited = inherited | harvest(node, node_id) if node_id else inherited
        for child in children:
            walk(child, inherited)

    walk(tree, set())
    return {nid: sorted(contracts, key=lambda c: (c.role, c.name or "")) for nid, contracts in by_node.items()}


def _js_regex_escape(text: str) -> str:
    return re.sub(r"([.*+?^${}()|[\]\\])", r"\\\1", text)


def lint_spec_source(contracts: list[Contract], routes: list[str]) -> str:
    """One Playwright spec asserting every contract exists on some route.

    `includeHidden: true` keeps hover-revealed controls (CSS-hidden until hover)
    countable -- the lint checks the role/name wiring is in the DOM, not its
    transient visibility.
    """
    route_list = ", ".join(json_quote(route) for route in routes) or '"/"'
    form_rx = {"digit": r"^\d+$", "letter": r"^[A-Z]+$"}
    tests: list[str] = []
    for contract in contracts:
        if contract.role == "dialog" and contract.name:
            # dialogs may sit unmounted until opened: walk the trigger chain
            title = f"ARIA-lint: dialog {contract.name!r} reachable ({contract.node_id})"
            name_rx = f"/^{_js_regex_escape(contract.name)}$/i"
            trig_list = ", ".join(f"/^{_js_regex_escape(t)}$/i" for t in contract.triggers)
            tests.append(
                f"test({json_quote(title)}, async ({{ page }}) => {{\n"
                f"  const ok = await dialogReachable(page, {name_rx}, [{trig_list}]);\n"
                f"  expect(ok, {json_quote(title + ' -- never opened')}).toBeTruthy();\n"
                f"}});")
            continue
        if contract.name_form and contract.name is None:
            title = (f"ARIA-lint: {contract.role} named by "
                     f"{'decimal number' if contract.name_form == 'digit' else 'letter'}"
                     f" ({contract.node_id})")
            rx = form_rx[contract.name_form]
            probe = (f"p.getByRole('{contract.role}', "
                     f"{{ name: /{rx}/, includeHidden: true }}).count()")
            tests.append(
                f"test({json_quote(title)}, async ({{ page }}) => {{\n"
                f"  const n = await countOnAnyRoute(page, (p) => {probe});\n"
                f"  expect(n, {json_quote(title + ' -- not found on any route')}).toBeGreaterThan(0);\n"
                f"}});")
            continue
        if contract.selected and contract.name:
            title = f"ARIA-lint: {contract.role} {contract.name!r} selected ({contract.node_id})"
            loc = (f"p.getByRole('{contract.role}', "
                   f"{{ name: /^{_js_regex_escape(contract.name)}$/i, includeHidden: true }})")
            probe = (f"(await {loc}.count()) && "
                     f"(await {loc}.first().getAttribute('aria-selected')) === 'true' ? 1 : 0")
            tests.append(
                f"test({json_quote(title)}, async ({{ page }}) => {{\n"
                f"  const n = await countOnAnyRoute(page, async (p) => {probe});\n"
                f"  expect(n, {json_quote(title + ' -- not aria-selected=true anywhere')}).toBeGreaterThan(0);\n"
                f"}});")
            continue
        title = f"ARIA-lint: {contract.role} {contract.name!r} ({contract.node_id})" if contract.name \
            else f"ARIA-lint: at least one article ({contract.node_id})"
        if contract.role == "article" and contract.name is None:
            probe = "p.getByRole('article').count()"
        else:
            probe = (f"p.getByRole('{contract.role}', "
                     f"{{ name: /^{ _js_regex_escape(contract.name)}$/i, includeHidden: true }}).count()")
        tests.append(
            f"test({json_quote(title)}, async ({{ page }}) => {{\n"
            f"  const n = await countOnAnyRoute(page, (p) => {probe});\n"
            f"  expect(n, {json_quote(title + ' -- not found on any route')}).toBeGreaterThan(0);\n"
            f"}});")
    return (
        "import { test, expect } from '@playwright/test';\n\n"
        f"const ROUTES = [{route_list}];\n\n"
        "async function countOnAnyRoute(page, probe) {\n"
        "  for (const route of ROUTES) {\n"
        "    await page.goto(route).catch(() => {});\n"
        "    const n = await probe(page);\n"
        "    if (n > 0) return n;\n"
        "  }\n"
        "  return await countViaCreationFlow(page, probe);\n"
        "}\n"
        "// Feature pages sit behind creation flows (\"New blank workbook\" ->\n"
        "// \"Create\" opens the editor); a bare-route probe never sees the grid\n"
        "// until a workbook exists. Generic creation vocabulary only, and every\n"
        "// step guarded: a probe that cannot walk the flow reports 0, it never\n"
        "// fails the spec. verify_node runs this against a disposable app copy,\n"
        "// so records the flow creates never ship.\n"
        "async function countViaCreationFlow(page, probe) {\n"
        "  try {\n"
        "    await page.goto('/');\n"
        "    const starters = page.getByRole('button', { name: /^(new|create)\\b/i });\n"
        "    const n = Math.min(await starters.count(), 2);\n"
        "    for (let i = 0; i < n; i++) {\n"
        "      const btn = starters.nth(i);\n"
        "      if (!(await btn.isVisible().catch(() => false))) continue;\n"
        "      await btn.click({ timeout: 2000 }).catch(() => {});\n"
        "      const create = page.getByRole('button', { name: /^create$/i });\n"
        "      if (await create.count()) {\n"
        "        await create.first().click({ timeout: 2000 }).catch(() => {});\n"
        "      }\n"
        "      await page.waitForTimeout(600);\n"
        "      const found = await probe(page);\n"
        "      if (found > 0) return found;\n"
        "      await page.goto('/');\n"
        "    }\n"
        "  } catch {}\n"
        "  return 0;\n"
        "}\n"
        "// Dialogs sit behind trigger chains (\"choose `Sort range` from the\n"
        "// `Data` menu\" -> Data, then Sort range; the trigger may itself live\n"
        "// inside a menu opened by a \"... menu\" control). Count hidden wiring\n"
        "// first (includeHidden), then walk: bare routes, then the creation\n"
        "// flow, clicking named controls in order and opening menu-like\n"
        "// containers when a step is not visible. Every step guarded: an\n"
        "// unreachable dialog reports false, it never throws.\n"
        "async function dialogReachable(page, nameRx, triggers) {\n"
        "  const present = async (p, hidden) =>\n"
        "    (await p.getByRole('dialog', { name: nameRx, includeHidden: hidden }).count()) > 0;\n"
        "  const clickNamed = async (rx) => {\n"
        "    for (const role of ['menuitem', 'button', 'link', 'tab', 'option']) {\n"
        "      const el = page.getByRole(role, { name: rx }).first();\n"
        "      if (await el.isVisible().catch(() => false)) {\n"
        "        await el.click({ timeout: 1500 }).catch(() => {});\n"
        "        return true;\n"
        "      }\n"
        "    }\n"
        "    return false;\n"
        "  };\n"
        "  const walk = async () => {\n"
        "    try {\n"
        "      if (await present(page, false)) return true;\n"
        "      for (const t of triggers) {\n"
        "        if (!(await clickNamed(t))) {\n"
        "          const menus = page.getByRole('button', { name: /menu|more options|\\u22ee/i });\n"
        "          const m = Math.min(await menus.count(), 3);\n"
        "          for (let i = 0; i < m; i++) {\n"
        "            await menus.nth(i).click({ timeout: 1200 }).catch(() => {});\n"
        "            await page.waitForTimeout(300);\n"
        "            if (await clickNamed(t)) break;\n"
        "          }\n"
        "        }\n"
        "        await page.waitForTimeout(400);\n"
        "        if (await present(page, false)) return true;\n"
        "      }\n"
        "      await clickNamed(nameRx);\n"
        "      await page.waitForTimeout(400);\n"
        "    } catch {}\n"
        "    return await present(page, false);\n"
        "  };\n"
        "  for (const route of ROUTES) {\n"
        "    await page.goto(route).catch(() => {});\n"
        "    if (await present(page, true)) return true;\n"
        "    if (await walk()) return true;\n"
        "  }\n"
        "  try {\n"
        "    await page.goto('/');\n"
        "    const starters = page.getByRole('button', { name: /^(new|create)\\b/i });\n"
        "    const n = Math.min(await starters.count(), 2);\n"
        "    for (let i = 0; i < n; i++) {\n"
        "      const btn = starters.nth(i);\n"
        "      if (!(await btn.isVisible().catch(() => false))) continue;\n"
        "      await btn.click({ timeout: 2000 }).catch(() => {});\n"
        "      const create = page.getByRole('button', { name: /^create$/i });\n"
        "      if (await create.count()) {\n"
        "        await create.first().click({ timeout: 2000 }).catch(() => {});\n"
        "      }\n"
        "      await page.waitForTimeout(600);\n"
        "      if (await present(page, true) || await walk()) return true;\n"
        "      await page.goto('/');\n"
        "    }\n"
        "  } catch {}\n"
        "  return false;\n"
        "}\n\n" + "\n\n".join(tests) + "\n")


def json_quote(text: str) -> str:
    return '"' + text.replace("\\", "\\\\").replace('"', '\\"') + '"'
