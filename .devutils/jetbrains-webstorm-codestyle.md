Code formatting in JetBrains WebStorm
=====================================

This directory includes a the file ts-settings.xml that can be imported in WebStorm so that 
it automatically respects RISE TypeScript code style. 

## How to import the Code Style settings in WebStorm:

1) Open the Code Style settings
    - **File | Settings | Editor | Code Style** for Windows and Linux
    - **WebStorm | Preferences | Editor | Code Style** for macOS
2) In the Code Style page, select the desired scheme from the drop-down list, and click 
   the "gear-like" icon next to the dropdown
3) From the drop-down list, select "Import Scheme"
4) Select 'IntelliJ IDEA code style XML'
5) Locate the ts-settings.xml and confirm
6) Apply changes.

## How to beautify code

**Ctrl+Alt+L** will format the code following them specified settings. Please note that it won't help with
tslint restrictions like long lines or useless whitespace, so be careful to make tslint happy while coding. 