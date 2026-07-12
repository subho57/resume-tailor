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
