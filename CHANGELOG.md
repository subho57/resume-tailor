## [1.4.4](https://github.com/subho57/resume-tailor/compare/v1.4.3...v1.4.4) (2026-08-02)


### Bug Fixes

* updated sitemap.xml ([33a61bd](https://github.com/subho57/resume-tailor/commit/33a61bd6416562ef7c995e669a7a64f5c2c778a3))

## [1.4.3](https://github.com/subho57/resume-tailor/compare/v1.4.2...v1.4.3) (2026-08-02)


### Bug Fixes

* warner music group cvs added ([ab72625](https://github.com/subho57/resume-tailor/commit/ab72625f070355ac64a49d74fc980e5df559bf66))

## [1.4.2](https://github.com/subho57/resume-tailor/compare/v1.4.1...v1.4.2) (2026-08-02)


### Bug Fixes

* updated the website layout ([e1ca884](https://github.com/subho57/resume-tailor/commit/e1ca8848817befa8400ffb01bd9a42141d964d32))

## [1.4.1](https://github.com/subho57/resume-tailor/compare/v1.4.0...v1.4.1) (2026-08-01)


### Bug Fixes

* install root node_modules before building site/ in Pages workflow ([03aa46b](https://github.com/subho57/resume-tailor/commit/03aa46bcb6a84a209350248127908e4a531dee46))

# [1.4.0](https://github.com/subho57/resume-tailor/compare/v1.3.0...v1.4.0) (2026-08-01)


### Bug Fixes

* harden install.sh prereq/OS detection (Carlito check, arch, Windows) ([8eaf14e](https://github.com/subho57/resume-tailor/commit/8eaf14e1db3a93123fc02cadd1da65c9368845df))


### Features

* add GitHub Actions Pages deployment workflow for site/ ([e63de68](https://github.com/subho57/resume-tailor/commit/e63de6862fda4e1728dd9f79f0901a638e8c880f))
* add homepage copy, SVG infographic, and SEO metadata to site/ ([7c22e9e](https://github.com/subho57/resume-tailor/commit/7c22e9e9c6d537b59121d11127f445a0a710bacc))
* add install.sh for macOS/Linux CLI + skill installation ([6e7db57](https://github.com/subho57/resume-tailor/commit/6e7db57e75e428e3be243f38074e998057b0074f))
* rename build-resume to tailor-resume, resume-superset-builder to resume-tailor ([6bc6657](https://github.com/subho57/resume-tailor/commit/6bc665710960d786b25be834269e11f3f20ad7af))
* scaffold site/ - client-side browser demo of the resume renderer ([fc85916](https://github.com/subho57/resume-tailor/commit/fc85916e622f03edaed55b5dc002ed705659995a))

# [1.3.0](https://github.com/subho57/resume-builder/compare/v1.2.0...v1.3.0) (2026-08-01)


### Bug Fixes

* preserve executable bit on release binaries via tar/zip archives ([338a03e](https://github.com/subho57/resume-builder/commit/338a03eaf9ee05f748a6d32b026bf26221d9621e))


### Features

* add master resume for Aritrika Karmakar ([04afa8b](https://github.com/subho57/resume-builder/commit/04afa8bbf25b23d4b6eec85abde1fa7fdeca31b2))
* add master-resume-builder skill ([352d65b](https://github.com/subho57/resume-builder/commit/352d65b58bcb793d8c31036f84243979e009d7ac))
* tailor Aritrika's resume for 2 Precisely BDR applications ([a25cb72](https://github.com/subho57/resume-builder/commit/a25cb722d017b7fd02ed1f00e11914d225ee6419))

# [1.2.0](https://github.com/subho57/resume-builder/compare/v1.1.2...v1.2.0) (2026-07-12)


### Features

* **skill:** add cover letter + outreach messages and align resume structure ([45154fe](https://github.com/subho57/resume-builder/commit/45154fe0b86da65f605f790f05572481c224fc7d))

## [1.1.2](https://github.com/subho57/resume-builder/compare/v1.1.1...v1.1.2) (2026-07-12)


### Bug Fixes

* updated skill to create ats friendly parsable resumes ([36bfd9d](https://github.com/subho57/resume-builder/commit/36bfd9dd25b2a4427b5d27038c00689b30634ca0))

## [1.1.1](https://github.com/subho57/resume-builder/compare/v1.1.0...v1.1.1) (2026-07-12)


### Bug Fixes

* removed any providing actual types ([a99a1bf](https://github.com/subho57/resume-builder/commit/a99a1bff8a230bc100cb17fc6d8cbc2e6f3f40c9))

# [1.1.0](https://github.com/subho57/resume-builder/compare/v1.0.0...v1.1.0) (2026-07-12)


### Features

* add --install-skill to embed the JD-tailoring skill in the binary ([8248531](https://github.com/subho57/resume-builder/commit/82485313be4024821190e86979e9e0796f543f9e))

# 1.0.0 (2026-07-12)


* feat!: rename --auto-fit-to-single-page to --one-pager ([c928a81](https://github.com/subho57/resume-builder/commit/c928a81469ec384e7939c3af62f93a2f043b0f28))


### Features

* added claude skill to reverse jd and create resume ([2ef769d](https://github.com/subho57/resume-builder/commit/2ef769dce1369a5882d5b67d247a1c271a30a635))
* automate releases with semantic-release on every push to main ([ffc7ea6](https://github.com/subho57/resume-builder/commit/ffc7ea6ae2b7978726ccb95c52c6167b244e24ad))


### BREAKING CHANGES

* the --auto-fit-to-single-page flag no longer exists, use
--one-pager instead. No backward-compatibility alias was kept.

Also bump GitHub Actions in release.yml to their current latest majors
(checkout v7, upload-artifact v7, download-artifact v8,
semantic-release-action v6) and align local semantic-release devDependencies
to match (v25 core + current plugin versions) after verifying none of the
version bumps have breaking changes affecting how they're used here.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
