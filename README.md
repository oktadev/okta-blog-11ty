# OktaDev Blog 

## Getting going

Fork and clone your forked repo. Run `npm ci` to install dependencies.

Start the server by running `npm start`.

### Faster local builds

A full build processes ~700 posts, so `npm start` can be slow to boot. For quicker iteration, `npm run dev` serves only the newest 25 posts. Nothing is deleted, the rest are just skipped for that run, so there's nothing to undo before committing. Set `DEV_POSTS` to change the count: `DEV_POSTS=50 npm start`.

### Creating a post

`npm run post create <post-name>` scaffolds `src/blog/posts/<today>-<post-name>.md` from a front-matter template and creates its image directory under `public/img/blog/`. Pass an ISO date as a third argument to override today's date.

## License

Apache 2.0, see [LICENSE](LICENSE).
