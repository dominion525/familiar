-- familiar — Google Chrome control script for macOS
-- Version: 0.1.0
-- License: MIT
-- Copyright (c) 2026 dominion525
-- Usage: osascript familiar.applescript ACTION [ARGS...]
--
-- Actions:
--   list_tabs
--   new_tab
--   new_incognito_tab
--   navigate WID TID URL
--   reload WID TID
--   go_back WID TID
--   go_forward WID TID
--   stop WID TID
--   close_tab WID TID
--   wait_for_load WID TID MAX_WAIT
--   wait_for_selector WID TID SELECTOR MAX_WAIT
--   wait_for_function WID TID JS_EXPR MAX_WAIT
--   get_html WID TID
--   get_tab_url WID TID
--   active_tab WID
--   window_mode WID
--   is_loading WID TID
--   execute_js WID TID EXPRESSION
--   execute_js_file WID TID JS_FILE_PATH
--   click WID TID SELECTOR
--   fill WID TID SELECTOR VALUE
--   get_text WID TID SELECTOR
--   get_attribute WID TID SELECTOR NAME
--   get_value WID TID SELECTOR
--   exists WID TID SELECTOR
--   query_all WID TID SELECTOR
--   clear WID TID SELECTOR
--   select_option WID TID SELECTOR VALUE
--   set_checked WID TID SELECTOR BOOL
--   press_key WID TID SELECTOR KEY
--   submit WID TID SELECTOR
--   scroll_into_view WID TID SELECTOR
--
-- SELECTOR forms (see selectorResolverJs):
--   CSS (default)   e.g. "button.submit", "#email"
--   text=...        match by trimmed visible text (innermost element)
--   xpath=...       match by XPath (first node)
--   label=...       match a form control via its <label> / aria-label

