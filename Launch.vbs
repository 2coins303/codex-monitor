Option Explicit
Dim shell, files, root, nodeExe, candidate, folder, result
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
root = files.GetParentFolderName(WScript.ScriptFullName)
nodeExe = ""
For Each folder In Split(shell.ExpandEnvironmentStrings("%PATH%"), ";")
  folder = Replace(folder, Chr(34), "")
  If Len(folder) > 0 Then
    candidate = files.BuildPath(folder, "node.exe")
    If files.FileExists(candidate) Then nodeExe = candidate: Exit For
  End If
Next
If nodeExe = "" Then
  candidate = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe"
  If files.FileExists(candidate) Then nodeExe = candidate
End If
If nodeExe = "" Then
  MsgBox "Install Node.js 22 or newer from https://nodejs.org/ and try again.", 48, "Codex Monitor"
  WScript.Quit 1
End If
shell.CurrentDirectory = root
result = shell.Run(Chr(34) & nodeExe & Chr(34) & " " & Chr(34) & root & "\launcher.mjs" & Chr(34), 0, True)
If result <> 0 Then MsgBox "Codex Monitor could not start. Open Start.cmd in this folder to see the error.", 48, "Codex Monitor"
WScript.Quit result
