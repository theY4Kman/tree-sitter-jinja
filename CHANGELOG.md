# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]


## [0.3.2] - 2025-03-01
### Fixed
- Allow empty `jinja_variable` nodes (invalid at runtime, but enables better tooling)


## [0.3.2] - 2025-02-26
### Fixed
- [CI] Resolve NPM dist package not including built binaries


## [0.3.1] - 2025-02-26
### Added
- [CI] Publish NPM builds


## [0.3.0] - 2025-02-17
### Added
- Parse `{% raw %}` blocks, resulting in a `jinja_raw` node with a `body: (template_data)` field


## [0.2.0] - 2025-02-16
### Added
- Introduce `string_data` node to house only contents of string literals
- `string` nodes now have a `content` field applied to all `string_data` and `escape_sequence` children comprising the string content.

### Changed
- String literals are now tokenized in the external parser


## [0.1.6] - 2025-02-13
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