on run argv
	if (count of argv) is 0 then
		error "No action given. Usage: osascript familiar.applescript ACTION [ARGS...]"
	end if
	set action to item 1 of argv

	-- Save focus
	tell application "System Events"
		set frontApp to name of first application process whose frontmost is true
	end tell

	-- Default for void actions; overwritten by actions that return a value.
	set actionResult to ""

	-- Dispatch is a plain if/else chain: AppleScript has no dynamic dispatch by
	-- name, and `run script` (eval) would be an unsafe, slower anti-pattern.
	-- Wrapped in try so focus is restored even when an action fails.
	try
		if action is "list_tabs" then
			set actionResult to my doListTabs()
		else if action is "new_tab" then
			set actionResult to my doNewTab()
		else if action is "new_incognito_tab" then
			set actionResult to my doNewIncognitoTab()
		else if action is "navigate" then
			my checkArgs(argv, 4, "navigate WID TID URL")
			my doNavigate(item 2 of argv, item 3 of argv, item 4 of argv)
		else if action is "reload" then
			my checkArgs(argv, 3, "reload WID TID")
			my doReload(item 2 of argv, item 3 of argv)
		else if action is "go_back" then
			my checkArgs(argv, 3, "go_back WID TID")
			my doGoBack(item 2 of argv, item 3 of argv)
		else if action is "go_forward" then
			my checkArgs(argv, 3, "go_forward WID TID")
			my doGoForward(item 2 of argv, item 3 of argv)
		else if action is "stop" then
			my checkArgs(argv, 3, "stop WID TID")
			my doStop(item 2 of argv, item 3 of argv)
		else if action is "close_tab" then
			my checkArgs(argv, 3, "close_tab WID TID")
			my doCloseTab(item 2 of argv, item 3 of argv)
		else if action is "wait_for_load" then
			my checkArgs(argv, 4, "wait_for_load WID TID MAX_WAIT")
			set actionResult to my doWaitForLoad(item 2 of argv, item 3 of argv, item 4 of argv)
		else if action is "wait_for_selector" then
			my checkArgs(argv, 5, "wait_for_selector WID TID SELECTOR MAX_WAIT")
			set actionResult to my doWaitForSelector(item 2 of argv, item 3 of argv, item 4 of argv, item 5 of argv)
		else if action is "get_html" then
			my checkArgs(argv, 3, "get_html WID TID")
			set actionResult to my doGetHtml(item 2 of argv, item 3 of argv)
		else if action is "get_tab_url" then
			my checkArgs(argv, 3, "get_tab_url WID TID")
			set actionResult to my doGetTabUrl(item 2 of argv, item 3 of argv)
		else if action is "active_tab" then
			my checkArgs(argv, 2, "active_tab WID")
			set actionResult to my doActiveTab(item 2 of argv)
		else if action is "window_mode" then
			my checkArgs(argv, 2, "window_mode WID")
			set actionResult to my doWindowMode(item 2 of argv)
		else if action is "is_loading" then
			my checkArgs(argv, 3, "is_loading WID TID")
			set actionResult to my doIsLoading(item 2 of argv, item 3 of argv)
		else if action is "execute_js" then
			my checkArgs(argv, 4, "execute_js WID TID EXPRESSION")
			set actionResult to my doExecuteJs(item 2 of argv, item 3 of argv, item 4 of argv)
		else if action is "execute_js_file" then
			my checkArgs(argv, 4, "execute_js_file WID TID JS_FILE_PATH")
			set actionResult to my doExecuteJsFile(item 2 of argv, item 3 of argv, item 4 of argv)
		else if action is "click" then
			my checkArgs(argv, 4, "click WID TID SELECTOR")
			set actionResult to my doClick(item 2 of argv, item 3 of argv, item 4 of argv)
		else if action is "fill" then
			my checkArgs(argv, 5, "fill WID TID SELECTOR VALUE")
			set actionResult to my doFill(item 2 of argv, item 3 of argv, item 4 of argv, item 5 of argv)
		else if action is "get_text" then
			my checkArgs(argv, 4, "get_text WID TID SELECTOR")
			set actionResult to my doGetText(item 2 of argv, item 3 of argv, item 4 of argv)
		else if action is "get_attribute" then
			my checkArgs(argv, 5, "get_attribute WID TID SELECTOR NAME")
			set actionResult to my doGetAttribute(item 2 of argv, item 3 of argv, item 4 of argv, item 5 of argv)
		else if action is "get_value" then
			my checkArgs(argv, 4, "get_value WID TID SELECTOR")
			set actionResult to my doGetValue(item 2 of argv, item 3 of argv, item 4 of argv)
		else if action is "exists" then
			my checkArgs(argv, 4, "exists WID TID SELECTOR")
			set actionResult to my doExists(item 2 of argv, item 3 of argv, item 4 of argv)
		else if action is "query_all" then
			my checkArgs(argv, 4, "query_all WID TID SELECTOR")
			set actionResult to my doQueryAll(item 2 of argv, item 3 of argv, item 4 of argv)
		else if action is "clear" then
			my checkArgs(argv, 4, "clear WID TID SELECTOR")
			set actionResult to my doClear(item 2 of argv, item 3 of argv, item 4 of argv)
		else if action is "select_option" then
			my checkArgs(argv, 5, "select_option WID TID SELECTOR VALUE")
			set actionResult to my doSelectOption(item 2 of argv, item 3 of argv, item 4 of argv, item 5 of argv)
		else if action is "set_checked" then
			my checkArgs(argv, 5, "set_checked WID TID SELECTOR BOOL")
			set actionResult to my doSetChecked(item 2 of argv, item 3 of argv, item 4 of argv, item 5 of argv)
		else if action is "press_key" then
			my checkArgs(argv, 5, "press_key WID TID SELECTOR KEY")
			set actionResult to my doPressKey(item 2 of argv, item 3 of argv, item 4 of argv, item 5 of argv)
		else if action is "submit" then
			my checkArgs(argv, 4, "submit WID TID SELECTOR")
			set actionResult to my doSubmit(item 2 of argv, item 3 of argv, item 4 of argv)
		else if action is "scroll_into_view" then
			my checkArgs(argv, 4, "scroll_into_view WID TID SELECTOR")
			set actionResult to my doScrollIntoView(item 2 of argv, item 3 of argv, item 4 of argv)
		else if action is "wait_for_function" then
			my checkArgs(argv, 5, "wait_for_function WID TID JS_EXPR MAX_WAIT")
			set actionResult to my doWaitForFunction(item 2 of argv, item 3 of argv, item 4 of argv, item 5 of argv)
		else
			error "Unknown action: " & action
		end if
	on error errMsg number errNum
		-- Restore focus even when the action failed, then re-raise.
		tell application frontApp to activate
		error errMsg number errNum
	end try

	-- Restore focus
	tell application frontApp to activate

	return actionResult
