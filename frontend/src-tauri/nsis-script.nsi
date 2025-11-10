!include "MUI2.nsh"

; Inkling NSIS Installer Script
Name "Inkling"
OutFile "Inkling_0.1.0_x64-setup.exe"
InstallDir "$PROGRAMFILES\Inkling"

!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath "$INSTDIR"
  
  ; Copy main exe
  File "target\release\frontend.exe"
  
  ; Copy backend folder
  SetOutPath "$INSTDIR\backend"
  File /r "resources\backend\*.*"
  
  ; Copy python folder
  SetOutPath "$INSTDIR\python"
  File /r "resources\python\*.*"
  
  ; Create shortcuts
  SetOutPath "$INSTDIR"
  CreateDirectory "$SMPROGRAMS\Inkling"
  CreateShortCut "$SMPROGRAMS\Inkling\Inkling.lnk" "$INSTDIR\frontend.exe"
  CreateShortCut "$DESKTOP\Inkling.lnk" "$INSTDIR\frontend.exe"
SectionEnd

Section "Uninstall"
  RMDir /r "$INSTDIR"
  RMDir /r "$SMPROGRAMS\Inkling"
  Delete "$DESKTOP\Inkling.lnk"
SectionEnd