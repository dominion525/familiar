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