end run

-- ============================================================
-- Helpers
-- ============================================================

-- Run JavaScript in a specific tab and return its completion value.
-- Centralizes (window id, tab id) targeting so callers don't repeat the
-- nested tells. Result is the last evaluated expression (like the DevTools
-- console); a top-level `return` does not work.
on runJs(wId, tId, jsExpr)
	tell application "Google Chrome"
		tell (tab id (tId as integer) of window id (wId as integer))
			return execute javascript jsExpr
		end tell
	end tell
end runJs

-- Validate that argv has at least reqCount items (the action name is item 1).
-- Raises a clear "usage: ..." error when called with too few arguments, instead
-- of AppleScript's cryptic "Can't get item N of {...}".
on checkArgs(argv, reqCount, usage)
	if (count of argv) < reqCount then
		error "usage: " & usage
	end if
end checkArgs

-- ============================================================
-- Tab / window management
-- ============================================================

on doListTabs()
	tell application "Google Chrome"
		set output to ""
		repeat with aWindow in (every window)
			set windowId to id of aWindow
			repeat with aTab in (every tab of aWindow)
				set tabId to id of aTab
				set tabTitle to title of aTab
				set tabURL to URL of aTab
				set output to output & windowId & "," & tabId & "," & tabTitle & "," & tabURL & linefeed
			end repeat
		end repeat
		return output
	end tell
end doListTabs

-- Open a new tab in a normal (non-incognito) window.
on doNewTab()
	return my openTabInMode("normal")
end doNewTab

-- Open a new tab in an incognito window.
on doNewIncognitoTab()
	return my openTabInMode("incognito")
end doNewIncognitoTab

-- Open a tab in the front-most window of the given mode ("normal" or
-- "incognito"). Reuses such a window if one exists; otherwise creates a new
-- window and reuses its initial tab so no blank tab is left behind.
on openTabInMode(targetMode)
	tell application "Google Chrome"
		set targetWindow to missing value
		repeat with aWindow in (every window)
			if mode of aWindow is targetMode then
				set targetWindow to aWindow
				exit repeat
			end if
		end repeat
		if targetWindow is missing value then
			if targetMode is "incognito" then
				set targetWindow to (make new window with properties {mode:"incognito"})
			else
				set targetWindow to (make new window)
			end if
			-- A freshly created window already has one (blank) tab; reuse it.
			set newTab to (tab 1 of targetWindow)
		else
			set newTab to (make new tab at end of tabs of targetWindow)
		end if
		set windowId to id of targetWindow
		set tabId to id of newTab
		return (windowId as text) & "," & (tabId as text)
	end tell
end openTabInMode

on doCloseTab(wId, tId)
	tell application "Google Chrome"
		close (tab id (tId as integer) of window id (wId as integer))
	end tell
end doCloseTab

-- Return the active tab of a window as "windowId,tabId".
on doActiveTab(wId)
	tell application "Google Chrome"
		set tabId to id of active tab of window id (wId as integer)
	end tell
	return (wId as text) & "," & (tabId as text)
end doActiveTab

-- Return a window's mode ("normal" or "incognito").
on doWindowMode(wId)
	tell application "Google Chrome"
		return mode of window id (wId as integer)
	end tell
end doWindowMode

-- Return whether a tab is currently loading ("true" or "false"). Native, so it
-- works even when "Allow JavaScript from Apple Events" is off.
on doIsLoading(wId, tId)
	tell application "Google Chrome"
		return (loading of (tab id (tId as integer) of window id (wId as integer))) as text
	end tell
