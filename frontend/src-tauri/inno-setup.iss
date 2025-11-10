[Setup]
AppName=Inkling
AppVersion=0.1.0
AppPublisher=Inkling
DefaultDirName={autopf}\Inkling
DefaultGroupName=Inkling
OutputDir=usersrc\target\release\bundle
OutputBaseFilename=Inkling_0.1.0_x64-setup
Compression=lzma2
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64
ArchitecturesAllowed=x64

[Files]
Source: "target\release\frontend.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "target\release\backend\*"; DestDir: "{app}\backend"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "target\release\python\*"; DestDir: "{app}\python"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Inkling"; Filename: "{app}\frontend.exe"
Name: "{commondesktop}\Inkling"; Filename: "{app}\frontend.exe"

[Run]
Filename: "{app}\frontend.exe"; Description: "Launch Inkling"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: dirifempty; Name: "{app}"