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