end doIsLoading

-- ============================================================
-- Navigation
-- ============================================================

on doNavigate(wId, tId, targetURL)
	tell application "Google Chrome"
		set URL of (tab id (tId as integer) of window id (wId as integer)) to targetURL
	end tell
	-- Wait for navigation to begin (until readyState leaves "complete")
	repeat 6 times
		if (my runJs(wId, tId, "document.readyState")) is not "complete" then exit repeat
		delay 0.5
	end repeat
end doNavigate

-- Reload a tab.
on doReload(wId, tId)
	tell application "Google Chrome"
		reload (tab id (tId as integer) of window id (wId as integer))
	end tell
end doReload

-- Navigate a tab back in its history (if possible).
on doGoBack(wId, tId)
	tell application "Google Chrome"
		go back (tab id (tId as integer) of window id (wId as integer))
	end tell
end doGoBack

-- Navigate a tab forward in its history (if possible).
on doGoForward(wId, tId)
	tell application "Google Chrome"
		go forward (tab id (tId as integer) of window id (wId as integer))
	end tell
end doGoForward

-- Stop the tab from loading.
on doStop(wId, tId)
	tell application "Google Chrome"
		stop (tab id (tId as integer) of window id (wId as integer))
	end tell
end doStop

on doGetTabUrl(wId, tId)
	tell application "Google Chrome"
		return URL of (tab id (tId as integer) of window id (wId as integer))
	end tell
end doGetTabUrl

-- ============================================================
-- Waiting
-- ============================================================

on doWaitForLoad(wId, tId, maxWait)
	set waited to 0
	repeat while waited < (maxWait as integer)
		if (my runJs(wId, tId, "document.readyState")) is "complete" then return "complete"
		delay 0.5
		set waited to waited + 0.5
	end repeat
	return "timeout"
end doWaitForLoad

on doWaitForSelector(wId, tId, cssSelector, maxWait)
	set safeSelector to my jsEscape(cssSelector)
	set jsExpr to "String(document.querySelector('" & safeSelector & "') !== null)"
	set waited to 0
	repeat while waited < (maxWait as integer)
		if (my runJs(wId, tId, jsExpr)) is "true" then return "found"
		delay 0.5
		set waited to waited + 0.5
	end repeat
	return "timeout"
end doWaitForSelector

-- Poll a JavaScript expression until it is truthy. JS_EXPR is raw JS (an
-- expression, not a selector). Returns "true" once truthy, or "timeout".
on doWaitForFunction(wId, tId, jsExpr, maxWait)
	set probe to "(function(){try{return String(Boolean(" & jsExpr & "));}catch(e){return 'false';}})()"
	set waited to 0
	repeat while waited < (maxWait as integer)
		if (my runJs(wId, tId, probe)) is "true" then return "true"
		delay 0.5
		set waited to waited + 0.5
	end repeat
	return "timeout"
end doWaitForFunction

-- ============================================================
-- Content / scripting
-- ============================================================

on doGetHtml(wId, tId)
	return my runJs(wId, tId, "document.documentElement.outerHTML")
end doGetHtml

on doExecuteJs(wId, tId, jsExpr)
	return my runJs(wId, tId, jsExpr)
end doExecuteJs

-- Read JavaScript from a file and run it. Avoids all shell/quoting
-- escaping for complex scripts: write the JS to a file, pass its path.
on doExecuteJsFile(wId, tId, filePath)
	set jsContent to (read (POSIX file filePath) as «class utf8»)
	return my runJs(wId, tId, jsContent)
end doExecuteJsFile

-- ============================================================
-- Element actions
-- ============================================================

