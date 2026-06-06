-- familiar — Google Chrome control script for macOS
-- Usage: osascript familiar.applescript ACTION [ARGS...]
--
-- Actions:
--   list_tabs
--   new_tab
--   navigate WID TID URL
--   close_tab WID TID
--   wait_for_load WID TID
--   wait_for_selector WID TID SELECTOR MAX_WAIT
--   get_html WID TID
--   get_tab_url WID TID
--   execute_js WID TID EXPRESSION
--   execute_js_file WID TID JS_FILE_PATH

-- TODO: refactor action dispatch.
-- Many actions share the (wid, tid) signature and could be unified.

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
	else if action is "navigate" then
		my doNavigate(item 2 of argv, item 3 of argv, item 4 of argv)
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

on doNewTab()
	tell application "Google Chrome"
		set targetWindow to missing value
		repeat with aWindow in (every window)
			if mode of aWindow is "incognito" then
				set targetWindow to aWindow
				exit repeat
			end if
		end repeat
		if targetWindow is missing value then
			set targetWindow to (make new window with properties {mode:"incognito"})
		end if
		set newTab to (make new tab at end of tabs of targetWindow)
		set windowId to id of targetWindow
		set tabId to id of newTab
		return (windowId as text) & "," & (tabId as text)
	end tell
end doNewTab

on doNavigate(wId, tId, targetURL)
	tell application "Google Chrome"
		tell window id (wId as integer)
			set URL of tab id (tId as integer) to targetURL
			-- Wait for navigation to begin (until readyState leaves "complete")
			tell tab id (tId as integer)
				repeat 6 times
					set rs to (execute javascript "document.readyState")
					if rs is not "complete" then exit repeat
					delay 0.5
				end repeat
			end tell
		end tell
	end tell
end doNavigate

on doCloseTab(wId, tId)
	tell application "Google Chrome"
		tell window id (wId as integer)
			close tab id (tId as integer)
		end tell
	end tell
end doCloseTab

on doWaitForLoad(wId, tId)
	tell application "Google Chrome"
		tell window id (wId as integer)
			tell tab id (tId as integer)
				set maxWait to 60
				set waited to 0
				repeat while waited < maxWait
					set readyState to (execute javascript "document.readyState")
					if readyState is "complete" then
						return "complete"
					end if
					delay 0.5
					set waited to waited + 0.5
				end repeat
				return "timeout"
			end tell
		end tell
	end tell
end doWaitForLoad

on doWaitForSelector(wId, tId, cssSelector, maxWait)
	set safeSelector to my jsEscape(cssSelector)
	tell application "Google Chrome"
		tell window id (wId as integer)
			tell tab id (tId as integer)
				set waited to 0
				repeat while waited < (maxWait as integer)
					set jsResult to (execute javascript "String(document.querySelector('" & safeSelector & "') !== null)")
					if jsResult is "true" then
						return "found"
					end if
					delay 0.5
					set waited to waited + 0.5
				end repeat
				return "timeout"
			end tell
		end tell
	end tell
end doWaitForSelector

on doGetHtml(wId, tId)
	tell application "Google Chrome"
		tell window id (wId as integer)
			tell tab id (tId as integer)
				execute javascript "document.documentElement.outerHTML"
			end tell
		end tell
	end tell
end doGetHtml

on doGetTabUrl(wId, tId)
	tell application "Google Chrome"
		tell window id (wId as integer)
			return URL of tab id (tId as integer)
		end tell
	end tell
end doGetTabUrl

on doExecuteJs(wId, tId, jsExpr)
	tell application "Google Chrome"
		tell window id (wId as integer)
			tell tab id (tId as integer)
				execute javascript jsExpr
			end tell
		end tell
	end tell
end doExecuteJs

-- Read JavaScript from a file and run it. Avoids all shell/quoting
-- escaping for complex scripts: write the JS to a file, pass its path.
on doExecuteJsFile(wId, tId, filePath)
	set jsContent to (read (POSIX file filePath) as «class utf8»)
	tell application "Google Chrome"
		tell window id (wId as integer)
			tell tab id (tId as integer)
				execute javascript jsContent
			end tell
		end tell
	end tell
end doExecuteJsFile

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
