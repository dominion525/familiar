-- familiar — Google Chrome control script for macOS
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
--   wait_for_load WID TID
--   wait_for_selector WID TID SELECTOR MAX_WAIT
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
--
-- SELECTOR forms (see selectorResolverJs):
--   CSS (default)   e.g. "button.submit", "#email"
--   text=...        match by trimmed visible text (innermost element)
--   xpath=...       match by XPath (first node)
--   label=...       match a form control via its <label> / aria-label

-- TODO: refactor the action dispatch (the if/else chain below).

on run argv
	set action to item 1 of argv

	-- Save focus
	tell application "System Events"
		set frontApp to name of first application process whose frontmost is true
	end tell

	if action is "list_tabs" then
		set actionResult to my doListTabs()
	else if action is "new_tab" then
		set actionResult to my doNewTab()
	else if action is "new_incognito_tab" then
		set actionResult to my doNewIncognitoTab()
	else if action is "navigate" then
		my doNavigate(item 2 of argv, item 3 of argv, item 4 of argv)
		set actionResult to ""
	else if action is "reload" then
		my doReload(item 2 of argv, item 3 of argv)
		set actionResult to ""
	else if action is "go_back" then
		my doGoBack(item 2 of argv, item 3 of argv)
		set actionResult to ""
	else if action is "go_forward" then
		my doGoForward(item 2 of argv, item 3 of argv)
		set actionResult to ""
	else if action is "stop" then
		my doStop(item 2 of argv, item 3 of argv)
		set actionResult to ""
	else if action is "close_tab" then
		my doCloseTab(item 2 of argv, item 3 of argv)
		set actionResult to ""
	else if action is "wait_for_load" then
		set actionResult to my doWaitForLoad(item 2 of argv, item 3 of argv)
	else if action is "wait_for_selector" then
		set actionResult to my doWaitForSelector(item 2 of argv, item 3 of argv, item 4 of argv, item 5 of argv)
	else if action is "get_html" then
		set actionResult to my doGetHtml(item 2 of argv, item 3 of argv)
	else if action is "get_tab_url" then
		set actionResult to my doGetTabUrl(item 2 of argv, item 3 of argv)
	else if action is "active_tab" then
		set actionResult to my doActiveTab(item 2 of argv)
	else if action is "window_mode" then
		set actionResult to my doWindowMode(item 2 of argv)
	else if action is "is_loading" then
		set actionResult to my doIsLoading(item 2 of argv, item 3 of argv)
	else if action is "execute_js" then
		set actionResult to my doExecuteJs(item 2 of argv, item 3 of argv, item 4 of argv)
	else if action is "execute_js_file" then
		set actionResult to my doExecuteJsFile(item 2 of argv, item 3 of argv, item 4 of argv)
	else if action is "click" then
		set actionResult to my doClick(item 2 of argv, item 3 of argv, item 4 of argv)
	else if action is "fill" then
		set actionResult to my doFill(item 2 of argv, item 3 of argv, item 4 of argv, item 5 of argv)
	else if action is "get_text" then
		set actionResult to my doGetText(item 2 of argv, item 3 of argv, item 4 of argv)
	else if action is "get_attribute" then
		set actionResult to my doGetAttribute(item 2 of argv, item 3 of argv, item 4 of argv, item 5 of argv)
	else if action is "get_value" then
		set actionResult to my doGetValue(item 2 of argv, item 3 of argv, item 4 of argv)
	else if action is "exists" then
		set actionResult to my doExists(item 2 of argv, item 3 of argv, item 4 of argv)
	else if action is "query_all" then
		set actionResult to my doQueryAll(item 2 of argv, item 3 of argv, item 4 of argv)
	else
		error "Unknown action: " & action
	end if

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

on doWaitForLoad(wId, tId)
	set waited to 0
	repeat while waited < 60
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

-- Get an element's visible text. Returns the trimmed text, or "not_found".
on doGetText(wId, tId, sel)
	set js to my selectorResolverJs() & "(function(){
  var el = __famFind('" & my jsEscape(sel) & "');
  if (!el) return 'not_found';
  return (el.innerText || el.textContent || '').trim();
})()"
	return my runJs(wId, tId, js)
end doGetText

-- Get an attribute value. Returns the value (empty string if the attribute is
-- absent), or "not_found" if no element matched.
on doGetAttribute(wId, tId, sel, attrName)
	set js to my selectorResolverJs() & "(function(){
  var el = __famFind('" & my jsEscape(sel) & "');
  if (!el) return 'not_found';
  var v = el.getAttribute('" & my jsEscape(attrName) & "');
  return v === null ? '' : v;
})()"
	return my runJs(wId, tId, js)
end doGetAttribute

-- Get an input/textarea/select value. Returns the value, or "not_found".
on doGetValue(wId, tId, sel)
	set js to my selectorResolverJs() & "(function(){
  var el = __famFind('" & my jsEscape(sel) & "');
  if (!el) return 'not_found';
  return (el.value === undefined || el.value === null) ? '' : String(el.value);
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

-- ============================================================
-- String utilities
-- ============================================================

-- Escape a string for safe embedding inside a single-quoted JS literal.
on jsEscape(s)
	set s to my replaceText(s, "\\", "\\\\")
	set s to my replaceText(s, "'", "\\'")
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