-- JavaScript that defines __famFind(selector): resolves an element from a
-- selector string. Supports "text=", "xpath=", "label=" prefixes; otherwise
-- treats the string as a CSS selector. Returns the element or null.
-- (Uses only single quotes so it can sit inside an AppleScript double-quoted
-- string.) This is prepended to each element-action script.
on selectorResolverJs()
	return "function __famFind(sel){
  if (sel.indexOf('text=') === 0) {
    var t = sel.slice(5).trim();
    var all = document.querySelectorAll('body *');
    var matches = [];
    for (var i = 0; i < all.length; i++) { if (all[i].textContent.trim() === t) matches.push(all[i]); }
    for (var i = 0; i < matches.length; i++) {
      var hasInner = false;
      for (var j = 0; j < matches.length; j++) { if (i !== j && matches[i].contains(matches[j])) { hasInner = true; break; } }
      if (!hasInner) return matches[i];
    }
    return matches.length ? matches[0] : null;
  }
  if (sel.indexOf('xpath=') === 0) {
    var r = document.evaluate(sel.slice(6), document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    return r.singleNodeValue;
  }
  if (sel.indexOf('label=') === 0) {
    var t = sel.slice(6).trim();
    var labels = document.querySelectorAll('label');
    for (var i = 0; i < labels.length; i++) {
      if (labels[i].textContent.trim() === t) {
        var f = labels[i].getAttribute('for');
        if (f) { var el = document.getElementById(f); if (el) return el; }
        var inner = labels[i].querySelector('input, textarea, select');
        if (inner) return inner;
      }
    }
    var aria = document.querySelectorAll('[aria-label]');
    for (var i = 0; i < aria.length; i++) { if (aria[i].getAttribute('aria-label').trim() === t) return aria[i]; }
    return null;
  }
  return document.querySelector(sel);
}
function __famFindAll(sel){
  if (sel.indexOf('xpath=') === 0) {
    var r = document.evaluate(sel.slice(6), document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    var a = []; for (var i = 0; i < r.snapshotLength; i++) a.push(r.snapshotItem(i)); return a;
  }
  if (sel.indexOf('text=') === 0 || sel.indexOf('label=') === 0) {
    var el = __famFind(sel); return el ? [el] : [];
  }
  return Array.prototype.slice.call(document.querySelectorAll(sel));
}
"
end selectorResolverJs

-- Click an element. Returns "true" on success, "not_found" if no element matched.
on doClick(wId, tId, sel)
	set js to my selectorResolverJs() & "(function(){
  var el = __famFind('" & my jsEscape(sel) & "');
  if (!el) return 'not_found';
  el.scrollIntoView({block: 'center'});
  el.click();
  return 'true';
})()"
	return my runJs(wId, tId, js)
end doClick

-- Fill an input/textarea via the native value setter so frameworks (React etc.)
-- detect the change, then fire input/change. Returns "true" / "not_found".
on doFill(wId, tId, sel, val)
	set js to my selectorResolverJs() & "(function(){
  var el = __famFind('" & my jsEscape(sel) & "');
  if (!el) return 'not_found';
  el.focus();
  var proto = (el instanceof window.HTMLTextAreaElement) ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  var setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  setter.call(el, '" & my jsEscape(val) & "');
  el.dispatchEvent(new Event('input', {bubbles: true}));
  el.dispatchEvent(new Event('change', {bubbles: true}));
  return 'true';
})()"
	return my runJs(wId, tId, js)
end doFill

-- Get an element's visible text. Returns a JSON envelope:
--   {"found": false}                  // no element matched
--   {"found": true, "value": "..."}   // element found
-- The envelope avoids the previous sentinel collision: a page element whose
-- visible text was literally "not_found" used to be misreported as missing.
on doGetText(wId, tId, sel)
	set js to my selectorResolverJs() & "(function(){
  var el = __famFind('" & my jsEscape(sel) & "');
  if (!el) return JSON.stringify({found: false});
  return JSON.stringify({found: true, value: (el.innerText || el.textContent || '').trim()});
})()"
	return my runJs(wId, tId, js)
end doGetText

