Option Explicit
Dim shell, files, root, destination, link
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
root = files.GetParentFolderName(WScript.ScriptFullName)
destination = shell.SpecialFolders("Desktop") & "\Codex Monitor.lnk"
If files.FileExists(destination) Then
  MsgBox "A Codex Monitor shortcut already exists. Rename it first if you want a new one.", 64, "Codex Monitor"
  WScript.Quit 1
End If
Set link = shell.CreateShortcut(destination)
link.TargetPath = shell.ExpandEnvironmentStrings("%SystemRoot%") & "\System32\wscript.exe"
link.Arguments = Chr(34) & root & "\Launch.vbs" & Chr(34)
link.WorkingDirectory = root
link.IconLocation = root & "\codex-monitor-icon.ico,0"
link.Description = "Open your local Codex activity monitor"
link.Save
MsgBox "Codex Monitor is now on your desktop. Keep this project folder in its current location.", 64, "Codex Monitor"
