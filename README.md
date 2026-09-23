# OktaDev Blog

## Contributions

While we are an open project, we're not open to contributions without prior conversation. If you want to contribute to OktaDev blog content, please reach out to us at <dev-advocacy@okta.com>.

PRs are the final step in our editorial process for contributors. PRs created without communication, approval, or outside the editorial process will be closed.

## Getting going

Fork and clone your forked repo. Run `npm ci` to install dependencies.

Start the server by running `npm start`.

### Faster local builds

A full build processes ~700 posts, so `npm start` can be slow to boot. For quicker iteration, `npm run dev` serves only the newest 25 posts. Nothing is deleted, the rest are just skipped for that run, so there's nothing to undo before committing. Set `DEV_POSTS` to change the count: `DEV_POSTS=50 npm start`.

### Creating a post

`npm run post create <post-name>` scaffolds `src/blog/posts/<today>-<post-name>.md` from a front-matter template and creates its image directory under `public/img/blog/`. Pass an ISO date as a third argument to override today's date.

## License

Apache 2.0, see [LICENSE](LICENSE).