-- Get an attribute value. Returns a JSON envelope:
--   {"found": false}                  // no element matched
--   {"found": true, "value": "..."}   // element found; value is "" when the
--                                     // attribute itself is absent on the element
on doGetAttribute(wId, tId, sel, attrName)
	set js to my selectorResolverJs() & "(function(){
  var el = __famFind('" & my jsEscape(sel) & "');
  if (!el) return JSON.stringify({found: false});
  var v = el.getAttribute('" & my jsEscape(attrName) & "');
  return JSON.stringify({found: true, value: v === null ? '' : v});
})()"
	return my runJs(wId, tId, js)
end doGetAttribute

-- Get an input/textarea/select value. Returns a JSON envelope:
--   {"found": false}                  // no element matched
--   {"found": true, "value": "..."}   // element found; value is "" when the
--                                     // form control has no value set
on doGetValue(wId, tId, sel)
	set js to my selectorResolverJs() & "(function(){
  var el = __famFind('" & my jsEscape(sel) & "');
  if (!el) return JSON.stringify({found: false});
  var v = (el.value === undefined || el.value === null) ? '' : String(el.value);
  return JSON.stringify({found: true, value: v});
})()"
	return my runJs(wId, tId, js)
end doGetValue

-- Whether a matching element exists. Returns "true" or "false".
on doExists(wId, tId, sel)
	set js to my selectorResolverJs() & "(function(){
  return String(__famFind('" & my jsEscape(sel) & "') !== null);
})()"
	return my runJs(wId, tId, js)
end doExists

-- Trimmed text of every matching element, as a JSON array string.
on doQueryAll(wId, tId, sel)
	set js to my selectorResolverJs() & "(function(){
  return JSON.stringify(__famFindAll('" & my jsEscape(sel) & "').map(function(el){ return (el.innerText || el.textContent || '').trim(); }));
})()"
	return my runJs(wId, tId, js)
end doQueryAll

-- Clear an input/textarea via the native value setter, then fire input/change
-- so frameworks (React etc.) detect the change. Returns "true" / "not_found".
on doClear(wId, tId, sel)
	set js to my selectorResolverJs() & "(function(){
  var el = __famFind('" & my jsEscape(sel) & "');
  if (!el) return 'not_found';
  el.focus();
  var proto = (el instanceof window.HTMLTextAreaElement) ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  var setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  setter.call(el, '');
  el.dispatchEvent(new Event('input', {bubbles: true}));
  el.dispatchEvent(new Event('change', {bubbles: true}));
  return 'true';
})()"
	return my runJs(wId, tId, js)
end doClear

-- Select an <option> in a <select> by its value, falling back to its visible
-- text. Sets the value via the native setter so frameworks detect it, then fires
-- input/change. Returns a JSON envelope:
--   {"ok": true}                              // option selected
--   {"ok": false, "kind": "no_option"}        // select found, no matching option
--   {"ok": false, "kind": "not_found"}        // no select matched the selector
on doSelectOption(wId, tId, sel, val)
	set js to my selectorResolverJs() & "(function(){
  var el = __famFind('" & my jsEscape(sel) & "');
  if (!el) return JSON.stringify({ok: false, kind: 'not_found'});
  var want = '" & my jsEscape(val) & "';
  var opts = el.options || [];
  var match = null;
  for (var i = 0; i < opts.length; i++) { if (opts[i].value === want) { match = opts[i]; break; } }
  if (!match) { for (var i = 0; i < opts.length; i++) { if ((opts[i].textContent || '').trim() === want) { match = opts[i]; break; } } }
  if (!match) return JSON.stringify({ok: false, kind: 'no_option'});
  var setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  setter.call(el, match.value);
  el.dispatchEvent(new Event('input', {bubbles: true}));
  el.dispatchEvent(new Event('change', {bubbles: true}));
  return JSON.stringify({ok: true});
})()"
	return my runJs(wId, tId, js)
end doSelectOption

