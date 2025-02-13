# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Fixed
- [CI] Vendor PyPI packaging GH workflow to properly pass ABI version


## [0.1.5] - 2025-02-13
### Fixed
- [CI] Force ABI 14 during builds, allowing re-enabling of parser generation... let's try this again.


## [0.1.4] - 2025-02-13
### Fixed
- [CI] Force ABI 14 during builds, allowing re-enabling of parser generation


## [0.1.3] - 2025-02-13
### Fixed
- Support `{{+` and `{%+` whitespace-affirming modifier (previously, only the whitespace-eating `{{-` was supported)


## [0.1.2] - 2025-02-13
### Fixed
- [CI] Avoid generating parser during build, because it builds ABI 15 binaries, but py-tree-sitter only supports <=14 currently


## [0.1.1] - 2025-02-13
### Fixed
- Add forgotten external scanner (`src/scanner.c`) to repo


## [0.1.0] - 2025-02-11
Initial release