-- Check or uncheck a checkbox/radio. VALUE is \"true\" / \"false\". Sets the
-- checked state via the native setter, then fires input/change. Returns
-- \"true\" / \"not_found\".
on doSetChecked(wId, tId, sel, val)
	set js to my selectorResolverJs() & "(function(){
  var el = __famFind('" & my jsEscape(sel) & "');
  if (!el) return 'not_found';
  var want = '" & my jsEscape(val) & "' === 'true';
  var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'checked').set;
  setter.call(el, want);
  el.dispatchEvent(new Event('input', {bubbles: true}));
  el.dispatchEvent(new Event('change', {bubbles: true}));
  return 'true';
})()"
	return my runJs(wId, tId, js)
end doSetChecked

-- Dispatch a synthetic keydown/keypress/keyup for KEY (e.g. \"Enter\", \"a\") on
-- the element. Events are isTrusted=false, so strict handlers may ignore them.
-- Returns \"true\" / \"not_found\".
on doPressKey(wId, tId, sel, keyName)
	set js to my selectorResolverJs() & "(function(){
  var el = __famFind('" & my jsEscape(sel) & "');
  if (!el) return 'not_found';
  el.focus();
  var k = '" & my jsEscape(keyName) & "';
  var codes = {Enter: 13, Tab: 9, Escape: 27, Backspace: 8, Delete: 46, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, ' ': 32};
  var kc = (k in codes) ? codes[k] : (k.length === 1 ? k.charCodeAt(0) : 0);
  ['keydown', 'keypress', 'keyup'].forEach(function(type){
    el.dispatchEvent(new KeyboardEvent(type, {key: k, keyCode: kc, which: kc, bubbles: true, cancelable: true}));
  });
  return 'true';
})()"
	return my runJs(wId, tId, js)
end doPressKey

-- Submit the form the element belongs to (or the element itself if it is a
-- form). Uses requestSubmit so submit handlers/validation run. Returns a JSON
-- envelope:
--   {"ok": true}                              // form submitted
--   {"ok": false, "kind": "no_form"}          // element matched but no form
--   {"ok": false, "kind": "not_found"}        // no element matched
on doSubmit(wId, tId, sel)
	set js to my selectorResolverJs() & "(function(){
  var el = __famFind('" & my jsEscape(sel) & "');
  if (!el) return JSON.stringify({ok: false, kind: 'not_found'});
  var form = (el instanceof window.HTMLFormElement) ? el : (el.form || el.closest('form'));
  if (!form) return JSON.stringify({ok: false, kind: 'no_form'});
  if (typeof form.requestSubmit === 'function') { form.requestSubmit(); } else { form.submit(); }
  return JSON.stringify({ok: true});
})()"
	return my runJs(wId, tId, js)
end doSubmit

-- Scroll an element into view (centered). Returns \"true\" / \"not_found\".
on doScrollIntoView(wId, tId, sel)
	set js to my selectorResolverJs() & "(function(){
  var el = __famFind('" & my jsEscape(sel) & "');
  if (!el) return 'not_found';
  el.scrollIntoView({block: 'center', inline: 'center'});
  return 'true';
})()"
	return my runJs(wId, tId, js)
end doScrollIntoView

-- ============================================================
-- String utilities
-- ============================================================

-- Escape a string for safe embedding inside a single-quoted JS literal.
-- Backslash and single quote must be escaped to avoid breaking the literal;
-- LF, CR, and Tab must be escaped because a literal newline inside a single-
-- quoted JS string is a SyntaxError. Other control characters (NUL, etc.) are
-- left as-is — they are vanishingly rare in selectors / values, and AppleScript
-- has no clean way to embed arbitrary byte literals in a replacement string.
on jsEscape(s)
	set s to my replaceText(s, "\\", "\\\\")
	set s to my replaceText(s, "'", "\\'")
	set s to my replaceText(s, linefeed, "\\n")
	set s to my replaceText(s, return, "\\r")
	set s to my replaceText(s, tab, "\\t")
	return s
end jsEscape

on replaceText(theText, searchString, replaceString)
	set savedDelimiters to AppleScript's text item delimiters
	set AppleScript's text item delimiters to searchString
	set theItems to text items of theText
	set AppleScript's text item delimiters to replaceString
	set theText to theItems as text
	set AppleScript's text item delimiters to savedDelimiters
	return theText
end replaceText
